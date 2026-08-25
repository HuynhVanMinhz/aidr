using AIDR.Api.Extensions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/seller/orders")]
[Authorize(Policy = "Seller")]
public sealed class SellerOrdersController : ControllerBase
{
    private readonly ISellerOrderService _orders;

    public SellerOrdersController(ISellerOrderService orders) => _orders = orders;

    /// <summary>List orders for the current seller's shop, newest first, with optional status filter.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<SellerOrderListResultDto>>> List(
        [FromQuery] SellerOrderQueryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _orders.ListAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<SellerOrderListResultDto>.Ok(result));
    }

    /// <summary>Get order detail for a shop order (items, shipping, payment, tracking, history).</summary>
    [HttpGet("{orderId:guid}")]
    public async Task<ActionResult<ApiResult<SellerOrderDetailDto>>> GetById(
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var result = await _orders.GetByIdAsync(User.GetUserId(), orderId, cancellationToken);
        return Ok(ApiResult<SellerOrderDetailDto>.Ok(result));
    }

    /// <summary>
    /// Advance fulfillment status (Paid→Confirmed→Shipping→Delivered) and optionally set tracking.
    /// Tracking code is required when moving to Shipping.
    /// </summary>
    [HttpPatch("{orderId:guid}")]
    public async Task<ActionResult<ApiResult<SellerOrderDetailDto>>> UpdateStatus(
        Guid orderId,
        [FromBody] UpdateSellerOrderRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _orders.UpdateStatusAsync(
            User.GetUserId(),
            orderId,
            request,
            cancellationToken);
        return Ok(ApiResult<SellerOrderDetailDto>.Ok(result, "Order status updated."));
    }
}
