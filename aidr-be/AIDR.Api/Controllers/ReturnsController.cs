using AIDR.Api.Extensions;
using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/returns")]
[Authorize(Policy = "Buyer")]
public sealed class ReturnsController : ControllerBase
{
    private readonly IReturnService _returns;

    public ReturnsController(IReturnService returns) => _returns = returns;

    /// <summary>List return requests for the current buyer with optional status filter.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<BuyerReturnListResultDto>>> List(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var result = await _returns.ListForBuyerAsync(
            User.GetUserId(),
            status,
            page,
            pageSize,
            cancellationToken);
        return Ok(ApiResult<BuyerReturnListResultDto>.Ok(result));
    }

    /// <summary>Get a return request owned by the current buyer.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResult<BuyerReturnRequestDto>>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _returns.GetByIdForBuyerAsync(User.GetUserId(), id, cancellationToken);
        return Ok(ApiResult<BuyerReturnRequestDto>.Ok(result));
    }
}
