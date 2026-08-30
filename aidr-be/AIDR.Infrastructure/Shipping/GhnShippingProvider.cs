using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using AIDR.Modules.Shipping.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Shipping;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AIDR.Infrastructure.Shipping;

/// <summary>
/// Giao Hàng Nhanh (GHN) adapter — https://api.ghn.vn/home/docs/detail
///
/// Sandbox and production differ only by <c>Shipping:Ghn:BaseUrl</c>. The order
/// code we send as <c>client_order_code</c> comes back on every webhook, which is
/// how a callback finds its way home if GHN ever reissues its own code.
/// </summary>
public sealed class GhnShippingProvider : IShippingProvider
{
    private const string CreatePath = "/shiip/public-api/v2/shipping-order/create";
    private const string DetailPath = "/shiip/public-api/v2/shipping-order/detail";
    private const string CancelPath = "/shiip/public-api/v2/switch-status/cancel";

    private readonly HttpClient _http;
    private readonly GhnOptions _options;
    private readonly ILogger<GhnShippingProvider> _logger;

    public GhnShippingProvider(
        HttpClient http,
        IOptions<ShippingOptions> options,
        ILogger<GhnShippingProvider> logger)
    {
        _options = options.Value.Ghn;
        _logger = logger;
        _http = http;
        var baseUrl = string.IsNullOrWhiteSpace(_options.BaseUrl)
            ? "https://dev-online-gateway.ghn.vn"
            : _options.BaseUrl.TrimEnd('/');
        _http.BaseAddress = new Uri(baseUrl);
        _http.Timeout = TimeSpan.FromSeconds(Math.Max(5, _options.TimeoutSeconds));
    }

    public string Name => ShippingConstants.ProviderGhn;

    public bool IsConfigured => _options.IsConfigured;

