using AIDR.Api.Extensions;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/admin/return-requests")]
[Authorize(Policy = "Admin")]
public sealed class AdminReturnRequestsController : ControllerBase
{
    private readonly IAdminReturnService _returns;
    private readonly IReturnShipmentService _returnShipment;

    public AdminReturnRequestsController(
        IAdminReturnService returns,
        IReturnShipmentService returnShipment)
    {
        _returns = returns;
        _returnShipment = returnShipment;
    }

    /// <summary>
    /// List return / refund requests with server-side paging.
    /// Default status is Pending; pass status=all for every status.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<AdminReturnRequestListResultDto>>> List(
        [FromQuery] string? status,
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var filter = string.IsNullOrWhiteSpace(status)
            ? ReturnConstants.StatusPending
            : status;

        var result = await _returns.ListAsync(filter, q, page, pageSize, cancellationToken);
        return Ok(ApiResult<AdminReturnRequestListResultDto>.Ok(result));
    }

    /// <summary>Get return request detail including evidences, items, and status history.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResult<AdminReturnRequestDetailDto>>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _returns.GetByIdAsync(id, cancellationToken);
        return Ok(ApiResult<AdminReturnRequestDetailDto>.Ok(result));
    }

    /// <summary>Approve a pending return and forward it to the seller.</summary>
    [HttpPost("{id:guid}/approve")]
    public async Task<ActionResult<ApiResult<AdminReturnRequestDetailDto>>> Approve(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _returns.ApproveAsync(id, User.GetUserId(), cancellationToken);
        return Ok(ApiResult<AdminReturnRequestDetailDto>.Ok(result, "Return request approved."));
    }

    /// <summary>Reject a pending return request with a required admin note.</summary>
    [HttpPost("{id:guid}/reject")]
    public async Task<ActionResult<ApiResult<AdminReturnRequestDetailDto>>> Reject(
        Guid id,
        [FromBody] RejectReturnRequestRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _returns.RejectAsync(id, User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<AdminReturnRequestDetailDto>.Ok(result, "Return request rejected."));
    }

    /// <summary>
    /// Advance return after seller Accepted: Accepted→Refunded|Exchanged→Closed.
    /// Transition to Refunded refunds the buyer payment and debits the seller wallet.
    /// </summary>
    [HttpPost("{id:guid}/status")]
    public async Task<ActionResult<ApiResult<AdminReturnRequestDetailDto>>> UpdateStatus(
        Guid id,
        [FromBody] UpdateReturnStatusRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _returns.UpdateStatusAsync(id, User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<AdminReturnRequestDetailDto>.Ok(result, "Return request status updated."));
    }

    /// <summary>
    /// Retry GHN pickup after a PickupFailed status.
    /// Cancels the previous GHN order and creates a new reverse shipment.
    /// </summary>
    [HttpPost("{id:guid}/retry-pickup")]
    public async Task<ActionResult<ApiResult<ReturnShipmentDto>>> RetryPickup(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _returnShipment.RetryDispatchAsync(id, cancellationToken);
        return Ok(ApiResult<ReturnShipmentDto>.Ok(result, "Return pickup retried."));
    }

    /// <summary>
    /// Manually advances the return to Receiving, bypassing GHN logistics.
    /// Use when the buyer ships the item manually or logistics is permanently stuck.
    /// </summary>
    [HttpPost("{id:guid}/mark-receiving")]
    public async Task<ActionResult<ApiResult<string>>> MarkReceiving(
        Guid id,
        [FromBody] AdminMarkReceivingRequest? request,
        CancellationToken cancellationToken)
    {
        await _returnShipment.MarkReceivingManuallyAsync(id, User.GetUserId(), request?.Note, cancellationToken);
        return Ok(ApiResult<string>.Ok("ok", "Return marked as receiving."));
    }

    /// <summary>Get the return shipment (GHN tracking) for a return request.</summary>
    [HttpGet("{id:guid}/shipment")]
    public async Task<ActionResult<ApiResult<ReturnShipmentDto?>>> GetShipment(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _returnShipment.GetByReturnRequestAsync(id, cancellationToken);
        return Ok(ApiResult<ReturnShipmentDto?>.Ok(result));
    }
}
