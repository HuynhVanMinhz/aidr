using System.Text.Json;
using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AIDR.Infrastructure.Ordering;

public sealed class OrderRepository : IOrderRepository
{
    private static readonly JsonSerializerOptions SnapshotJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly AidrDbContext _db;
    private readonly ILowStockNotifier _lowStockNotifier;
    private readonly ILogger<OrderRepository> _logger;

    public OrderRepository(
        AidrDbContext db,
        ILowStockNotifier lowStockNotifier,
        ILogger<OrderRepository> logger)
    {
        _db = db;
        _lowStockNotifier = lowStockNotifier;
        _logger = logger;
    }

    public async Task<CreateOrderResponse> CreateOrdersFromCartAsync(
        Guid buyerUserId,
        Guid shippingAddressId,
        IReadOnlyCollection<Guid>? cartItemIds,
        string? buyerNote,
        IReadOnlyDictionary<Guid, Guid>? vouchersByShopId,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var address = await _db.Addresses
            .FirstOrDefaultAsync(
                a => a.AddressId == shippingAddressId && a.UserId == buyerUserId,
                cancellationToken)
            ?? throw new NotFoundException("Shipping address not found.");

        var cart = await _db.Carts
            .Include(c => c.Items)
                .ThenInclude(i => i.Product)
                    .ThenInclude(p => p.Shop)
            .Include(c => c.Items)
                .ThenInclude(i => i.Product)
                    .ThenInclude(p => p.Category)
            .FirstOrDefaultAsync(c => c.UserId == buyerUserId, cancellationToken)
            ?? throw new AppException("Your cart is empty.");

        var selectedItems = SelectCartItems(cart, cartItemIds);
        if (selectedItems.Count == 0)
            throw new AppException("Your cart is empty.");

        ValidateCartItems(selectedItems);

        var shopIdsInCart = selectedItems.Select(i => i.Product.ShopId).Distinct().ToHashSet();
        if (vouchersByShopId is not null)
        {
            foreach (var shopId in vouchersByShopId.Keys)
            {
                if (!shopIdsInCart.Contains(shopId))
                    throw new AppException("Voucher selection references a shop that is not in the cart.");
            }
        }

        var shippingSnapshotJson = BuildShippingSnapshotJson(address);
        var now = DateTime.UtcNow;
        var createdOrders = new List<CreatedOrderDto>();
        var voucherUsageInCheckout = new Dictionary<Guid, int>();
        var lowStockCrossedProductIds = new HashSet<Guid>();

        foreach (var shopGroup in selectedItems.GroupBy(i => i.Product.ShopId))
        {
            var shop = shopGroup.First().Product.Shop;
            Guid? voucherId = null;
            if (vouchersByShopId is not null &&
                vouchersByShopId.TryGetValue(shop.ShopId, out var selectedVoucherId))
            {
                voucherId = selectedVoucherId;
            }

            var order = await CreateShopOrderAsync(
                buyerUserId,
                shop,
                shopGroup.ToList(),
                address.AddressId,
                shippingSnapshotJson,
                buyerNote,
                voucherId,
                voucherUsageInCheckout,
                now,
                lowStockCrossedProductIds,
                cancellationToken);

            createdOrders.Add(order);
        }

        _db.CartItems.RemoveRange(selectedItems);
        cart.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        foreach (var productId in lowStockCrossedProductIds)
            await _lowStockNotifier.TryNotifyIfBecameLowAsync(productId, wasLowStock: false, cancellationToken);

        var currency = createdOrders.FirstOrDefault()?.Currency ?? "VND";
        return new CreateOrderResponse
        {
            Orders = createdOrders,
            OrderCount = createdOrders.Count,
            GrandTotal = createdOrders.Sum(o => o.TotalAmount),
            Currency = currency
        };
    }

    public async Task<(IReadOnlyList<BuyerOrderListItemDto> Items, int TotalCount, int EffectivePage)> ListBuyerOrdersAsync(
        Guid buyerUserId,
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Orders.AsNoTracking()
            .Where(o => o.BuyerUserId == buyerUserId);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(o => o.Status == status);

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = pageSize <= 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);
        var effectivePage = totalPages == 0 ? 1 : Math.Min(page, totalPages);

