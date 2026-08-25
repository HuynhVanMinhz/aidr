using AIDR.Api.Extensions;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class ReviewsController : ControllerBase
{
    private readonly IProductReviewService _reviews;

    public ReviewsController(IProductReviewService reviews) => _reviews = reviews;

    /// <summary>List visible product reviews (paged), newest first. Guests allowed.</summary>
    [HttpGet("products/{productId:guid}/reviews")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<ProductReviewListResult>>> List(
        Guid productId,
        [FromQuery] ProductReviewListQuery query,
        CancellationToken cancellationToken)
    {
        Guid? viewerId = User.TryGetUserId(out var userId) ? userId : null;
        var result = await _reviews.ListAsync(productId, query, viewerId, cancellationToken);
        return Ok(ApiResult<ProductReviewListResult>.Ok(result));
    }

    /// <summary>Add a product review after a completed purchase (unique per buyer + product + order).</summary>
    [HttpPost("products/{productId:guid}/reviews")]
    [Authorize(Policy = "Buyer")]
    public async Task<ActionResult<ApiResult<ProductReviewDto>>> Create(
        Guid productId,
        [FromBody] CreateProductReviewRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _reviews.CreateAsync(User.GetUserId(), productId, request, cancellationToken);
        return Ok(ApiResult<ProductReviewDto>.Ok(result, "Review submitted."));
    }

    /// <summary>Update own product review within the edit window.</summary>
    [HttpPut("reviews/{reviewId:guid}")]
    [Authorize(Policy = "Buyer")]
    public async Task<ActionResult<ApiResult<ProductReviewDto>>> Update(
        Guid reviewId,
        [FromBody] UpdateProductReviewRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _reviews.UpdateAsync(User.GetUserId(), reviewId, request, cancellationToken);
        return Ok(ApiResult<ProductReviewDto>.Ok(result, "Review updated."));
    }

    /// <summary>Hide own product review (soft delete).</summary>
    [HttpDelete("reviews/{reviewId:guid}")]
    [Authorize(Policy = "Buyer")]
    public async Task<ActionResult<ApiResult<object?>>> Delete(
        Guid reviewId,
        CancellationToken cancellationToken)
    {
        await _reviews.DeleteAsync(User.GetUserId(), reviewId, cancellationToken);
        return Ok(ApiResult<object?>.Ok(null, "Review removed."));
    }
}
