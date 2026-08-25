using AIDR.Infrastructure.Persistence;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Admin;

public sealed class AdminCustomerInsightRepository : IAdminCustomerInsightRepository
{
    private readonly AidrDbContext _db;

    public AdminCustomerInsightRepository(AidrDbContext db) => _db = db;

    public async Task<AdminInsightPlatformSnapshot> GetPlatformSnapshotAsync(
        CancellationToken cancellationToken = default)
    {
        var totalUsers = await _db.Users.AsNoTracking().CountAsync(cancellationToken);
        var activeUsers = await _db.Users.AsNoTracking()
            .CountAsync(u => u.Status == AdminConstants.UserStatusActive, cancellationToken);
        var lockedUsers = await _db.Users.AsNoTracking()
            .CountAsync(u => u.Status == AdminConstants.UserStatusLocked, cancellationToken);

        return new AdminInsightPlatformSnapshot
        {
            TotalUsers = totalUsers,
            ActiveUsers = activeUsers,
            LockedUsers = lockedUsers
        };
    }

    public async Task<IReadOnlyList<AdminInsightUserRegistration>> GetRegistrationsAsync(
        DateTime fromUtc,
        DateTime toExclusiveUtc,
        CancellationToken cancellationToken = default)
    {
        return await _db.Users.AsNoTracking()
            .Where(u => u.CreatedAt >= fromUtc && u.CreatedAt < toExclusiveUtc)
            .Select(u => new AdminInsightUserRegistration
            {
                UserId = u.UserId,
                CreatedAt = u.CreatedAt
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<(IReadOnlyList<AdminInsightSalesOrder> Orders, IReadOnlyList<AdminInsightSalesLine> Lines)>
        GetSalesAsync(
            DateTime fromUtc,
            DateTime toExclusiveUtc,
            CancellationToken cancellationToken = default)
    {
        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.PaidAt != null
                        && o.PaidAt >= fromUtc
                        && o.PaidAt < toExclusiveUtc
                        && AdminConstants.InsightSalesOrderStatuses.Contains(o.Status))
            .Select(o => new AdminInsightSalesOrder
            {
                OrderId = o.OrderId,
                BuyerUserId = o.BuyerUserId,
                PaidAt = o.PaidAt!.Value,
                TotalAmount = o.TotalAmount
            })
            .ToListAsync(cancellationToken);

        var lines = await _db.OrderItems.AsNoTracking()
            .Where(i => i.Order.PaidAt != null
                        && i.Order.PaidAt >= fromUtc
                        && i.Order.PaidAt < toExclusiveUtc
                        && AdminConstants.InsightSalesOrderStatuses.Contains(i.Order.Status))
            .Select(i => new AdminInsightSalesLine
            {
                OrderId = i.OrderId,
                ProductId = i.ProductId,
                ProductName = i.ProductNameSnapshot,
                PaidAt = i.Order.PaidAt!.Value,
                Quantity = i.Quantity,
                LineTotal = i.LineTotal
            })
            .ToListAsync(cancellationToken);

        return (orders, lines);
    }

    public async Task<IReadOnlyList<AdminInsightBuyerFirstPaidOrder>> GetBuyerFirstPaidOrdersAsync(
        IReadOnlyCollection<Guid> buyerUserIds,
        CancellationToken cancellationToken = default)
    {
        if (buyerUserIds.Count == 0)
            return Array.Empty<AdminInsightBuyerFirstPaidOrder>();

        return await _db.Orders.AsNoTracking()
            .Where(o => buyerUserIds.Contains(o.BuyerUserId)
                        && o.PaidAt != null
                        && AdminConstants.InsightSalesOrderStatuses.Contains(o.Status))
            .GroupBy(o => o.BuyerUserId)
            .Select(g => new AdminInsightBuyerFirstPaidOrder
            {
                BuyerUserId = g.Key,
                FirstPaidAt = g.Min(o => o.PaidAt!.Value)
            })
            .ToListAsync(cancellationToken);
    }
}
