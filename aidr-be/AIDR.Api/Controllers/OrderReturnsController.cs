using AIDR.Api.Extensions;
using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize(Policy = "Buyer")]
public sealed class OrderReturnsController : ControllerBase
{
    private readonly IReturnService _returns;

    public OrderReturnsController(IReturnService returns) => _returns = returns;

    /// <summary>
    /// Submit a return / refund request with Unboxing and Testing evidence videos.
    /// </summary>
    [HttpPost("{orderId:guid}/returns")]
    public async Task<ActionResult<ApiResult<BuyerReturnRequestDto>>> Create(
        Guid orderId,
        [FromBody] CreateReturnRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _returns.CreateAsync(User.GetUserId(), orderId, request, cancellationToken);
        return Ok(ApiResult<BuyerReturnRequestDto>.Ok(result, "Return request submitted."));
    }

    /// <summary>Get the latest return request for an order owned by the current buyer.</summary>
    [HttpGet("{orderId:guid}/returns")]
    public async Task<ActionResult<ApiResult<BuyerReturnRequestDto>>> GetByOrder(
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var result = await _returns.GetByOrderAsync(User.GetUserId(), orderId, cancellationToken);
        return Ok(ApiResult<BuyerReturnRequestDto>.Ok(result));
    }
}
