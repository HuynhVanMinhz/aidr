using AIDR.Shared.Dtos.Discovery;

namespace AIDR.Modules.Discovery.Abstractions;

public interface IShopTrustBadgeRepository
{
    Task<bool> HasPassedKycAsync(Guid ownerUserId, CancellationToken cancellationToken = default);

    Task<(int Total, int FastCount)> GetFastShippingStatsAsync(
        Guid shopId,
        int windowDays,
        int maxDeliveryDays,
        CancellationToken cancellationToken = default);
}

public interface IShopTrustBadgeService
{
    Task<IReadOnlyList<ShopTrustBadgeDto>> ComputeAsync(
        Guid shopId,
        Guid ownerUserId,
        decimal avgRating,
        int ratingCount,
        CancellationToken cancellationToken = default);
}
