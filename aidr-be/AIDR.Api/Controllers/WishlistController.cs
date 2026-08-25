using AIDR.Api.Extensions;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/wishlist")]
[Authorize(Policy = "Buyer")]
public sealed class WishlistController : ControllerBase
{
    private readonly IWishlistService _wishlist;

    public WishlistController(IWishlistService wishlist) => _wishlist = wishlist;

    /// <summary>List the current buyer's wishlist, newest first (paged).</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<PagedResult<WishlistItemDto>>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _wishlist.ListAsync(User.GetUserId(), page, pageSize, cancellationToken);
        return Ok(ApiResult<PagedResult<WishlistItemDto>>.Ok(result));
    }

    /// <summary>Add an approved product to the wishlist (unique per user + product).</summary>
    [HttpPost("items")]
    public async Task<ActionResult<ApiResult<WishlistItemDto>>> AddItem(
        [FromBody] AddWishlistItemRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _wishlist.AddAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<WishlistItemDto>.Ok(result, "Product added to wishlist."));
    }

    /// <summary>Remove a wishlist item by wishlist item id.</summary>
    [HttpDelete("items/{wishlistItemId:guid}")]
    public async Task<ActionResult<ApiResult<RemoveWishlistItemResponse>>> RemoveItem(
        Guid wishlistItemId,
        CancellationToken cancellationToken)
    {
        var result = await _wishlist.RemoveAsync(User.GetUserId(), wishlistItemId, cancellationToken);
        return Ok(ApiResult<RemoveWishlistItemResponse>.Ok(result, "Product removed from wishlist."));
    }

    /// <summary>Remove a product from the wishlist by product id.</summary>
    [HttpDelete("products/{productId:guid}")]
    public async Task<ActionResult<ApiResult<RemoveWishlistItemResponse>>> RemoveByProduct(
        Guid productId,
        CancellationToken cancellationToken)
    {
        var result = await _wishlist.RemoveByProductAsync(User.GetUserId(), productId, cancellationToken);
        return Ok(ApiResult<RemoveWishlistItemResponse>.Ok(result, "Product removed from wishlist."));
    }
}
