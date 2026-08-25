using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;

namespace AIDR.Modules.Engagement.Abstractions;

public sealed class FollowableShopSnapshot
{
    public Guid ShopId { get; init; }
    public Guid OwnerUserId { get; init; }
    public string ShopName { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string Status { get; init; } = null!;
}

public interface IFollowRepository
{
    Task<PagedResult<FollowedShopDto>> ListAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<FollowableShopSnapshot?> GetFollowableShopAsync(
        Guid shopId,
        CancellationToken cancellationToken = default);

    Task<bool> IsFollowingAsync(
        Guid userId,
        Guid shopId,
        CancellationToken cancellationToken = default);

    Task<FollowedShopDto> FollowAsync(
        Guid userId,
        Guid shopId,
        CancellationToken cancellationToken = default);

    Task<UnfollowShopResponse> UnfollowAsync(
        Guid userId,
        Guid shopId,
        CancellationToken cancellationToken = default);
}
