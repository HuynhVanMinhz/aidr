using AIDR.Api.Extensions;
using AIDR.Modules.Admin.Abstractions;
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

    public AdminReturnRequestsController(IAdminReturnService returns) => _returns = returns;

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
}
