using System.Text.Json;
using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.SellerCenter;

public sealed class SellerOrderRepository : ISellerOrderRepository
{
    private readonly AidrDbContext _db;

    public SellerOrderRepository(AidrDbContext db) => _db = db;

    public async Task<(IReadOnlyList<SellerOrderListItemDto> Items, int TotalCount, int EffectivePage)> ListByShopAsync(
        Guid shopId,
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Orders.AsNoTracking()
            .Where(o => o.ShopId == shopId);

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
                o.BuyerUserId,
                BuyerName = o.Buyer.FullName,
                BuyerPhone = o.Buyer.Phone,
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

        var items = rows.Select(o =>
        {
            var (canUpdate, nextStatus) = ResolveNextStatus(o.Status);
            return new SellerOrderListItemDto
            {
                OrderId = o.OrderId,
                OrderCode = o.OrderCode,
                BuyerUserId = o.BuyerUserId,
                BuyerName = o.BuyerName,
                BuyerPhone = o.BuyerPhone,
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
                CompletedAt = o.CompletedAt,
                CanUpdateStatus = canUpdate,
                NextStatus = nextStatus
            };
        }).ToList();

        return (items, totalCount, effectivePage);
    }

    public async Task<SellerOrderDetailDto?> GetByIdForShopAsync(
        Guid shopId,
        Guid orderId,
        CancellationToken cancellationToken = default)
    {
        var order = await _db.Orders.AsNoTracking()
            .Include(o => o.Buyer)
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
                    .ThenInclude(p => p.Images)
            .Include(o => o.Payments)
            .Include(o => o.StatusHistories)
            .FirstOrDefaultAsync(
                o => o.OrderId == orderId && o.ShopId == shopId,
                cancellationToken);

        return order is null ? null : MapDetail(order);
    }

    public async Task<SellerOrderDetailDto> UpdateStatusAsync(
        Guid shopId,
        Guid orderId,
        Guid sellerUserId,
        string toStatus,
        string? trackingCode,
        string? sellerNote,
        string? historyNote,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var order = await _db.Orders
            .Include(o => o.Buyer)
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
                    .ThenInclude(p => p.Images)
            .Include(o => o.Payments)
            .Include(o => o.StatusHistories)
            .FirstOrDefaultAsync(
                o => o.OrderId == orderId && o.ShopId == shopId,
                cancellationToken)
            ?? throw new NotFoundException("Order not found.");

        if (!OrderConstants.SellerStatusTransitions.TryGetValue(order.Status, out var expectedNext) ||
            !string.Equals(expectedNext, toStatus, StringComparison.OrdinalIgnoreCase))
        {
            var allowed = OrderConstants.SellerStatusTransitions.TryGetValue(order.Status, out var next)
                ? $"Expected next status is {next}."
                : "This order status cannot be updated by the seller.";
            throw new ConflictException(
                $"Invalid status transition from {order.Status} to {toStatus}. {allowed}");
        }

        var effectiveTracking = trackingCode ?? order.TrackingCode;
        if (string.Equals(toStatus, OrderConstants.StatusShipping, StringComparison.OrdinalIgnoreCase) &&
            string.IsNullOrWhiteSpace(effectiveTracking))
        {
            throw new AppException("Tracking code is required when marking an order as Shipping.");
        }

        var now = DateTime.UtcNow;
        var fromStatus = order.Status;

        order.Status = toStatus;
        order.UpdatedAt = now;

        if (trackingCode is not null)
            order.TrackingCode = trackingCode;

        if (sellerNote is not null)
            order.SellerNote = sellerNote;

        if (string.Equals(toStatus, OrderConstants.StatusDelivered, StringComparison.OrdinalIgnoreCase))
            order.DeliveredAt = now;

        var history = new OrderStatusHistory
        {
            OrderId = order.OrderId,
            FromStatus = fromStatus,
            ToStatus = toStatus,
            ChangedBy = sellerUserId,
            Note = historyNote ?? BuildDefaultHistoryNote(fromStatus, toStatus),
            CreatedAt = now
        };
        order.StatusHistories.Add(history);

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return MapDetail(order);
    }

    private static SellerOrderDetailDto MapDetail(Order order)
    {
        var (canUpdate, nextStatus) = ResolveNextStatus(order.Status);

        var payment = order.Payments
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefault();

        var histories = order.StatusHistories
            .OrderBy(h => h.CreatedAt)
            .ThenBy(h => h.HistoryId)
            .Select(h => new SellerOrderStatusHistoryDto
            {
                FromStatus = h.FromStatus,
                ToStatus = h.ToStatus,
                Note = h.Note,
                CreatedAt = h.CreatedAt
            })
            .ToList();

        var items = order.Items
            .OrderBy(i => i.OrderItemId)
            .Select(i => new SellerOrderItemDto
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

        return new SellerOrderDetailDto
        {
            OrderId = order.OrderId,
            OrderCode = order.OrderCode,
            ShopId = order.ShopId,
            BuyerUserId = order.BuyerUserId,
            BuyerName = order.Buyer.FullName,
            BuyerEmail = order.Buyer.Email,
            BuyerPhone = order.Buyer.Phone,
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
                : new SellerOrderPaymentDto
                {
                    PaymentId = payment.PaymentId,
                    Provider = payment.Provider,
                    Status = payment.Status,
                    Amount = payment.Amount,
                    Currency = payment.Currency,
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
            CanUpdateStatus = canUpdate,
            NextStatus = nextStatus
        };
    }

    private static (bool CanUpdate, string? NextStatus) ResolveNextStatus(string status)
    {
        if (OrderConstants.SellerStatusTransitions.TryGetValue(status, out var next))
            return (true, next);
        return (false, null);
    }

    private static string BuildDefaultHistoryNote(string fromStatus, string toStatus) =>
        $"Seller updated status from {fromStatus} to {toStatus}";

    private static SellerOrderShippingDto ParseShippingSnapshot(string snapshotJson, Guid? shippingAddressId)
    {
        try
        {
            using var doc = JsonDocument.Parse(snapshotJson);
            var root = doc.RootElement;
            return new SellerOrderShippingDto
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
            return new SellerOrderShippingDto
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

        if (value.ValueKind == JsonValueKind.String && Guid.TryParse(value.GetString(), out var parsed))
            return parsed;

        return null;
    }
}
