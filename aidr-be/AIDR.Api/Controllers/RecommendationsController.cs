using AIDR.Api.Extensions;
using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/recommendations")]
[AllowAnonymous]
public sealed class RecommendationsController : ControllerBase
{
    private readonly IRecommendationService _recommendations;

    public RecommendationsController(IRecommendationService recommendations)
        => _recommendations = recommendations;

    /// <summary>Hybrid product recommendations (personalized when authenticated; popular fallback for guests).</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<PagedResult<RecommendedProductDto>>>> List(
        [FromQuery] RecommendationQueryRequest request,
        CancellationToken cancellationToken)
    {
        Guid? userId = null;
        if (User.Identity?.IsAuthenticated == true && User.TryGetUserId(out var id))
            userId = id;

        var result = await _recommendations.GetRecommendationsAsync(userId, request, cancellationToken);
        return Ok(ApiResult<PagedResult<RecommendedProductDto>>.Ok(result));
    }
}