        var rows = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((effectivePage - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new
            {
                o.OrderId,
                o.OrderCode,
                o.ShopId,
                ShopName = o.Shop.ShopName,
                o.Status,
                o.SubtotalAmount,
                o.DiscountAmount,
                o.ShippingFee,
                o.TotalAmount,
                o.Currency,
                ItemCount = o.Items.Sum(i => i.Quantity),
                ThumbnailUrl = o.Items
                    .OrderBy(i => i.OrderItemId)
                    .SelectMany(i => i.Product.Images
                        .OrderByDescending(img => img.IsPrimary)
                        .ThenBy(img => img.SortOrder)
                        .Select(img => img.ImageUrl))
                    .FirstOrDefault(),
                o.TrackingCode,
                o.CreatedAt,
                o.PaidAt,
                o.CancelledAt,
                o.DeliveredAt,
                o.CompletedAt
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(o => new BuyerOrderListItemDto
        {
            OrderId = o.OrderId,
            OrderCode = o.OrderCode,
            ShopId = o.ShopId,
            ShopName = o.ShopName,
            Status = o.Status,
            SubtotalAmount = o.SubtotalAmount,
            DiscountAmount = o.DiscountAmount,
            ShippingFee = o.ShippingFee,
            TotalAmount = o.TotalAmount,
            Currency = o.Currency,
            ItemCount = o.ItemCount,
            ThumbnailUrl = o.ThumbnailUrl,
            TrackingCode = o.TrackingCode,
            CreatedAt = o.CreatedAt,
            PaidAt = o.PaidAt,
            CancelledAt = o.CancelledAt,
            DeliveredAt = o.DeliveredAt,
            CompletedAt = o.CompletedAt
        }).ToList();

        return (items, totalCount, effectivePage);
    }

    public async Task<BuyerOrderDetailDto?> GetBuyerOrderAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default)
    {
        var order = await _db.Orders.AsNoTracking()
            .Include(o => o.Shop)
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
                    .ThenInclude(p => p.Images)
            .Include(o => o.Payments)
            .Include(o => o.StatusHistories)
            .FirstOrDefaultAsync(
                o => o.OrderId == orderId && o.BuyerUserId == buyerUserId,
                cancellationToken);

        return order is null ? null : MapDetail(order);
    }

    public async Task<BuyerOrderDetailDto> CancelBuyerOrderAsync(
        Guid buyerUserId,
        Guid orderId,
        string? reason,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var order = await _db.Orders
            .Include(o => o.Shop)
            .Include(o => o.Items)
                .ThenInclude(i => i.LotAllocations)
                    .ThenInclude(a => a.Lot)
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
                    .ThenInclude(p => p.Images)
            .Include(o => o.Payments)
            .Include(o => o.StatusHistories)
            .FirstOrDefaultAsync(
                o => o.OrderId == orderId && o.BuyerUserId == buyerUserId,
                cancellationToken)
            ?? throw new NotFoundException("Order not found.");

        if (!string.Equals(order.Status, OrderConstants.StatusPendingPayment, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Only unpaid orders can be cancelled.");

        var now = DateTime.UtcNow;
        var fromStatus = order.Status;

        await ReleaseReservedStockAsync(order, buyerUserId, now, cancellationToken);
        await ReleaseVoucherRedemptionAsync(order, cancellationToken);

        order.Status = OrderConstants.StatusCancelled;
        order.CancelledAt = now;
        order.UpdatedAt = now;

        foreach (var payment in order.Payments.Where(p =>
                     string.Equals(p.Status, OrderConstants.PaymentStatusPending, StringComparison.OrdinalIgnoreCase)))
        {
            payment.Status = OrderConstants.PaymentStatusCancelled;
            payment.UpdatedAt = now;
        }

        var cancelHistory = new OrderStatusHistory
        {
            OrderId = order.OrderId,
            FromStatus = fromStatus,
            ToStatus = OrderConstants.StatusCancelled,
            ChangedBy = buyerUserId,
            Note = reason ?? "Cancelled by buyer",
            CreatedAt = now
        };
        order.StatusHistories.Add(cancelHistory);

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return MapDetail(order);
    }

    public async Task<BuyerOrderDetailDto> ConfirmReceivedAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var order = await _db.Orders
            .Include(o => o.Shop)
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
                    .ThenInclude(p => p.Images)
            .Include(o => o.Payments)
            .Include(o => o.StatusHistories)
            .FirstOrDefaultAsync(
                o => o.OrderId == orderId && o.BuyerUserId == buyerUserId,
                cancellationToken)
            ?? throw new NotFoundException("Order not found.");

        if (string.Equals(order.Status, OrderConstants.StatusCompleted, StringComparison.OrdinalIgnoreCase))
        {
            await transaction.CommitAsync(cancellationToken);
            return MapDetail(order);
        }

        if (!string.Equals(order.Status, OrderConstants.StatusDelivered, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Only delivered orders can be confirmed as received.");

        var now = DateTime.UtcNow;
        var fromStatus = order.Status;

        order.Status = OrderConstants.StatusCompleted;
        order.CompletedAt = now;
        order.UpdatedAt = now;

        var completeHistory = new OrderStatusHistory
        {
            OrderId = order.OrderId,
            FromStatus = fromStatus,
            ToStatus = OrderConstants.StatusCompleted,
            ChangedBy = buyerUserId,
            Note = "Buyer confirmed received",
            CreatedAt = now
        };
        order.StatusHistories.Add(completeHistory);

        foreach (var item in order.Items)
            item.Product.SoldCount += item.Quantity;

        await CreditSellerWalletAsync(order, now, cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return MapDetail(order);
    }

    private async Task ReleaseReservedStockAsync(
        Order order,
        Guid buyerUserId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var touchedProducts = new HashSet<Guid>();

        foreach (var item in order.Items)
        {
            foreach (var allocation in item.LotAllocations)
            {
                var lot = allocation.Lot;
                lot.QuantityRemaining += allocation.Quantity;
                if (string.Equals(lot.Status, OrderConstants.LotStatusDepleted, StringComparison.OrdinalIgnoreCase)
                    && lot.QuantityRemaining > 0)
                {
                    lot.Status = OrderConstants.LotStatusOpen;
                }

                _db.InventoryTransactions.Add(new InventoryTransaction
                {
                    ProductId = item.ProductId,
                    LotId = lot.LotId,
                    ChangeQty = allocation.Quantity,
                    UnitCost = lot.UnitCost,
                    Reason = OrderConstants.InventoryReasonOrderRelease,
                    ReferenceType = OrderConstants.InventoryReferenceTypeOrder,
                    ReferenceId = order.OrderId,
                    Note = "Released on order cancel",
                    CreatedBy = buyerUserId,
                    CreatedAt = now
                });
            }

            touchedProducts.Add(item.ProductId);
        }

        foreach (var productId in touchedProducts)
        {
            var product = order.Items
                .Select(i => i.Product)
                .FirstOrDefault(p => p.ProductId == productId)
                ?? await _db.Products.FirstAsync(p => p.ProductId == productId, cancellationToken);

            await RecalcStockAsync(product, cancellationToken);
        }
    }

    private async Task CreditSellerWalletAsync(Order order, DateTime now, CancellationToken cancellationToken)
    {
        var alreadyCredited = await _db.WalletTransactions.AnyAsync(
            t => t.ReferenceType == OrderConstants.WalletReferenceTypeOrder
                 && t.ReferenceId == order.OrderId
                 && t.TxType == OrderConstants.WalletTxTypeOrderCredit,
            cancellationToken);

        if (alreadyCredited)
            return;

        var wallet = await _db.Wallets
            .FirstOrDefaultAsync(w => w.ShopId == order.ShopId, cancellationToken)
            ?? throw new AppException("Seller wallet was not found for this shop.");

        var creditAmount = decimal.Round(order.TotalAmount, 2, MidpointRounding.AwayFromZero);
        wallet.AvailableBalance = decimal.Round(
            wallet.AvailableBalance + creditAmount,
            2,
            MidpointRounding.AwayFromZero);
        wallet.UpdatedAt = now;

        _db.WalletTransactions.Add(new WalletTransaction
        {
            WalletId = wallet.WalletId,
            TxType = OrderConstants.WalletTxTypeOrderCredit,
            Amount = creditAmount,
            BalanceAfter = wallet.AvailableBalance,
            ReferenceType = OrderConstants.WalletReferenceTypeOrder,
            ReferenceId = order.OrderId,
            Note = $"Order credit for {order.OrderCode}",
            CreatedAt = now
        });
    }

    private static BuyerOrderDetailDto MapDetail(Order order)
    {
        var payment = order.Payments
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefault();

        var histories = order.StatusHistories
            .OrderBy(h => h.CreatedAt)
            .ThenBy(h => h.HistoryId)
            .Select(h => new BuyerOrderStatusHistoryDto
            {
                FromStatus = h.FromStatus,
                ToStatus = h.ToStatus,
                Note = h.Note,
                CreatedAt = h.CreatedAt
            })
            .ToList();

        var items = order.Items
            .OrderBy(i => i.OrderItemId)
            .Select(i => new BuyerOrderItemDto
            {
                OrderItemId = i.OrderItemId,
                ProductId = i.ProductId,
                ProductName = i.ProductNameSnapshot,
                Sku = i.SkuSnapshot,
                ImageUrl = i.Product.Images
                    .OrderByDescending(img => img.IsPrimary)
                    .ThenBy(img => img.SortOrder)
                    .Select(img => img.ImageUrl)
                    .FirstOrDefault(),
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice,
                LineTotal = i.LineTotal
            })
            .ToList();

        return new BuyerOrderDetailDto
        {
            OrderId = order.OrderId,
            OrderCode = order.OrderCode,
            ShopId = order.ShopId,
            ShopName = order.Shop.ShopName,
            Status = order.Status,
            SubtotalAmount = order.SubtotalAmount,
            DiscountAmount = order.DiscountAmount,
            ShippingFee = order.ShippingFee,
            TotalAmount = order.TotalAmount,
            Currency = order.Currency,
            BuyerNote = order.BuyerNote,
            SellerNote = order.SellerNote,
            TrackingCode = order.TrackingCode,
            Shipping = ParseShippingSnapshot(order.ShippingSnapshotJson, order.ShippingAddressId),
            Items = items,
            Payment = payment is null
                ? null
                : new BuyerOrderPaymentDto
                {
                    PaymentId = payment.PaymentId,
                    Provider = payment.Provider,
                    Status = payment.Status,
                    Amount = payment.Amount,
                    Currency = payment.Currency,
                    CheckoutUrl = payment.CheckoutUrl,
                    PaidAt = payment.PaidAt,
                    CreatedAt = payment.CreatedAt
                },
            StatusHistory = histories,
            CreatedAt = order.CreatedAt,
            UpdatedAt = order.UpdatedAt,
            PaidAt = order.PaidAt,
            CancelledAt = order.CancelledAt,
            DeliveredAt = order.DeliveredAt,
            CompletedAt = order.CompletedAt,
            CanCancel = string.Equals(
                order.Status,
                OrderConstants.StatusPendingPayment,
                StringComparison.OrdinalIgnoreCase),
            CanConfirmReceived = string.Equals(
                order.Status,
                OrderConstants.StatusDelivered,
                StringComparison.OrdinalIgnoreCase)
        };
    }

    private static BuyerOrderShippingDto ParseShippingSnapshot(string snapshotJson, Guid? shippingAddressId)
    {
        try
        {
            using var doc = JsonDocument.Parse(snapshotJson);
            var root = doc.RootElement;
            return new BuyerOrderShippingDto
            {
                AddressId = TryGetGuid(root, "addressId") ?? shippingAddressId,
                ReceiverName = TryGetString(root, "receiverName") ?? string.Empty,
                Phone = TryGetString(root, "phone") ?? string.Empty,
                Province = TryGetString(root, "province") ?? string.Empty,
                District = TryGetString(root, "district") ?? string.Empty,
                Ward = TryGetString(root, "ward") ?? string.Empty,
                StreetAddress = TryGetString(root, "streetAddress") ?? string.Empty
            };
        }
        catch (JsonException)
        {
            return new BuyerOrderShippingDto
            {
                AddressId = shippingAddressId,
                ReceiverName = string.Empty,
                Phone = string.Empty,
                Province = string.Empty,
                District = string.Empty,
                Ward = string.Empty,
                StreetAddress = string.Empty
            };
        }
    }

    private static string? TryGetString(JsonElement root, string propertyName) =>
        root.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static Guid? TryGetGuid(JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var value))
            return null;

        if (value.ValueKind == JsonValueKind.String && Guid.TryParse(value.GetString(), out var guid))
            return guid;

        return null;
    }

    private async Task ReleaseVoucherRedemptionAsync(Order order, CancellationToken cancellationToken)
    {
        if (order.VoucherId is null)
            return;

        var redemptions = await _db.VoucherRedemptions
            .Where(r => r.OrderId == order.OrderId)
            .ToListAsync(cancellationToken);

        if (redemptions.Count == 0)
            return;

        var voucher = await _db.Vouchers
            .FirstOrDefaultAsync(v => v.VoucherId == order.VoucherId.Value, cancellationToken);

        if (voucher is not null)
        {
            voucher.UsedCount = Math.Max(0, voucher.UsedCount - redemptions.Count);
            voucher.UpdatedAt = DateTime.UtcNow;
        }

        _db.VoucherRedemptions.RemoveRange(redemptions);
        order.VoucherId = null;
    }

    private async Task<CreatedOrderDto> CreateShopOrderAsync(
        Guid buyerUserId,
        Shop shop,
        List<CartItem> items,
        Guid shippingAddressId,
        string shippingSnapshotJson,
        string? buyerNote,
        Guid? voucherId,
        Dictionary<Guid, int> voucherUsageInCheckout,
        DateTime now,
        HashSet<Guid> lowStockCrossedProductIds,
        CancellationToken cancellationToken)
    {
        var orderId = Guid.NewGuid();
        var orderCode = await GenerateUniqueOrderCodeAsync(now, cancellationToken);
        var orderItems = new List<OrderItem>();
        var itemDtos = new List<CreatedOrderItemDto>();
        decimal subtotal = 0m;
        string currency = "VND";

        foreach (var cartItem in items)
        {
            var product = await _db.Products
                .FirstOrDefaultAsync(p => p.ProductId == cartItem.ProductId, cancellationToken)
                ?? throw new AppException($"Product '{cartItem.Product.Name}' is no longer available.");

            EnsureProductPurchasable(product, cartItem.Product.Category.IsActive, shop);

            var available = Math.Max(0, product.StockQuantity - product.ReservedQuantity);
            if (cartItem.Quantity > available)
                throw new ConflictException(
                    $"Only {available} unit(s) available for '{product.Name}'.");

            var wasLowStock = available <= product.LowStockThreshold;

            var unitPrice = decimal.Round(
                product.SalePrice ?? product.BasePrice,
                2,
                MidpointRounding.AwayFromZero);
            var lineTotal = decimal.Round(unitPrice * cartItem.Quantity, 2, MidpointRounding.AwayFromZero);
            currency = product.Currency;

            var orderItemId = Guid.NewGuid();
            var allocations = await AllocateLotsFifoAsync(
                product,
                shop.CostingMethod,
                cartItem.Quantity,
                orderId,
                orderItemId,
                buyerUserId,
                cancellationToken);

            var unitCostAvg = ResolveUnitCostAvg(product, shop.CostingMethod, allocations);

            var orderItem = new OrderItem
            {
                OrderItemId = orderItemId,
                OrderId = orderId,
                ProductId = product.ProductId,
                VariantId = null,
                ProductNameSnapshot = product.Name,
                SkuSnapshot = product.ModelNumber,
                UnitPrice = unitPrice,
                UnitCostAvg = unitCostAvg,
                Quantity = cartItem.Quantity,
                LineTotal = lineTotal,
                LotAllocations = allocations
            };

            orderItems.Add(orderItem);

            var primaryImageUrl = await _db.ProductImages
                .Where(img => img.ProductId == product.ProductId)
                .OrderByDescending(img => img.IsPrimary)
                .ThenBy(img => img.SortOrder)
                .Select(img => img.ImageUrl)
                .FirstOrDefaultAsync(cancellationToken);

            itemDtos.Add(new CreatedOrderItemDto
            {
                OrderItemId = orderItemId,
                ProductId = product.ProductId,
                ProductName = product.Name,
                Sku = product.ModelNumber,
                ImageUrl = primaryImageUrl,
                Quantity = cartItem.Quantity,
                UnitPrice = unitPrice,
                UnitCostAvg = unitCostAvg,
                LineTotal = lineTotal
            });

            subtotal += lineTotal;
            await RecalcStockAsync(product, cancellationToken);

            var availableAfter = Math.Max(0, product.StockQuantity - product.ReservedQuantity);
            if (!wasLowStock && availableAfter <= product.LowStockThreshold)
                lowStockCrossedProductIds.Add(product.ProductId);
        }

        subtotal = decimal.Round(subtotal, 2, MidpointRounding.AwayFromZero);
        var discount = OrderConstants.DefaultDiscountAmount;
        Voucher? appliedVoucher = null;

        if (voucherId is Guid selectedVoucherId && selectedVoucherId != Guid.Empty)
        {
            appliedVoucher = await ResolveAndValidateVoucherAsync(
                selectedVoucherId,
                buyerUserId,
                shop.ShopId,
                subtotal,
                voucherUsageInCheckout,
                now,
                cancellationToken);

            discount = VoucherConstants.CalculateDiscountAmount(
                appliedVoucher.DiscountType,
                appliedVoucher.DiscountValue,
                appliedVoucher.MaxDiscountAmount,
                subtotal);
        }

        var shippingFee = OrderConstants.DefaultShippingFee;
        var total = decimal.Round(subtotal - discount + shippingFee, 2, MidpointRounding.AwayFromZero);
        if (total < 0)
            total = 0;

        var order = new Order
        {
            OrderId = orderId,
            OrderCode = orderCode,
            BuyerUserId = buyerUserId,
            ShopId = shop.ShopId,
            ShippingAddressId = shippingAddressId,
            ShippingSnapshotJson = shippingSnapshotJson,
            Status = OrderConstants.StatusPendingPayment,
            SubtotalAmount = subtotal,
            DiscountAmount = discount,
            ShippingFee = shippingFee,
            TotalAmount = total,
            Currency = currency,
            VoucherId = appliedVoucher?.VoucherId,
            BuyerNote = buyerNote,
            CreatedAt = now,
            UpdatedAt = now,
            Items = orderItems,
            StatusHistories =
            [
                new OrderStatusHistory
                {
                    OrderId = orderId,
                    FromStatus = null,
                    ToStatus = OrderConstants.StatusPendingPayment,
                    ChangedBy = buyerUserId,
                    Note = "Order created",
                    CreatedAt = now
                }
            ]
        };

        var paymentId = Guid.NewGuid();
        var payment = new Payment
        {
            PaymentId = paymentId,
            OrderId = orderId,
            Provider = OrderConstants.PaymentProviderPayOs,
            Amount = total,
            Currency = currency,
            Status = OrderConstants.PaymentStatusPending,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.Orders.Add(order);
        _db.Payments.Add(payment);

        if (appliedVoucher is not null)
        {
            appliedVoucher.UsedCount += 1;
            appliedVoucher.UpdatedAt = now;
            voucherUsageInCheckout[appliedVoucher.VoucherId] =
                voucherUsageInCheckout.GetValueOrDefault(appliedVoucher.VoucherId) + 1;

            _db.VoucherRedemptions.Add(new VoucherRedemption
            {
                RedemptionId = Guid.NewGuid(),
                VoucherId = appliedVoucher.VoucherId,
                UserId = buyerUserId,
                OrderId = orderId,
                DiscountAmount = discount,
                RedeemedAt = now
            });
        }

        await _db.SaveChangesAsync(cancellationToken);

        return new CreatedOrderDto
        {
            OrderId = orderId,
            OrderCode = orderCode,
            ShopId = shop.ShopId,
            ShopName = shop.ShopName,
            Status = OrderConstants.StatusPendingPayment,
            SubtotalAmount = subtotal,
            DiscountAmount = discount,
            ShippingFee = shippingFee,
            TotalAmount = total,
            Currency = currency,
            PaymentId = paymentId,
            PaymentStatus = OrderConstants.PaymentStatusPending,
            Items = itemDtos,
            CreatedAt = now
        };
    }

    private async Task<Voucher> ResolveAndValidateVoucherAsync(
        Guid voucherId,
        Guid buyerUserId,
        Guid shopId,
        decimal subtotal,
        Dictionary<Guid, int> voucherUsageInCheckout,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var voucher = await _db.Vouchers
            .FirstOrDefaultAsync(v => v.VoucherId == voucherId, cancellationToken)
            ?? throw new NotFoundException("Voucher not found.");

        if (!voucher.IsActive)
            throw new AppException("Voucher is not active.");

        if (now < voucher.StartsAt)
            throw new AppException("Voucher has not started yet.");

        if (now > voucher.EndsAt)
            throw new AppException("Voucher has expired.");

        if (string.Equals(voucher.Scope, VoucherConstants.ScopeShop, StringComparison.OrdinalIgnoreCase))
        {
            if (voucher.ShopId is null || voucher.ShopId.Value != shopId)
                throw new AppException("Shop voucher does not apply to this shop.");
        }
        else if (!string.Equals(voucher.Scope, VoucherConstants.ScopeSystem, StringComparison.OrdinalIgnoreCase))
        {
            throw new AppException("Voucher scope is invalid.");
        }

        var pendingInCheckout = voucherUsageInCheckout.GetValueOrDefault(voucher.VoucherId);
        if (voucher.UsageLimit is int usageLimit && voucher.UsedCount + pendingInCheckout >= usageLimit)
            throw new AppException("Voucher usage limit has been reached.");

        var userUsed = await _db.VoucherRedemptions
            .CountAsync(r => r.VoucherId == voucher.VoucherId && r.UserId == buyerUserId, cancellationToken);
        if (userUsed + pendingInCheckout >= voucher.PerUserLimit)
            throw new AppException("You have already used this voucher the maximum number of times.");

        if (subtotal < voucher.MinOrderAmount)
            throw new AppException($"Minimum order amount is {voucher.MinOrderAmount:0.##}.");

        return voucher;
    }

    private async Task<List<OrderItemLotAllocation>> AllocateLotsFifoAsync(
        Product product,
        string costingMethod,
        int quantity,
        Guid orderId,
        Guid orderItemId,
        Guid buyerUserId,
        CancellationToken cancellationToken)
    {
        var lots = await _db.InventoryLots
            .Where(l =>
                l.ProductId == product.ProductId &&
                l.Status == OrderConstants.LotStatusOpen &&
                l.QuantityRemaining > 0)
            .OrderBy(l => l.ReceivedAt)
            .ThenBy(l => l.CreatedAt)
            .ToListAsync(cancellationToken);

        // WeightedAverage still depletes physical lots FIFO; COGS uses AvgCostPrice on the line.
        _ = costingMethod;

        var remaining = quantity;
        var allocations = new List<OrderItemLotAllocation>();

        foreach (var lot in lots)
        {
            if (remaining == 0)
                break;

            var take = Math.Min(lot.QuantityRemaining, remaining);
            lot.QuantityRemaining -= take;
            if (lot.QuantityRemaining == 0)
                lot.Status = OrderConstants.LotStatusDepleted;

            allocations.Add(new OrderItemLotAllocation
            {
                AllocationId = Guid.NewGuid(),
                OrderItemId = orderItemId,
                LotId = lot.LotId,
                Quantity = take,
                UnitCostSnapshot = lot.UnitCost
            });

            _db.InventoryTransactions.Add(new InventoryTransaction
            {
                ProductId = product.ProductId,
                LotId = lot.LotId,
                ChangeQty = -take,
                UnitCost = lot.UnitCost,
                Reason = OrderConstants.InventoryReasonOrderReserve,
                ReferenceType = OrderConstants.InventoryReferenceTypeOrder,
                ReferenceId = orderId,
                Note = "Reserved for checkout",
                CreatedBy = buyerUserId,
                CreatedAt = DateTime.UtcNow
            });

            remaining -= take;
        }

        if (remaining > 0)
        {
            // StockQuantity is denormalised from the lots; when they disagree the product
            // was stocked without an inventory lot (see scripts/seed-inventory-lots.sql).
            _logger.LogWarning(
                "Lot allocation short for product {ProductId} ({ProductName}): needed {Needed}, lots hold {Allocated}, StockQuantity says {StockQuantity}",
                product.ProductId,
                product.Name,
                quantity,
                quantity - remaining,
                product.StockQuantity);

            throw new ConflictException(
                $"Insufficient stock for '{product.Name}'. Only {quantity - remaining} unit(s) are backed by inventory lots.");
        }

        return allocations;
    }

    private static decimal? ResolveUnitCostAvg(
        Product product,
        string costingMethod,
        IReadOnlyList<OrderItemLotAllocation> allocations)
    {
        if (allocations.Count == 0)
            return null;

        if (string.Equals(costingMethod, OrderConstants.CostingMethodWeightedAverage, StringComparison.OrdinalIgnoreCase)
            && product.AvgCostPrice is { } avgCost)
        {
            return decimal.Round(avgCost, 2, MidpointRounding.AwayFromZero);
        }

        var totalQty = allocations.Sum(a => a.Quantity);
        if (totalQty <= 0)
            return null;

        var totalCost = allocations.Sum(a => a.UnitCostSnapshot * a.Quantity);
        return decimal.Round(totalCost / totalQty, 2, MidpointRounding.AwayFromZero);
    }

    private async Task RecalcStockAsync(Product product, CancellationToken cancellationToken)
    {
        var tracked = _db.ChangeTracker.Entries<InventoryLot>()
            .Where(e => e.Entity.ProductId == product.ProductId && e.State != EntityState.Deleted)
            .Select(e => e.Entity)
            .ToList();
        var trackedIds = tracked.Select(l => l.LotId).ToHashSet();

        var others = await _db.InventoryLots
            .Where(l => l.ProductId == product.ProductId && !trackedIds.Contains(l.LotId))
            .ToListAsync(cancellationToken);

        var lots = tracked.Concat(others)
            .Where(l => l.Status != OrderConstants.LotStatusVoid)
            .ToList();

        var remaining = lots.Sum(l => l.QuantityRemaining);
        product.StockQuantity = remaining;
        product.AvgCostPrice = remaining == 0
            ? null
            : decimal.Round(
                lots.Sum(l => l.QuantityRemaining * l.UnitCost) / remaining,
                2,
                MidpointRounding.AwayFromZero);
        product.UpdatedAt = DateTime.UtcNow;
    }

    private async Task<string> GenerateUniqueOrderCodeAsync(DateTime now, CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 8; attempt++)
        {
            var code = $"ORD-{now:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}";
            if (code.Length > OrderConstants.MaxOrderCodeLength)
                code = code[..OrderConstants.MaxOrderCodeLength];

            var exists = await _db.Orders.AsNoTracking()
                .AnyAsync(o => o.OrderCode == code, cancellationToken);
            if (!exists)
                return code;
        }

        throw new AppException("Unable to generate a unique order code. Please try again.");
    }

    private static List<CartItem> SelectCartItems(Cart cart, IReadOnlyCollection<Guid>? cartItemIds)
    {
        if (cartItemIds is null || cartItemIds.Count == 0)
            return cart.Items.ToList();

        var idSet = cartItemIds.ToHashSet();
        var selected = cart.Items.Where(i => idSet.Contains(i.CartItemId)).ToList();
        if (selected.Count != idSet.Count)
            throw new NotFoundException("One or more cart items were not found.");

        return selected;
    }

    private static void ValidateCartItems(IReadOnlyList<CartItem> items)
    {
        foreach (var item in items)
        {
            if (item.Quantity < 1)
                throw new AppException("Cart item quantity must be at least 1.");

            EnsureProductPurchasable(item.Product, item.Product.Category.IsActive, item.Product.Shop);
        }
    }

    private static void EnsureProductPurchasable(Product product, bool categoryIsActive, Shop shop)
    {
        if (!string.Equals(product.Status, OrderConstants.ApprovedProductStatus, StringComparison.OrdinalIgnoreCase))
            throw new AppException($"Product '{product.Name}' is not available for purchase.");

        if (!categoryIsActive)
            throw new AppException($"Product '{product.Name}' category is not active.");

        if (!string.Equals(shop.Status, OrderConstants.ActiveShopStatus, StringComparison.OrdinalIgnoreCase))
            throw new AppException($"Shop '{shop.ShopName}' is not available.");
    }

    private static string BuildShippingSnapshotJson(Address address)
    {
        var snapshot = new
        {
            addressId = address.AddressId,
            receiverName = address.ReceiverName,
            phone = address.Phone,
            province = address.Province,
            district = address.District,
            ward = address.Ward,
            streetAddress = address.StreetAddress
        };

        return JsonSerializer.Serialize(snapshot, SnapshotJsonOptions);
    }
}
