using AIDR.Modules.Discovery.Abstractions;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/shops")]
[AllowAnonymous]
public sealed class ShopsController : ControllerBase
{
    private readonly IDiscoveryService _discovery;

    public ShopsController(IDiscoveryService discovery) => _discovery = discovery;

    /// <summary>Get public shop detail: profile, policies, rating summary, and approved products.</summary>
    [HttpGet("{shopKey}")]
    public async Task<ActionResult<ApiResult<ShopPublicDetailDto>>> GetByKey(
        string shopKey,
        [FromQuery] ShopProductsQueryRequest productsQuery,
        CancellationToken cancellationToken)
    {
        var result = await _discovery.GetShopAsync(shopKey, productsQuery, cancellationToken);
        return Ok(ApiResult<ShopPublicDetailDto>.Ok(result));
    }

    /// <summary>Get public seller rating summary (average score and rating count).</summary>
    [HttpGet("{shopKey}/rating")]
    public async Task<ActionResult<ApiResult<ShopSellerRatingDto>>> GetRating(
        string shopKey,
        CancellationToken cancellationToken)
    {
        var result = await _discovery.GetShopRatingAsync(shopKey, cancellationToken);
        return Ok(ApiResult<ShopSellerRatingDto>.Ok(result));
    }
}
