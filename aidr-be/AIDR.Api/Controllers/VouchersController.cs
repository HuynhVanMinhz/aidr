using AIDR.Api.Extensions;
using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/vouchers")]
[Authorize(Policy = "Buyer")]
public sealed class VouchersController : ControllerBase
{
    private readonly IVoucherService _vouchers;

    public VouchersController(IVoucherService vouchers) => _vouchers = vouchers;

    /// <summary>List active system and shop vouchers for the current cart, with eligibility.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<VoucherListResultDto>>> List(
        [FromQuery] Guid[]? cartItemIds,
        [FromQuery] string? scope,
        [FromQuery] Guid? shopId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        IReadOnlyCollection<Guid>? ids = cartItemIds is { Length: > 0 }
            ? cartItemIds.Where(id => id != Guid.Empty).Distinct().ToList()
            : null;

        var result = await _vouchers.ListAvailableAsync(
            User.GetUserId(),
            ids,
            scope,
            shopId,
            page,
            pageSize,
            cancellationToken);

        return Ok(ApiResult<VoucherListResultDto>.Ok(result));
    }

    /// <summary>Preview discount for a voucher against the current cart (does not redeem).</summary>
    [HttpPost("preview")]
    public async Task<ActionResult<ApiResult<ApplyVoucherPreviewResponse>>> Preview(
        [FromBody] ApplyVoucherPreviewRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _vouchers.PreviewAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<ApplyVoucherPreviewResponse>.Ok(result));
    }
}
