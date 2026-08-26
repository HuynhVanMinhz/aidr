using AIDR.Api.Extensions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/seller/shop")]
[Authorize(Policy = "Seller")]
public sealed class SellerShopController : ControllerBase
{
    private readonly ISellerShopService _shops;

    public SellerShopController(ISellerShopService shops) => _shops = shops;

    /// <summary>Get the shop owned by the current seller.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<SellerShopDto>>> GetMine(
        CancellationToken cancellationToken)
    {
        var result = await _shops.GetMineAsync(User.GetUserId(), cancellationToken);
        return Ok(ApiResult<SellerShopDto>.Ok(result));
    }

    /// <summary>Update editable shop profile fields. Slug remains stable.</summary>
    [HttpPut]
    public async Task<ActionResult<ApiResult<SellerShopDto>>> UpdateMine(
        [FromBody] UpdateSellerShopRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _shops.UpdateMineAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<SellerShopDto>.Ok(result, "Shop settings updated."));
    }
}
