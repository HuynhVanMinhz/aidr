using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Engagement;

namespace AIDR.Modules.Engagement.Services;

public sealed class FollowFeedService : IFollowFeedService
{
    private readonly IFollowFeedRepository _feed;

    public FollowFeedService(IFollowFeedRepository feed) => _feed = feed;

    public Task<FollowFeedResultDto> GetFeedAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var (normalizedPage, normalizedSize) = FollowFeedConstants.NormalizePaging(page, pageSize);
        return _feed.GetFeedAsync(userId, normalizedPage, normalizedSize, cancellationToken);
    }
}
