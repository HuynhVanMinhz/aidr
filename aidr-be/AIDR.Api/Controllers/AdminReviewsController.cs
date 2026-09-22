using AIDR.Api.Extensions;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/admin/reviews")]
[Authorize(Policy = "Admin")]
public sealed class AdminReviewsController : ControllerBase
{
    private readonly IProductReviewService _reviews;

    public AdminReviewsController(IProductReviewService reviews) => _reviews = reviews;

    /// <summary>List PendingTrust / Reported product reviews for moderation.</summary>
    [HttpGet("moderation")]
    public async Task<ActionResult<ApiResult<AdminReviewModerationListResult>>> ListModeration(
        [FromQuery] AdminReviewModerationListQuery query,
        CancellationToken cancellationToken)
    {
        var result = await _reviews.ListModerationQueueAsync(query, cancellationToken);
        return Ok(ApiResult<AdminReviewModerationListResult>.Ok(result));
    }

    /// <summary>Approve a review (restore CountsTowardRating, dismiss open reports).</summary>
    [HttpPost("{reviewId:guid}/approve")]
    public async Task<ActionResult<ApiResult<object?>>> Approve(
        Guid reviewId,
        CancellationToken cancellationToken)
    {
        await _reviews.ApproveModerationAsync(User.GetUserId(), reviewId, cancellationToken);
        return Ok(ApiResult<object?>.Ok(null, "Review approved."));
    }

    /// <summary>Hide a review for abuse (upholds open reports).</summary>
    [HttpPost("{reviewId:guid}/hide")]
    public async Task<ActionResult<ApiResult<object?>>> Hide(
        Guid reviewId,
        CancellationToken cancellationToken)
    {
        await _reviews.HideByAdminAsync(User.GetUserId(), reviewId, cancellationToken);
        return Ok(ApiResult<object?>.Ok(null, "Review hidden."));
    }
}
