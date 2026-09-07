using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/admin/ai")]
[Authorize(Policy = "Admin")]
public sealed class AdminAiAnalyticsController : ControllerBase
{
    private readonly IAiAnalyticsService _analytics;

    public AdminAiAnalyticsController(IAiAnalyticsService analytics) => _analytics = analytics;

    /// <summary>AI-generated platform analytics brief from live KPIs and sales metrics.</summary>
    [HttpGet("analytics-brief")]
    public async Task<ActionResult<ApiResult<AiAnalyticsBriefDto>>> GetAnalyticsBrief(
        [FromQuery] AiAnalyticsBriefQueryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _analytics.GetAdminBriefAsync(request, cancellationToken);
        return Ok(ApiResult<AiAnalyticsBriefDto>.Ok(result));
    }
}
