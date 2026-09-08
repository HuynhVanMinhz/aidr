using AIDR.Infrastructure.Persistence;
using AIDR.Modules.Discovery.Abstractions;
using AIDR.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Discovery;

public sealed class ShopTrustBadgeRepository : IShopTrustBadgeRepository
{
    private readonly AidrDbContext _db;

    public ShopTrustBadgeRepository(AidrDbContext db) => _db = db;

    public Task<bool> HasPassedKycAsync(Guid ownerUserId, CancellationToken cancellationToken = default)
        => _db.KycVerifications.AsNoTracking()
            .AnyAsync(
                k => k.UserId == ownerUserId && k.Status == KycConstants.StatusPassed,
                cancellationToken);

    public async Task<(int Total, int FastCount)> GetFastShippingStatsAsync(
        Guid shopId,
        int windowDays,
        int maxDeliveryDays,
        CancellationToken cancellationToken = default)
    {
        var cutoff = DateTime.UtcNow.AddDays(-windowDays);

        var delivered = await _db.Orders.AsNoTracking()
            .Where(o => o.ShopId == shopId
                        && o.DeliveredAt != null
                        && o.DeliveredAt >= cutoff
                        && (o.Status == OrderConstants.StatusDelivered
                            || o.Status == OrderConstants.StatusCompleted))
            .Select(o => new { o.CreatedAt, o.DeliveredAt })
            .ToListAsync(cancellationToken);

        if (delivered.Count == 0)
            return (0, 0);

        var fastCount = delivered.Count(o =>
            o.DeliveredAt!.Value <= o.CreatedAt.AddDays(maxDeliveryDays));

        return (delivered.Count, fastCount);
    }
}
