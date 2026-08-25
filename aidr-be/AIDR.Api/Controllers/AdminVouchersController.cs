using AIDR.Api.Extensions;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/admin/vouchers")]
[Authorize(Policy = "Admin")]
public sealed class AdminVouchersController : ControllerBase
{
    private readonly IAdminSystemVoucherService _vouchers;

    public AdminVouchersController(IAdminSystemVoucherService vouchers) => _vouchers = vouchers;

    /// <summary>List system vouchers with paging, search, and status summary.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<AdminSystemVoucherListResultDto>>> List(
        [FromQuery] string? q,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var result = await _vouchers.ListAsync(q, isActive, page, pageSize, cancellationToken);
        return Ok(ApiResult<AdminSystemVoucherListResultDto>.Ok(result));
    }

    /// <summary>Get a system voucher by id.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResult<AdminSystemVoucherDto>>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _vouchers.GetByIdAsync(id, cancellationToken);
        return Ok(ApiResult<AdminSystemVoucherDto>.Ok(result));
    }

    /// <summary>Create a platform-wide (System scope) voucher.</summary>
    [HttpPost]
    public async Task<ActionResult<ApiResult<AdminSystemVoucherDto>>> Create(
        [FromBody] CreateSystemVoucherRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _vouchers.CreateAsync(User.GetUserId(), request, cancellationToken);
        return CreatedAtAction(
            nameof(GetById),
            new { id = result.VoucherId },
            ApiResult<AdminSystemVoucherDto>.Ok(result, "System voucher created."));
    }

    /// <summary>Update system voucher conditions and validity period.</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResult<AdminSystemVoucherDto>>> Update(
        Guid id,
        [FromBody] UpdateSystemVoucherRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _vouchers.UpdateAsync(id, request, cancellationToken);
        return Ok(ApiResult<AdminSystemVoucherDto>.Ok(result, "System voucher updated."));
    }

    /// <summary>Activate or disable a system voucher.</summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<ApiResult<AdminSystemVoucherDto>>> UpdateStatus(
        Guid id,
        [FromBody] UpdateSystemVoucherStatusRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _vouchers.UpdateStatusAsync(id, request, cancellationToken);
        var message = request.IsActive ? "System voucher activated." : "System voucher disabled.";
        return Ok(ApiResult<AdminSystemVoucherDto>.Ok(result, message));
    }

    /// <summary>Delete an unused system voucher. Used vouchers must be disabled instead.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResult<object>>> Delete(
        Guid id,
        CancellationToken cancellationToken)
    {
        await _vouchers.DeleteAsync(id, cancellationToken);
        return Ok(ApiResult<object>.Ok(new { }, "System voucher deleted."));
    }
}
