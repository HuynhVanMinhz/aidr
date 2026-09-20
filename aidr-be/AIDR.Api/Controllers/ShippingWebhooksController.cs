using AIDR.Modules.Order.Abstractions;
using AIDR.Modules.Shipping.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Shipping;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

/// <summary>
/// Carrier callbacks. This is the primary path that moves an order to Shipping/Delivered
/// and also advances return requests through logistics statuses.
///
/// GHN supports only ONE webhook URL per shop, so ALL events — both forward shipments
/// and reverse (return) shipments — arrive here. Return shipments are identified by
/// the RTN- prefix on client_order_code and forwarded to IReturnShipmentService.
/// </summary>
[ApiController]
[Route("api/webhooks/shipping")]
public sealed class ShippingWebhooksController : ControllerBase
{
    private const string TokenHeader = "X-Shipping-Token";

    private readonly IShippingService _shipping;
    private readonly IReturnShipmentService _returnShipment;

    public ShippingWebhooksController(
        IShippingService shipping,
        IReturnShipmentService returnShipment)
    {
        _shipping = shipping;
        _returnShipment = returnShipment;
    }

    /// <summary>
    /// Carrier status callback, e.g. <c>/api/webhooks/shipping/GHN</c>. The body is
    /// read raw because every carrier sends its own shape.
    /// </summary>
    [HttpPost("{provider}")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<object>>> Receive(
        string provider,
        CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync(cancellationToken);

        var token = Request.Headers.TryGetValue(TokenHeader, out var headerToken)
            ? headerToken.ToString()
            : Request.Query["token"].ToString();

        // Return shipments use the RTN- prefix on client_order_code.
        // Try to detect them before hitting the forward-shipment handler.
        if (IsReturnShipmentPayload(payload))
        {
            var returnResult = await _returnShipment.HandleWebhookAsync(
                provider, payload, token, cancellationToken);
            // Always 200: a carrier that gets an error retries the same event forever.
            return Ok(ApiResult<object>.Ok(returnResult, returnResult.Message));
        }

        var result = await _shipping.HandleWebhookAsync(provider, payload, token, cancellationToken);
        return Ok(ApiResult<object>.Ok(result, result.Message));
    }

    /// <summary>
    /// Quick check whether the raw payload belongs to a return (reverse) shipment.
    /// We look for the RTN- prefix in client_order_code / ClientOrderCode without
    /// fully parsing the JSON, falling back gracefully on any parse failure.
    /// </summary>
    private static bool IsReturnShipmentPayload(string payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
            return false;

        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(payload);
            var root = doc.RootElement;

            // GHN uses PascalCase in webhooks; check both casings to be safe.
            if (TryGetStringProp(root, "ClientOrderCode", out var code) ||
                TryGetStringProp(root, "client_order_code", out code))
            {
                return code?.StartsWith(ReturnConstants.ReturnShipmentPrefix,
                    StringComparison.OrdinalIgnoreCase) == true;
            }
        }
        catch (System.Text.Json.JsonException)
        {
            // Unparseable — let the forward handler deal with it.
        }

        return false;
    }

    private static bool TryGetStringProp(
        System.Text.Json.JsonElement root, string key, out string? value)
    {
        if (root.TryGetProperty(key, out var prop) &&
            prop.ValueKind == System.Text.Json.JsonValueKind.String)
        {
            value = prop.GetString();
            return true;
        }
        value = null;
        return false;
    }
}
