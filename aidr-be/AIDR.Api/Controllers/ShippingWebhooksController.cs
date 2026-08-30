using AIDR.Modules.Shipping.Abstractions;
using AIDR.Shared.Dtos.Shipping;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

/// <summary>
/// Carrier callbacks. This is the primary path that moves an order to Shipping
/// and Delivered; the background sweep only covers the ones that go missing.
/// </summary>
[ApiController]
[Route("api/webhooks/shipping")]
public sealed class ShippingWebhooksController : ControllerBase
{
    private const string TokenHeader = "X-Shipping-Token";

    private readonly IShippingService _shipping;

    public ShippingWebhooksController(IShippingService shipping) => _shipping = shipping;

    /// <summary>
    /// Carrier status callback, e.g. <c>/api/webhooks/shipping/GHN</c>. The body is
    /// read raw because every carrier sends its own shape.
    /// </summary>
    [HttpPost("{provider}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<ShippingWebhookResult>>> Receive(
        string provider,
        CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync(cancellationToken);

        var token = Request.Headers.TryGetValue(TokenHeader, out var headerToken)
            ? headerToken.ToString()
            : Request.Query["token"].ToString();

        var result = await _shipping.HandleWebhookAsync(provider, payload, token, cancellationToken);

        // Always 200: a carrier that gets an error retries the same event forever.
        return Ok(ApiResult<ShippingWebhookResult>.Ok(result, result.Message));
    }
}
