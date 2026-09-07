using AIDR.Api.Extensions;
using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/seller/ai")]
[Authorize(Policy = "Seller")]
public sealed class SellerAiAnalyticsController : ControllerBase
{
    private readonly IAiAnalyticsService _analytics;

    public SellerAiAnalyticsController(IAiAnalyticsService analytics) => _analytics = analytics;

    /// <summary>AI-generated shop analytics brief from sales, inventory, and fulfillment KPIs.</summary>
    [HttpGet("analytics-brief")]
    public async Task<ActionResult<ApiResult<AiAnalyticsBriefDto>>> GetAnalyticsBrief(
        [FromQuery] AiAnalyticsBriefQueryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _analytics.GetSellerBriefAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<AiAnalyticsBriefDto>.Ok(result));
    }
}
