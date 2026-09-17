using AIDR.Api.Extensions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Dtos.SellerCenter;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/seller/returns")]
[Authorize(Policy = "Seller")]
public sealed class SellerReturnsController : ControllerBase
{
    private readonly ISellerReturnService _returns;

    public SellerReturnsController(ISellerReturnService returns) => _returns = returns;

    [HttpGet]
    public async Task<ActionResult<ApiResult<SellerReturnListResultDto>>> List(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var result = await _returns.ListAsync(User.GetUserId(), status, page, pageSize, cancellationToken);
        return Ok(ApiResult<SellerReturnListResultDto>.Ok(result));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResult<SellerReturnDetailDto>>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _returns.GetByIdAsync(User.GetUserId(), id, cancellationToken);
        return Ok(ApiResult<SellerReturnDetailDto>.Ok(result));
    }

    [HttpPost("{id:guid}/confirm")]
    public async Task<ActionResult<ApiResult<SellerReturnDetailDto>>> Confirm(
        Guid id,
        [FromBody] ConfirmSellerReturnRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _returns.ConfirmAsync(User.GetUserId(), id, request, cancellationToken);
        return Ok(ApiResult<SellerReturnDetailDto>.Ok(result, "Return handling confirmed."));
    }

    [HttpPost("{id:guid}/receiving")]
    public async Task<ActionResult<ApiResult<SellerReturnDetailDto>>> MarkReceiving(
        Guid id,
        [FromBody] SellerReturnActionRequest? request,
        CancellationToken cancellationToken)
    {
        var result = await _returns.MarkReceivingAsync(User.GetUserId(), id, request, cancellationToken);
        return Ok(ApiResult<SellerReturnDetailDto>.Ok(result, "Return marked as receiving."));
    }

    [HttpPost("{id:guid}/accept")]
    public async Task<ActionResult<ApiResult<SellerReturnDetailDto>>> AcceptGoods(
        Guid id,
        [FromBody] SellerReturnActionRequest? request,
        CancellationToken cancellationToken)
    {
        var result = await _returns.AcceptGoodsAsync(User.GetUserId(), id, request, cancellationToken);
        return Ok(ApiResult<SellerReturnDetailDto>.Ok(result, "Returned goods accepted."));
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<ActionResult<ApiResult<SellerReturnDetailDto>>> Reject(
        Guid id,
        [FromBody] RejectSellerReturnRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _returns.RejectAsync(User.GetUserId(), id, request, cancellationToken);
        return Ok(ApiResult<SellerReturnDetailDto>.Ok(result, "Return request rejected."));
    }
}
