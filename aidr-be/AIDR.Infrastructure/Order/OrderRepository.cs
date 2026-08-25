using System.Text.Json;
using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Ordering;

public sealed class OrderRepository : IOrderRepository
{
    private static readonly JsonSerializerOptions SnapshotJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly AidrDbContext _db;

    public OrderRepository(AidrDbContext db) => _db = db;

    public async Task<CreateOrderResponse> CreateOrdersFromCartAsync(
        Guid buyerUserId,
        Guid shippingAddressId,
        IReadOnlyCollection<Guid>? cartItemIds,
        string? buyerNote,
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

        var shippingSnapshotJson = BuildShippingSnapshotJson(address);
        var now = DateTime.UtcNow;
        var createdOrders = new List<CreatedOrderDto>();

        foreach (var shopGroup in selectedItems.GroupBy(i => i.Product.ShopId))
        {
            var shop = shopGroup.First().Product.Shop;
            var order = await CreateShopOrderAsync(
                buyerUserId,
                shop,
                shopGroup.ToList(),
                address.AddressId,
                shippingSnapshotJson,
                buyerNote,
                now,
                cancellationToken);

            createdOrders.Add(order);
        }

        _db.CartItems.RemoveRange(selectedItems);
        cart.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var currency = createdOrders.FirstOrDefault()?.Currency ?? "VND";
        return new CreateOrderResponse
        {
            Orders = createdOrders,
            OrderCount = createdOrders.Count,
            GrandTotal = createdOrders.Sum(o => o.TotalAmount),
            Currency = currency
        };
    }

    private async Task<CreatedOrderDto> CreateShopOrderAsync(
        Guid buyerUserId,
        Shop shop,
        List<CartItem> items,
        Guid shippingAddressId,
        string shippingSnapshotJson,
        string? buyerNote,
        DateTime now,
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
            itemDtos.Add(new CreatedOrderItemDto
            {
                OrderItemId = orderItemId,
                ProductId = product.ProductId,
                ProductName = product.Name,
                Quantity = cartItem.Quantity,
                UnitPrice = unitPrice,
                UnitCostAvg = unitCostAvg,
                LineTotal = lineTotal
            });

            subtotal += lineTotal;
            await RecalcStockAsync(product, cancellationToken);
        }

        subtotal = decimal.Round(subtotal, 2, MidpointRounding.AwayFromZero);
        var discount = OrderConstants.DefaultDiscountAmount;
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
            throw new ConflictException($"Insufficient stock for '{product.Name}'.");

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
