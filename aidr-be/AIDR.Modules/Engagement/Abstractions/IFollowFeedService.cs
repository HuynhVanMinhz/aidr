using AIDR.Shared.Dtos.Engagement;

namespace AIDR.Modules.Engagement.Abstractions;

public interface IFollowFeedRepository
{
    Task<FollowFeedResultDto> GetFeedAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}

public interface IFollowFeedService
{
    Task<FollowFeedResultDto> GetFeedAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}
