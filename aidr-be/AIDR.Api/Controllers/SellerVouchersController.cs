using AIDR.Api.Extensions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/seller/vouchers")]
[Authorize(Policy = "Seller")]
public sealed class SellerVouchersController : ControllerBase
{
    private readonly ISellerShopVoucherService _vouchers;

    public SellerVouchersController(ISellerShopVoucherService vouchers) => _vouchers = vouchers;

    /// <summary>List vouchers for the current seller's shop with paging and summary.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<SellerShopVoucherListResultDto>>> List(
        [FromQuery] string? q,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var result = await _vouchers.ListAsync(User.GetUserId(), q, isActive, page, pageSize, cancellationToken);
        return Ok(ApiResult<SellerShopVoucherListResultDto>.Ok(result));
    }

    /// <summary>Get a shop voucher by id (must belong to the seller's shop).</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResult<SellerShopVoucherDto>>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _vouchers.GetByIdAsync(User.GetUserId(), id, cancellationToken);
        return Ok(ApiResult<SellerShopVoucherDto>.Ok(result));
    }

    /// <summary>Create a shop-scoped voucher for the seller's shop.</summary>
    [HttpPost]
    public async Task<ActionResult<ApiResult<SellerShopVoucherDto>>> Create(
        [FromBody] CreateShopVoucherRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _vouchers.CreateAsync(User.GetUserId(), request, cancellationToken);
        return CreatedAtAction(
            nameof(GetById),
            new { id = result.VoucherId },
            ApiResult<SellerShopVoucherDto>.Ok(result, "Shop voucher created."));
    }

    /// <summary>Update shop voucher conditions and validity period.</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResult<SellerShopVoucherDto>>> Update(
        Guid id,
        [FromBody] UpdateShopVoucherRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _vouchers.UpdateAsync(User.GetUserId(), id, request, cancellationToken);
        return Ok(ApiResult<SellerShopVoucherDto>.Ok(result, "Shop voucher updated."));
    }

    /// <summary>Activate or disable a shop voucher.</summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<ApiResult<SellerShopVoucherDto>>> UpdateStatus(
        Guid id,
        [FromBody] UpdateShopVoucherStatusRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _vouchers.UpdateStatusAsync(User.GetUserId(), id, request, cancellationToken);
        var message = request.IsActive ? "Shop voucher activated." : "Shop voucher disabled.";
        return Ok(ApiResult<SellerShopVoucherDto>.Ok(result, message));
    }

    /// <summary>Delete an unused shop voucher. Used vouchers must be disabled instead.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResult<object>>> Delete(
        Guid id,
        CancellationToken cancellationToken)
    {
        await _vouchers.DeleteAsync(User.GetUserId(), id, cancellationToken);
        return Ok(ApiResult<object>.Ok(new { }, "Shop voucher deleted."));
    }
}