    public async Task<ShipmentDispatchResult> CreateShipmentAsync(
        ShipmentDispatchRequest request,
        CancellationToken ct = default)
    {
        RequireConfigured();

        var body = new Dictionary<string, object?>
        {
            ["payment_type_id"] = _options.PaymentTypeId,
            ["required_note"] = _options.RequiredNote,
            ["client_order_code"] = request.OrderCode,
            // GHN resolves the sender from the shop on the account, which carries no
            // address in the sandbox (FROM_ADDRESS_CONVERT_FAIL). Sending the seller's
            // own shop address makes the pickup point explicit and per-shop correct.
            ["from_name"] = request.SenderName,
            ["from_phone"] = request.SenderPhone,
            ["from_address"] = request.SenderStreetAddress,
            ["from_ward_name"] = request.SenderWard,
            ["from_district_name"] = request.SenderDistrict,
            ["from_province_name"] = request.SenderProvince,
            ["to_name"] = request.ReceiverName,
            ["to_phone"] = request.ReceiverPhone,
            ["to_address"] = request.StreetAddress,
            ["to_ward_name"] = request.Ward,
            ["to_district_name"] = request.District,
            ["to_province_name"] = request.Province,
            ["cod_amount"] = (long)decimal.Round(request.CodAmount, 0, MidpointRounding.AwayFromZero),
            ["insurance_value"] = (long)decimal.Round(request.InsuranceValue, 0, MidpointRounding.AwayFromZero),
            ["weight"] = Math.Max(1, request.TotalWeightGram),
            ["service_type_id"] = _options.ServiceTypeId,
            ["note"] = request.Note,
            ["items"] = request.Items.Select(i => new Dictionary<string, object?>
            {
                ["name"] = i.Name,
                ["quantity"] = Math.Max(1, i.Quantity),
                ["price"] = (long)decimal.Round(i.Price, 0, MidpointRounding.AwayFromZero),
                ["weight"] = i.WeightGram > 0 ? i.WeightGram : _options.DefaultWeightGram
            }).ToList()
        };

        var (root, raw) = await PostAsync(CreatePath, body, ct);

        if (!root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
            throw new AppException("GHN did not return shipment data.");

        var orderCode = TryGetString(data, "order_code")
            ?? throw new AppException("GHN did not return an order code.");

        return new ShipmentDispatchResult
        {
            ProviderShipmentId = orderCode,
            TrackingCode = orderCode,
            ProviderStatus = "ready_to_pick",
            MappedStatus = ShippingConstants.ShipmentCreated,
            Fee = TryGetDecimal(data, "total_fee"),
            ExpectedDeliveryAt = TryGetDate(data, "expected_delivery_time"),
            RawJson = raw
        };
    }

    public async Task<ShipmentTrackingSnapshot?> GetTrackingAsync(
        string providerShipmentId,
        CancellationToken ct = default)
    {
        RequireConfigured();

        var (root, raw) = await PostAsync(
            DetailPath,
            new Dictionary<string, object?> { ["order_code"] = providerShipmentId },
            ct);

        if (!root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
            return null;

        var status = TryGetString(data, "status");
        if (string.IsNullOrWhiteSpace(status))
            return null;

        var occurredAt = TryGetDate(data, "updated_date") ?? DateTime.UtcNow;

        return new ShipmentTrackingSnapshot
        {
            ProviderStatus = status,
            MappedStatus = MapStatus(status),
            Description = $"GHN reported {status}",
            OccurredAt = occurredAt,
            // Same status at the same timestamp is the same event, however often we poll.
            ExternalEventId = $"{status}:{occurredAt:yyyyMMddHHmmss}",
            RawJson = raw
        };
    }

    public async Task CancelShipmentAsync(string providerShipmentId, CancellationToken ct = default)
    {
        RequireConfigured();

        await PostAsync(
            CancelPath,
            new Dictionary<string, object?> { ["order_codes"] = new[] { providerShipmentId } },
            ct);
    }

    public string MapStatus(string providerStatus)
    {
        if (!string.IsNullOrWhiteSpace(providerStatus) &&
            ShippingConstants.GhnStatusMap.TryGetValue(providerStatus.Trim(), out var mapped))
        {
            return mapped;
        }

        // GHN adds statuses over time; an unknown one must not look like progress.
        _logger.LogWarning("Unmapped GHN status '{Status}'", providerStatus);
        return ShippingConstants.ShipmentCreated;
    }

    public ShipmentWebhookEvent ParseWebhook(string rawPayload)
    {
        try
        {
            using var doc = JsonDocument.Parse(rawPayload);
            var root = doc.RootElement;

            var orderCode = TryGetString(root, "OrderCode") ?? TryGetString(root, "order_code")
                ?? throw new AppException("GHN webhook is missing OrderCode.");

            var status = TryGetString(root, "Status") ?? TryGetString(root, "status")
                ?? throw new AppException("GHN webhook is missing Status.");

            var occurredAt = TryGetDate(root, "Time") ?? TryGetDate(root, "time");

            return new ShipmentWebhookEvent
            {
                ProviderShipmentId = orderCode,
                ProviderStatus = status,
                Description = TryGetString(root, "Description") ?? TryGetString(root, "Reason"),
                OrderCode = TryGetString(root, "ClientOrderCode") ?? TryGetString(root, "client_order_code"),
                OccurredAt = occurredAt,
                ExternalEventId = $"{status}:{(occurredAt ?? DateTime.UtcNow):yyyyMMddHHmmss}"
            };
        }
        catch (JsonException ex)
        {
            throw new AppException($"GHN webhook payload is not valid JSON: {ex.Message}");
        }
    }

    public bool IsWebhookAuthentic(string? token)
    {
        // No secret configured means the endpoint is open — fine while testing in
        // a sandbox, deliberately explicit so it is easy to spot before go-live.
        if (string.IsNullOrWhiteSpace(_options.WebhookToken))
            return true;

        return string.Equals(token?.Trim(), _options.WebhookToken, StringComparison.Ordinal);
    }

    private async Task<(JsonElement Root, string Raw)> PostAsync(
        string path,
        Dictionary<string, object?> body,
        CancellationToken ct)
    {
        using var message = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(body)
        };
        message.Headers.TryAddWithoutValidation("Token", _options.Token);
        message.Headers.TryAddWithoutValidation("ShopId", _options.ShopId.ToString(CultureInfo.InvariantCulture));

        using var response = await _http.SendAsync(message, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            throw new AppException(
                $"GHN {path} failed ({(int)response.StatusCode}): {ExtractMessage(raw) ?? "no message"}");
        }

        using var doc = JsonDocument.Parse(raw);
        // Clone so the element outlives the JsonDocument's using scope.
        var root = doc.RootElement.Clone();

        if (root.TryGetProperty("code", out var code)
            && code.ValueKind == JsonValueKind.Number
            && code.GetInt32() != 200)
        {
            throw new AppException($"GHN {path} returned code {code.GetInt32()}: {ExtractMessage(raw) ?? "no message"}");
        }

        return (root, raw);
    }

    private void RequireConfigured()
    {
        if (!IsConfigured)
            throw new AppException("GHN is not configured: set Shipping:Ghn:Token and Shipping:Ghn:ShopId.");
    }

    private static string? ExtractMessage(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            return TryGetString(doc.RootElement, "message") ?? TryGetString(doc.RootElement, "code_message_value");
        }
        catch (JsonException)
        {
            return raw.Length > 200 ? raw[..200] : raw;
        }
    }

    private static string? TryGetString(JsonElement root, string propertyName) =>
        root.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static decimal? TryGetDecimal(JsonElement root, string propertyName) =>
        root.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.Number
            ? value.GetDecimal()
            : null;

    private static DateTime? TryGetDate(JsonElement root, string propertyName)
    {
        var raw = TryGetString(root, propertyName);
        return DateTime.TryParse(
            raw,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal,
            out var parsed)
            ? parsed
            : null;
    }
}
