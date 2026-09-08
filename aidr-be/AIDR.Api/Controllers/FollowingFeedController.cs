using AIDR.Api.Extensions;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/following")]
[Authorize(Policy = "Buyer")]
public sealed class FollowingFeedController : ControllerBase
{
    private readonly IFollowFeedService _feed;

    public FollowingFeedController(IFollowFeedService feed) => _feed = feed;

    /// <summary>Timeline of new products and active vouchers from shops the buyer follows.</summary>
    [HttpGet("feed")]
    public async Task<ActionResult<ApiResult<FollowFeedResultDto>>> Feed(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _feed.GetFeedAsync(User.GetUserId(), page, pageSize, cancellationToken);
        return Ok(ApiResult<FollowFeedResultDto>.Ok(result));
    }
}
