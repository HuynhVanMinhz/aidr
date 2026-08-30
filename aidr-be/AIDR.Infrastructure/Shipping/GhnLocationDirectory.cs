using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using AIDR.Modules.Shipping.Abstractions;
using AIDR.Shared.Caching;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AIDR.Infrastructure.Shipping;

/// <summary>
/// GHN master data (province → district → ward), proxied for the address form.
///
/// GHN's own list is the only source that guarantees a booking will not die on
/// FROM/TO_ADDRESS_CONVERT_FAIL, so the buyer picks from it rather than typing.
/// The list changes a few times a year — cached for a day, and a carrier outage
/// falls back to an empty list rather than breaking the address form.
/// </summary>
public sealed class GhnLocationDirectory : IShippingLocationDirectory
{
    private const string ProvincePath = "/shiip/public-api/master-data/province";
    private const string DistrictPath = "/shiip/public-api/master-data/district";
    private const string WardPath = "/shiip/public-api/master-data/ward";

    private static readonly TimeSpan CacheFor = TimeSpan.FromHours(24);

    private readonly HttpClient _http;
    private readonly GhnOptions _options;
    private readonly ICacheService _cache;
    private readonly ILogger<GhnLocationDirectory> _logger;

    public GhnLocationDirectory(
        HttpClient http,
        IOptions<ShippingOptions> options,
        ICacheService cache,
        ILogger<GhnLocationDirectory> logger)
    {
        _options = options.Value.Ghn;
        _cache = cache;
        _logger = logger;
        _http = http;

        var baseUrl = string.IsNullOrWhiteSpace(_options.BaseUrl)
            ? "https://dev-online-gateway.ghn.vn"
            : _options.BaseUrl.TrimEnd('/');
        _http.BaseAddress = new Uri(baseUrl);
        _http.Timeout = TimeSpan.FromSeconds(Math.Max(5, _options.TimeoutSeconds));
    }

    public Task<IReadOnlyList<ShippingLocationDto>> GetProvincesAsync(CancellationToken ct = default) =>
        ReadAsync(
            "shipping:ghn:provinces",
            () => GetAsync(ProvincePath, ct),
            "ProvinceID",
            "ProvinceName",
            ct);

    public Task<IReadOnlyList<ShippingLocationDto>> GetDistrictsAsync(
        string provinceId,
        CancellationToken ct = default)
    {
        var id = RequireNumericId(provinceId, "Province id");

        return ReadAsync(
            $"shipping:ghn:districts:{id}",
            () => PostAsync(DistrictPath, new Dictionary<string, object?> { ["province_id"] = id }, ct),
            "DistrictID",
            "DistrictName",
            ct);
    }

    public Task<IReadOnlyList<ShippingLocationDto>> GetWardsAsync(
        string districtId,
        CancellationToken ct = default)
    {
        var id = RequireNumericId(districtId, "District id");

        return ReadAsync(
            $"shipping:ghn:wards:{id}",
            () => PostAsync(WardPath, new Dictionary<string, object?> { ["district_id"] = id }, ct),
            "WardCode",
            "WardName",
            ct);
    }

    private async Task<IReadOnlyList<ShippingLocationDto>> ReadAsync(
        string cacheKey,
        Func<Task<JsonElement>> fetch,
        string idProperty,
        string nameProperty,
        CancellationToken ct)
    {
        var cached = await _cache.GetAsync<List<ShippingLocationDto>>(cacheKey, ct);
        if (cached is not null)
            return cached;

        JsonElement root;
        try
        {
            root = await fetch();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // The address form still works with what the buyer already typed;
            // an empty list is a better failure than a 500 on the account page.
            _logger.LogWarning(ex, "GHN master data lookup failed for {CacheKey}", cacheKey);
            return Array.Empty<ShippingLocationDto>();
        }

        var items = Parse(root, idProperty, nameProperty);
        await _cache.SetAsync(cacheKey, items, CacheFor, ct);
        return items;
    }

    private static List<ShippingLocationDto> Parse(
        JsonElement root,
        string idProperty,
        string nameProperty)
    {
        if (!root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
            return [];

        var items = new List<ShippingLocationDto>();

        foreach (var entry in data.EnumerateArray())
        {
            var id = ReadId(entry, idProperty);
            var name = ReadName(entry, nameProperty);

            if (id is null || name is null)
                continue;

            items.Add(new ShippingLocationDto { Id = id, Name = name });
        }

        return items
            .DistinctBy(i => i.Id, StringComparer.Ordinal)
            .OrderBy(i => i.Name, StringComparer.CurrentCulture)
            .ToList();
    }

    private static string? ReadId(JsonElement entry, string property)
    {
        if (!entry.TryGetProperty(property, out var value))
            return null;

        // Province/district ids are numbers, ward codes are strings.
        return value.ValueKind switch
        {
            JsonValueKind.Number => value.GetInt64().ToString(CultureInfo.InvariantCulture),
            JsonValueKind.String => value.GetString(),
            _ => null
        };
    }

    private static string? ReadName(JsonElement entry, string property)
    {
        var name = entry.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

        return string.IsNullOrWhiteSpace(name) ? null : name.Trim();
    }

    private async Task<JsonElement> GetAsync(string path, CancellationToken ct)
    {
        using var message = new HttpRequestMessage(HttpMethod.Get, path);
        return await SendAsync(message, path, ct);
    }

    private async Task<JsonElement> PostAsync(
        string path,
        Dictionary<string, object?> body,
        CancellationToken ct)
    {
        using var message = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = JsonContent.Create(body)
        };
        return await SendAsync(message, path, ct);
    }

    private async Task<JsonElement> SendAsync(
        HttpRequestMessage message,
        string path,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.Token))
            throw new AppException("GHN is not configured: set Shipping:Ghn:Token.", 503);

        message.Headers.TryAddWithoutValidation("Token", _options.Token);

        using var response = await _http.SendAsync(message, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new AppException($"GHN {path} failed ({(int)response.StatusCode}).", 502);

        using var doc = JsonDocument.Parse(raw);
        return doc.RootElement.Clone();
    }

    private static long RequireNumericId(string value, string field)
    {
        if (!long.TryParse(value?.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) || id <= 0)
            throw new AppException($"{field} must be a positive number.");

        return id;
    }
}
