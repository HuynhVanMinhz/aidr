using AIDR.Api.Extensions;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/price-alerts")]
[Authorize(Policy = "Buyer")]
public sealed class PriceAlertsController : ControllerBase
{
    private readonly IPriceAlertService _alerts;

    public PriceAlertsController(IPriceAlertService alerts) => _alerts = alerts;

    [HttpGet]
    public async Task<ActionResult<ApiResult<PagedResult<PriceAlertDto>>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _alerts.ListAsync(User.GetUserId(), page, pageSize, cancellationToken);
        return Ok(ApiResult<PagedResult<PriceAlertDto>>.Ok(result));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResult<PriceAlertDto>>> Create(
        [FromBody] CreatePriceAlertRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _alerts.CreateOrUpdateAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<PriceAlertDto>.Ok(result, "Price alert saved."));
    }

    [HttpDelete("{priceAlertId:guid}")]
    public async Task<ActionResult<ApiResult<RemovePriceAlertResponse>>> Remove(
        Guid priceAlertId,
        CancellationToken cancellationToken)
    {
        var result = await _alerts.RemoveAsync(User.GetUserId(), priceAlertId, cancellationToken);
        return Ok(ApiResult<RemovePriceAlertResponse>.Ok(result, "Price alert removed."));
    }

    [HttpDelete("products/{productId:guid}")]
    public async Task<ActionResult<ApiResult<RemovePriceAlertResponse>>> RemoveByProduct(
        Guid productId,
        [FromQuery] string alertType,
        CancellationToken cancellationToken)
    {
        var result = await _alerts.RemoveByProductAsync(User.GetUserId(), productId, alertType, cancellationToken);
        return Ok(ApiResult<RemovePriceAlertResponse>.Ok(result, "Price alert removed."));
    }

    [HttpGet("products/{productId:guid}/status")]
    public async Task<ActionResult<ApiResult<ProductPriceAlertStatusDto>>> ProductStatus(
        Guid productId,
        CancellationToken cancellationToken)
    {
        var result = await _alerts.GetStatusAsync(User.GetUserId(), productId, cancellationToken);
        return Ok(ApiResult<ProductPriceAlertStatusDto>.Ok(result));
    }
}
