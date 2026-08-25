using AIDR.Api.Extensions;
using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize(Policy = "Buyer")]
public sealed class OrdersController : ControllerBase
{
    private readonly IOrderService _orders;

    public OrdersController(IOrderService orders) => _orders = orders;

    /// <summary>
    /// Create order(s) from the cart: split by shop, snapshot address/price,
    /// FIFO reserve stock with lot allocations, and create pending payment records.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResult<CreateOrderResponse>>> Create(
        [FromBody] CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _orders.CreateOrderAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<CreateOrderResponse>.Ok(result, "Order created."));
    }
}
