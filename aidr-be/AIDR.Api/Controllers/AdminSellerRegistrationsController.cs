using AIDR.Api.Extensions;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/admin/seller-registrations")]
[Authorize(Policy = "Admin")]
public sealed class AdminSellerRegistrationsController : ControllerBase
{
    private readonly IAdminSellerRegistrationService _registrations;

    public AdminSellerRegistrationsController(IAdminSellerRegistrationService registrations) =>
        _registrations = registrations;

    /// <summary>
    /// List seller registration requests with server-side paging.
    /// Default status is Pending; pass status=all for every status.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<AdminSellerRegistrationListResultDto>>> List(
        [FromQuery] string? status,
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var filter = string.IsNullOrWhiteSpace(status)
            ? AdminConstants.SellerRegistrationStatusPending
            : status;

        var result = await _registrations.ListAsync(filter, q, page, pageSize, cancellationToken);
        return Ok(ApiResult<AdminSellerRegistrationListResultDto>.Ok(result));
    }

    /// <summary>Get a seller registration request by id.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResult<AdminSellerRegistrationDto>>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _registrations.GetByIdAsync(id, cancellationToken);
        return Ok(ApiResult<AdminSellerRegistrationDto>.Ok(result));
    }

    /// <summary>Approve a pending request: assign Seller role, create Shop and Wallet.</summary>
    [HttpPost("{id:guid}/approve")]
    public async Task<ActionResult<ApiResult<ApproveSellerRegistrationResultDto>>> Approve(
        Guid id,
        CancellationToken cancellationToken)
    {
        var adminUserId = User.GetUserId();
        var result = await _registrations.ApproveAsync(id, adminUserId, cancellationToken);
        return Ok(ApiResult<ApproveSellerRegistrationResultDto>.Ok(
            result,
            "Seller registration approved."));
    }

    /// <summary>Reject a pending seller registration with an admin note.</summary>
    [HttpPost("{id:guid}/reject")]
    public async Task<ActionResult<ApiResult<AdminSellerRegistrationDto>>> Reject(
        Guid id,
        [FromBody] RejectSellerRegistrationRequest request,
        CancellationToken cancellationToken)
    {
        var adminUserId = User.GetUserId();
        var result = await _registrations.RejectAsync(id, adminUserId, request, cancellationToken);
        return Ok(ApiResult<AdminSellerRegistrationDto>.Ok(result, "Seller registration rejected."));
    }

    /// <summary>
    /// Send the application back so the applicant can fix it, instead of
    /// rejecting and making them start over.
    /// </summary>
    [HttpPost("{id:guid}/request-info")]
    public async Task<ActionResult<ApiResult<AdminSellerRegistrationDto>>> RequestMoreInfo(
        Guid id,
        [FromBody] RequestMoreInfoRequest request,
        CancellationToken cancellationToken)
    {
        var adminUserId = User.GetUserId();
        var result = await _registrations.RequestMoreInfoAsync(
            id,
            adminUserId,
            request,
            cancellationToken);

        return Ok(ApiResult<AdminSellerRegistrationDto>.Ok(
            result,
            "Sent back to the applicant for more information."));
    }
}
