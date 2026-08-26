using System.Text.Json;
using AIDR.Modules.Profile.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Profile.Services;

public sealed class SellerRegistrationService : ISellerRegistrationService
{
    private readonly ISellerRegistrationRepository _repository;

    public SellerRegistrationService(ISellerRegistrationRepository repository) =>
        _repository = repository;

    public async Task<BuyerSellerRegistrationDto> CreateAsync(
        Guid userId,
        CreateSellerRegistrationRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId);
        if (request is null)
            throw new AppException("Seller registration request body is required.");

        if (await _repository.UserHasRoleAsync(userId, RoleCodes.Seller, cancellationToken))
            throw new ConflictException("You already have the Seller role.");

        if (await _repository.OwnsShopAsync(userId, cancellationToken))
            throw new ConflictException("You already own a shop.");

        if (await _repository.HasPendingAsync(userId, cancellationToken))
            throw new ConflictException("You already have a pending seller registration request.");

        var shopName = RequireText(request.ShopName, "Shop name", AdminConstants.MaxShopNameLength);
        var businessInfo = OptionalText(
            request.BusinessInfo,
            "Business info",
            AdminConstants.MaxSellerBusinessInfoLength);
        var documentUrlsJson = NormalizeDocumentUrls(request.DocumentUrls);

        var record = await _repository.CreateAsync(
            userId,
            shopName,
            businessInfo,
            documentUrlsJson,
            cancellationToken);

        return Map(record);
    }

    public async Task<BuyerSellerRegistrationDto> GetMineAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId);

        var record = await _repository.GetLatestForUserAsync(userId, cancellationToken)
            ?? throw new NotFoundException("Seller registration request not found.");

        return Map(record);
    }

    private static string? NormalizeDocumentUrls(JsonElement? element)
    {
        if (element is null
            || element.Value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return null;
        }

        var urls = new List<string>();
        var value = element.Value;

        if (value.ValueKind == JsonValueKind.String)
        {
            var raw = value.GetString()?.Trim();
            if (string.IsNullOrWhiteSpace(raw))
                return null;

            if (raw.StartsWith('[') && raw.EndsWith(']'))
            {
                try
                {
                    var parsed = JsonSerializer.Deserialize<List<string>>(raw);
                    if (parsed is not null)
                        urls.AddRange(parsed.Where(u => !string.IsNullOrWhiteSpace(u)).Select(u => u.Trim()));
                }
                catch (JsonException)
                {
                    throw new AppException("DocumentUrls must be a JSON array of URL strings.");
                }
            }
            else
            {
                urls.Add(raw);
            }
        }
        else if (value.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in value.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.String)
                    throw new AppException("DocumentUrls array items must be strings.");

                var url = item.GetString()?.Trim();
                if (!string.IsNullOrWhiteSpace(url))
                    urls.Add(url);
            }
        }
        else
        {
            throw new AppException("DocumentUrls must be a JSON string or a string array.");
        }

        if (urls.Count == 0)
            return null;

        if (urls.Count > AdminConstants.MaxSellerDocumentUrls)
        {
            throw new AppException(
                $"DocumentUrls must not exceed {AdminConstants.MaxSellerDocumentUrls} items.");
        }

        foreach (var url in urls)
        {
            if (url.Length > AdminConstants.MaxSellerDocumentUrlLength)
            {
                throw new AppException(
                    $"Each document URL must not exceed {AdminConstants.MaxSellerDocumentUrlLength} characters.");
            }

            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)
                || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                throw new AppException("Each document URL must be an absolute http or https URL.");
            }
        }

        return JsonSerializer.Serialize(urls);
    }

    private static BuyerSellerRegistrationDto Map(SellerRegistrationRecord record) => new()
    {
        RequestId = record.RequestId,
        ShopName = record.ShopName,
        BusinessInfo = record.BusinessInfo,
        DocumentUrls = ParseDocumentUrls(record.DocumentUrlsJson),
        Status = record.Status,
        AdminNote = record.AdminNote,
        ReviewedAt = record.ReviewedAt,
        CreatedAt = record.CreatedAt
    };

    private static IReadOnlyList<string> ParseDocumentUrls(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return Array.Empty<string>();

        try
        {
            var urls = JsonSerializer.Deserialize<List<string>>(json);
            return urls?
                .Where(u => !string.IsNullOrWhiteSpace(u))
                .Select(u => u.Trim())
                .ToList()
                ?? (IReadOnlyList<string>)Array.Empty<string>();
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }

    private static string RequireText(string? value, string fieldName, int maxLength)
    {
        var trimmed = value?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new AppException($"{fieldName} is required.");
        if (trimmed.Length > maxLength)
            throw new AppException($"{fieldName} must not exceed {maxLength} characters.");
        return trimmed;
    }

    private static string? OptionalText(string? value, string fieldName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new AppException($"{fieldName} must not exceed {maxLength} characters.");
        return trimmed;
    }

    private static void EnsureUserId(Guid userId)
    {
        if (userId == Guid.Empty)
            throw new AppException("User id is required.");
    }
}
