using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/admin/orders")]
[Authorize(Policy = "Admin")]
public sealed class AdminOrdersController : ControllerBase
{
    private readonly IAdminOrderService _orders;

    public AdminOrdersController(IAdminOrderService orders) => _orders = orders;

    /// <summary>
    /// List platform orders with optional status and search filters.
    /// Pass status=all (or omit) for every status.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<AdminOrderListResultDto>>> List(
        [FromQuery] string? status,
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var result = await _orders.ListAsync(status, q, page, pageSize, cancellationToken);
        return Ok(ApiResult<AdminOrderListResultDto>.Ok(result));
    }

    /// <summary>Get order detail summary for admin oversight.</summary>
    [HttpGet("{orderId:guid}")]
    public async Task<ActionResult<ApiResult<AdminOrderDetailDto>>> GetById(
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var result = await _orders.GetByIdAsync(orderId, cancellationToken);
        return Ok(ApiResult<AdminOrderDetailDto>.Ok(result));
    }
}
