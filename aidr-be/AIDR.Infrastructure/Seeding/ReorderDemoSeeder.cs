using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Seeding;

public static class ReorderDemoSeeder
{
    public static async Task<(Guid OrderId, int ItemCount)> SeedAsync(
        AidrDbContext db,
        CancellationToken ct = default)
    {
        var buyerId = DemoAccountsSeeder.BuyerId;
        var shopId = DemoAccountsSeeder.ShopId;

        var existing = await db.Orders.AsNoTracking()
            .Where(o => o.BuyerUserId == buyerId
                        && o.Status == OrderConstants.StatusCompleted
                        && o.OrderCode.StartsWith("REORDER-DEMO"))
            .Select(o => new { o.OrderId, ItemCount = o.Items.Count })
            .FirstOrDefaultAsync(ct);

        if (existing is not null)
            return (existing.OrderId, existing.ItemCount);

        var product = await db.Products.AsNoTracking()
            .Where(p => p.ShopId == shopId && p.Status == OrderConstants.ApprovedProductStatus)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new { p.ProductId, p.Name, p.Slug, p.BasePrice, p.SalePrice })
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("No approved product for reorder demo. Run catalog seed first.");

        var now = DateTime.UtcNow;
        var orderId = Guid.Parse("E5555555-5555-5555-5555-555555555555");
        var orderItemId = Guid.Parse("E6666666-6666-6666-6666-666666666666");
        var unitPrice = product.SalePrice ?? product.BasePrice;

        var order = new Order
        {
            OrderId = orderId,
            OrderCode = "REORDER-DEMO-001",
            BuyerUserId = buyerId,
            ShopId = shopId,
            Status = OrderConstants.StatusCompleted,
            SubtotalAmount = unitPrice,
            DiscountAmount = 0,
            ShippingFee = 0,
            TotalAmount = unitPrice,
            Currency = "VND",
            ShippingSnapshotJson = "{}",
            CreatedAt = now.AddDays(-14),
            UpdatedAt = now.AddDays(-7),
            PaidAt = now.AddDays(-14),
            DeliveredAt = now.AddDays(-8),
            CompletedAt = now.AddDays(-7)
        };

        order.Items.Add(new OrderItem
        {
            OrderItemId = orderItemId,
            OrderId = orderId,
            ProductId = product.ProductId,
            ProductNameSnapshot = product.Name,
            UnitPrice = unitPrice,
            Quantity = 1,
            LineTotal = unitPrice
        });

        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);

        return (orderId, 1);
    }
}
