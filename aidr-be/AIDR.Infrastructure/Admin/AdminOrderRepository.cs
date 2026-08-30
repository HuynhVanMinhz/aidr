using AIDR.Infrastructure.Persistence;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Dtos.Admin;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Admin;

public sealed class AdminOrderRepository : IAdminOrderRepository
{
    private readonly AidrDbContext _db;

    public AdminOrderRepository(AidrDbContext db) => _db = db;

    public async Task<(IReadOnlyList<AdminOrderListItemDto> Items, int TotalCount, int EffectivePage)>
        ListPagedAsync(
            string? status,
            string? keyword,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default)
    {
        var query = _db.Orders.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(o => o.Status == status);

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var term = keyword.Trim();
            query = query.Where(o =>
                o.OrderCode.Contains(term) ||
                o.Buyer.Email.Contains(term) ||
                o.Buyer.FullName.Contains(term) ||
                o.Shop.ShopName.Contains(term));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = pageSize <= 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);
        var effectivePage = totalPages == 0 ? 1 : Math.Min(page, totalPages);

        var items = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((effectivePage - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new AdminOrderListItemDto
            {
                OrderId = o.OrderId,
                OrderCode = o.OrderCode,
                BuyerUserId = o.BuyerUserId,
                BuyerEmail = o.Buyer.Email,
                BuyerName = o.Buyer.FullName,
                ShopId = o.ShopId,
                ShopName = o.Shop.ShopName,
                Status = o.Status,
                TotalAmount = o.TotalAmount,
                Currency = o.Currency,
                CreatedAt = o.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return (items, totalCount, effectivePage);
    }

    public async Task<AdminOrderDetailDto?> GetByIdAsync(
        Guid orderId,
        CancellationToken cancellationToken = default)
    {
        var order = await _db.Orders.AsNoTracking()
            .Include(o => o.Buyer)
            .Include(o => o.Shop)
            .Include(o => o.Items)
            .Include(o => o.StatusHistories)
            .FirstOrDefaultAsync(o => o.OrderId == orderId, cancellationToken);

        if (order is null)
            return null;

        return new AdminOrderDetailDto
        {
            OrderId = order.OrderId,
            OrderCode = order.OrderCode,
            BuyerUserId = order.BuyerUserId,
            BuyerEmail = order.Buyer.Email,
            BuyerName = order.Buyer.FullName,
            BuyerPhone = order.Buyer.Phone,
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
            ItemCount = order.Items.Sum(i => i.Quantity),
            CreatedAt = order.CreatedAt,
            UpdatedAt = order.UpdatedAt,
            PaidAt = order.PaidAt,
            CancelledAt = order.CancelledAt,
            DeliveredAt = order.DeliveredAt,
            CompletedAt = order.CompletedAt,
            Items = order.Items
                .OrderBy(i => i.OrderItemId)
                .Select(i => new AdminOrderItemDto
                {
                    OrderItemId = i.OrderItemId,
                    ProductId = i.ProductId,
                    ProductName = i.ProductNameSnapshot,
                    Sku = i.SkuSnapshot,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice,
                    LineTotal = i.LineTotal
                })
                .ToList(),
            StatusHistory = order.StatusHistories
                .OrderBy(h => h.CreatedAt)
                .ThenBy(h => h.HistoryId)
                .Select(h => new AdminOrderStatusHistoryDto
                {
                    FromStatus = h.FromStatus,
                    ToStatus = h.ToStatus,
                    Note = h.Note,
                    CreatedAt = h.CreatedAt
                })
                .ToList()
        };
    }
}
