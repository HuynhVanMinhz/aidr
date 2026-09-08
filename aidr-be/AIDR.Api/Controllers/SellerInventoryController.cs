using AIDR.Api.Extensions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/seller")]
[Authorize(Policy = "Seller")]
public sealed class SellerInventoryController : ControllerBase
{
    private readonly ISellerInventoryService _inventory;

    public SellerInventoryController(ISellerInventoryService inventory) => _inventory = inventory;

    /// <summary>List shop inventory with stock, reserved, and low-stock flags.</summary>
    [HttpGet("inventory")]
    public async Task<ActionResult<ApiResult<SellerInventoryListResult>>> List(
        [FromQuery] SellerInventoryQueryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _inventory.ListAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<SellerInventoryListResult>.Ok(result));
    }

    /// <summary>Rule-based restock suggestions from recent sales velocity.</summary>
    [HttpGet("inventory/restock-advice")]
    public async Task<ActionResult<ApiResult<RestockAdviceResultDto>>> RestockAdvice(
        [FromQuery] RestockAdviceQueryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _inventory.GetRestockAdviceAsync(
            User.GetUserId(),
            request.Days,
            cancellationToken);
        return Ok(ApiResult<RestockAdviceResultDto>.Ok(result));
    }
}
