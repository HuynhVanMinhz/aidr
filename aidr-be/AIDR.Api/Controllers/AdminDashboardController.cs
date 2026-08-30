using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/admin/dashboard")]
[Authorize(Policy = "Admin")]
public sealed class AdminDashboardController : ControllerBase
{
    private readonly IAdminDashboardService _dashboard;

    public AdminDashboardController(IAdminDashboardService dashboard) => _dashboard = dashboard;

    /// <summary>Platform KPI counts for the admin home dashboard.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<AdminDashboardDto>>> Get(
        CancellationToken cancellationToken)
    {
        var result = await _dashboard.GetAsync(cancellationToken);
        return Ok(ApiResult<AdminDashboardDto>.Ok(result));
    }
}
