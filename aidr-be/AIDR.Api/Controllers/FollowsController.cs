using AIDR.Api.Extensions;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/follows")]
[Authorize(Policy = "Buyer")]
public sealed class FollowsController : ControllerBase
{
    private readonly IFollowService _follows;

    public FollowsController(IFollowService follows) => _follows = follows;

    /// <summary>List shops the current buyer follows, newest first (paged).</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<PagedResult<FollowedShopDto>>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _follows.ListAsync(User.GetUserId(), page, pageSize, cancellationToken);
        return Ok(ApiResult<PagedResult<FollowedShopDto>>.Ok(result));
    }

    /// <summary>Follow an active shop (unique per buyer + shop).</summary>
    [HttpPost("shops")]
    public async Task<ActionResult<ApiResult<FollowedShopDto>>> FollowShop(
        [FromBody] FollowShopRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _follows.FollowAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<FollowedShopDto>.Ok(result, "Shop followed."));
    }

    /// <summary>Unfollow a shop.</summary>
    [HttpDelete("shops/{shopId:guid}")]
    public async Task<ActionResult<ApiResult<UnfollowShopResponse>>> UnfollowShop(
        Guid shopId,
        CancellationToken cancellationToken)
    {
        var result = await _follows.UnfollowAsync(User.GetUserId(), shopId, cancellationToken);
        return Ok(ApiResult<UnfollowShopResponse>.Ok(result, "Shop unfollowed."));
    }
}
