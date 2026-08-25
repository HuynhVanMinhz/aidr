using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Caching;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Engagement.Services;

public sealed class FollowService : IFollowService
{
    private readonly IFollowRepository _follows;
    private readonly ICacheService _cache;

    public FollowService(IFollowRepository follows, ICacheService cache)
    {
        _follows = follows;
        _cache = cache;
    }

    public Task<PagedResult<FollowedShopDto>> ListAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var (normalizedPage, normalizedSize) = FollowConstants.NormalizePaging(page, pageSize);
        return _follows.ListAsync(userId, normalizedPage, normalizedSize, cancellationToken);
    }

    public async Task<FollowedShopDto> FollowAsync(
        Guid userId,
        FollowShopRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.ShopId == Guid.Empty)
            throw new AppException("Shop id is required.");

        var shop = await _follows.GetFollowableShopAsync(request.ShopId, cancellationToken)
            ?? throw new NotFoundException("Shop not found.");

        EnsureFollowable(userId, shop);

        if (await _follows.IsFollowingAsync(userId, shop.ShopId, cancellationToken))
            throw new ConflictException("You are already following this shop.");

        var followed = await _follows.FollowAsync(userId, shop.ShopId, cancellationToken);
        await InvalidateShopCacheAsync(shop.ShopId, shop.Slug, cancellationToken);
        return followed;
    }

    public async Task<UnfollowShopResponse> UnfollowAsync(
        Guid userId,
        Guid shopId,
        CancellationToken cancellationToken = default)
    {
        if (shopId == Guid.Empty)
            throw new AppException("Shop id is required.");

        var shop = await _follows.GetFollowableShopAsync(shopId, cancellationToken);
        var response = await _follows.UnfollowAsync(userId, shopId, cancellationToken);

        if (shop is not null)
            await InvalidateShopCacheAsync(shop.ShopId, shop.Slug, cancellationToken);

        return response;
    }

    private static void EnsureFollowable(Guid userId, FollowableShopSnapshot shop)
    {
        if (!string.Equals(shop.Status, FollowConstants.ActiveShopStatus, StringComparison.OrdinalIgnoreCase))
            throw new AppException("Shop is not available.");

        if (shop.OwnerUserId == userId)
            throw new AppException("You cannot follow your own shop.");
    }

    private async Task InvalidateShopCacheAsync(
        Guid shopId,
        string slug,
        CancellationToken cancellationToken)
    {
        await _cache.RemoveAsync($"shop:rating:{shopId:D}", cancellationToken);
        if (!string.IsNullOrWhiteSpace(slug))
            await _cache.RemoveAsync($"shop:rating:{slug.Trim().ToLowerInvariant()}", cancellationToken);
    }
}
