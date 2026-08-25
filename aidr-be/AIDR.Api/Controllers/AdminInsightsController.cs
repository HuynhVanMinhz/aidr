using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/admin/insights")]
[Authorize(Policy = "Admin")]
public sealed class AdminInsightsController : ControllerBase
{
    private readonly IAdminCustomerInsightService _insights;

    public AdminInsightsController(IAdminCustomerInsightService insights) => _insights = insights;

    /// <summary>
    /// Customer / marketplace insights: KPIs, registration and order series, top products, simple buyer cohort.
    /// </summary>
    [HttpGet("customers")]
    public async Task<ActionResult<ApiResult<AdminCustomerInsightsDto>>> GetCustomerInsights(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string? granularity,
        CancellationToken cancellationToken = default)
    {
        var result = await _insights.GetCustomerInsightsAsync(
            new AdminCustomerInsightsQueryRequest
            {
                From = from,
                To = to,
                Granularity = granularity
            },
            cancellationToken);

        return Ok(ApiResult<AdminCustomerInsightsDto>.Ok(result));
    }
}
