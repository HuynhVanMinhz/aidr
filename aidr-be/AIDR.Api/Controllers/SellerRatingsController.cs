using AIDR.Api.Extensions;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/seller-ratings")]
[Authorize(Policy = "Buyer")]
public sealed class SellerRatingsController : ControllerBase
{
    private readonly ISellerRatingService _ratings;

    public SellerRatingsController(ISellerRatingService ratings) => _ratings = ratings;

    /// <summary>Rate a shop after a completed order (unique per buyer + shop + order).</summary>
    [HttpPost]
    public async Task<ActionResult<ApiResult<SellerRatingDto>>> Create(
        [FromBody] CreateSellerRatingRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _ratings.CreateAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<SellerRatingDto>.Ok(result, "Seller rating submitted."));
    }
}
