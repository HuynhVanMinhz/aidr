using AIDR.Modules.Discovery.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Discovery;

namespace AIDR.Modules.Discovery.Services;

public sealed class ShopTrustBadgeService : IShopTrustBadgeService
{
    private readonly IShopTrustBadgeRepository _badges;

    public ShopTrustBadgeService(IShopTrustBadgeRepository badges) => _badges = badges;

    public async Task<IReadOnlyList<ShopTrustBadgeDto>> ComputeAsync(
        Guid shopId,
        Guid ownerUserId,
        decimal avgRating,
        int ratingCount,
        CancellationToken cancellationToken = default)
    {
        var result = new List<ShopTrustBadgeDto>();

        if (await _badges.HasPassedKycAsync(ownerUserId, cancellationToken))
        {
            result.Add(new ShopTrustBadgeDto
            {
                Code = ShopTrustBadgeConstants.VerifiedIdentity,
                Label = "Verified identity",
                Description = "Seller identity verified through eKYC."
            });
        }

        if (avgRating >= ShopTrustBadgeConstants.TopRatedMinAvg
            && ratingCount >= ShopTrustBadgeConstants.TopRatedMinCount)
        {
            result.Add(new ShopTrustBadgeDto
            {
                Code = ShopTrustBadgeConstants.TopRated,
                Label = "Top rated",
                Description = $"Average rating {avgRating:0.0} from {ratingCount} reviews."
            });
        }

        var (total, fastCount) = await _badges.GetFastShippingStatsAsync(
            shopId,
            ShopTrustBadgeConstants.FastShippingWindowDays,
            ShopTrustBadgeConstants.FastShippingMaxDays,
            cancellationToken);

        if (total > 0
            && (double)fastCount / total >= ShopTrustBadgeConstants.FastShippingMinRate)
        {
            result.Add(new ShopTrustBadgeDto
            {
                Code = ShopTrustBadgeConstants.FastShipping,
                Label = "Fast shipping",
                Description =
                    $"At least {ShopTrustBadgeConstants.FastShippingMinRate:P0} of recent orders delivered within {ShopTrustBadgeConstants.FastShippingMaxDays} days."
            });
        }

        return result;
    }
}
