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

    /// <summary>List the current buyer's orders, newest first, with optional status filter.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<BuyerOrderListResultDto>>> List(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var result = await _orders.ListBuyerOrdersAsync(
            User.GetUserId(),
            status,
            page,
            pageSize,
            cancellationToken);
        return Ok(ApiResult<BuyerOrderListResultDto>.Ok(result));
    }

    /// <summary>Get order detail for the current buyer (items, payment, tracking, history).</summary>
    [HttpGet("{orderId:guid}")]
    public async Task<ActionResult<ApiResult<BuyerOrderDetailDto>>> GetById(
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var result = await _orders.GetBuyerOrderAsync(User.GetUserId(), orderId, cancellationToken);
        return Ok(ApiResult<BuyerOrderDetailDto>.Ok(result));
    }

    /// <summary>
    /// Cancel an unpaid order (PendingPayment only), release reserved stock, and cancel pending payment.
    /// </summary>
    [HttpPost("{orderId:guid}/cancel")]
    public async Task<ActionResult<ApiResult<BuyerOrderDetailDto>>> Cancel(
        Guid orderId,
        [FromBody] CancelOrderRequest? request,
        CancellationToken cancellationToken)
    {
        var result = await _orders.CancelBuyerOrderAsync(
            User.GetUserId(),
            orderId,
            request ?? new CancelOrderRequest(),
            cancellationToken);
        return Ok(ApiResult<BuyerOrderDetailDto>.Ok(result, "Order cancelled."));
    }

    /// <summary>
    /// Confirm that a delivered order was received: Delivered → Completed and credit the seller wallet.
    /// </summary>
    [HttpPost("{orderId:guid}/confirm-received")]
    public async Task<ActionResult<ApiResult<BuyerOrderDetailDto>>> ConfirmReceived(
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var result = await _orders.ConfirmReceivedAsync(User.GetUserId(), orderId, cancellationToken);
        return Ok(ApiResult<BuyerOrderDetailDto>.Ok(result, "Order marked as completed."));
    }
}
