using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

/// <summary>
/// GHN callbacks for reverse (return) shipments.
/// Separate from /api/webhooks/shipping/{provider} which handles forward shipments.
/// </summary>
[ApiController]
[Route("api/webhooks/return-shipping")]
public sealed class ReturnShipmentWebhooksController : ControllerBase
{
    private const string TokenHeader = "X-Shipping-Token";

    private readonly IReturnShipmentService _returnShipment;

    public ReturnShipmentWebhooksController(IReturnShipmentService returnShipment) =>
        _returnShipment = returnShipment;

    /// <summary>
    /// GHN return-shipment callback, e.g. <c>/api/webhooks/return-shipping/GHN</c>.
    /// Always returns 200 to prevent GHN from retrying indefinitely.
    /// </summary>
    [HttpPost("{provider}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<ReturnShipmentWebhookResult>>> Receive(
        string provider,
        CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync(cancellationToken);

        var token = Request.Headers.TryGetValue(TokenHeader, out var headerToken)
            ? headerToken.ToString()
            : Request.Query["token"].ToString();

        var result = await _returnShipment.HandleWebhookAsync(provider, payload, token, cancellationToken);

        return Ok(ApiResult<ReturnShipmentWebhookResult>.Ok(result, result.Message));
    }
}
