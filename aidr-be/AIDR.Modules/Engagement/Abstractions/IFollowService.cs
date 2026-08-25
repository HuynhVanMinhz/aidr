using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;

namespace AIDR.Modules.Engagement.Abstractions;

public interface IFollowService
{
    Task<PagedResult<FollowedShopDto>> ListAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<FollowedShopDto> FollowAsync(
        Guid userId,
        FollowShopRequest request,
        CancellationToken cancellationToken = default);

    Task<UnfollowShopResponse> UnfollowAsync(
        Guid userId,
        Guid shopId,
        CancellationToken cancellationToken = default);
}
