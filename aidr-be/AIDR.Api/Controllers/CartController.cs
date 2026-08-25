using AIDR.Api.Extensions;
using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/cart")]
[Authorize(Policy = "Buyer")]
public sealed class CartController : ControllerBase
{
    private readonly ICartService _cart;

    public CartController(ICartService cart) => _cart = cart;

    /// <summary>Get the current buyer cart with price snapshots and totals.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<CartResponse>>> Get(CancellationToken cancellationToken)
    {
        var result = await _cart.GetCartAsync(User.GetUserId(), cancellationToken);
        return Ok(ApiResult<CartResponse>.Ok(result));
    }

    /// <summary>Add an approved in-stock product to the cart (merge quantity if already present).</summary>
    [HttpPost("items")]
    public async Task<ActionResult<ApiResult<CartResponse>>> AddItem(
        [FromBody] AddCartItemRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _cart.AddItemAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<CartResponse>.Ok(result, "Item added to cart."));
    }

    /// <summary>Update quantity of a cart item.</summary>
    [HttpPatch("items/{cartItemId:guid}")]
    public async Task<ActionResult<ApiResult<CartResponse>>> UpdateItem(
        Guid cartItemId,
        [FromBody] UpdateCartItemRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _cart.UpdateItemQuantityAsync(
            User.GetUserId(),
            cartItemId,
            request,
            cancellationToken);
        return Ok(ApiResult<CartResponse>.Ok(result, "Cart item updated."));
    }

    /// <summary>Remove a cart item.</summary>
    [HttpDelete("items/{cartItemId:guid}")]
    public async Task<ActionResult<ApiResult<CartResponse>>> RemoveItem(
        Guid cartItemId,
        CancellationToken cancellationToken)
    {
        var result = await _cart.RemoveItemAsync(User.GetUserId(), cartItemId, cancellationToken);
        return Ok(ApiResult<CartResponse>.Ok(result, "Cart item removed."));
    }
}
