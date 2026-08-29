using System.Text.Json;
using System.Text.RegularExpressions;
using AIDR.Modules.Kyc.Abstractions;
using AIDR.Modules.Profile.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Kyc;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Profile.Services;

public sealed class SellerRegistrationService : ISellerRegistrationService
{
    /// <summary>Vietnamese tax code: 10 digits, optionally a 3-digit branch suffix.</summary>
    private static readonly Regex TaxCodePattern = new(@"^\d{10}(-\d{3})?$", RegexOptions.Compiled);

    private readonly ISellerRegistrationRepository _repository;
    private readonly IKycRepository _kyc;

    public SellerRegistrationService(
        ISellerRegistrationRepository repository,
        IKycRepository kyc)
    {
        _repository = repository;
        _kyc = kyc;
    }

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

        var kyc = await RequireUsableKycAsync(userId, cancellationToken);
        var model = await BuildModelAsync(request, kyc, null, cancellationToken);

        var record = await _repository.CreateAsync(userId, model, cancellationToken);
        return Map(record, kyc);
    }

    public async Task<BuyerSellerRegistrationDto> UpdateMineAsync(
        Guid userId,
        CreateSellerRegistrationRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId);
        if (request is null)
            throw new AppException("Seller registration request body is required.");

        var existing = await _repository.GetLatestForUserAsync(userId, cancellationToken)
            ?? throw new NotFoundException("Seller registration request not found.");

        if (!SellerRegistrationConstants.EditableStatuses.Contains(existing.Status))
        {
            throw new ConflictException(
                $"A {existing.Status.ToLowerInvariant()} application cannot be edited.");
        }

        var kyc = await RequireUsableKycAsync(userId, cancellationToken);
        var model = await BuildModelAsync(request, kyc, existing.RequestId, cancellationToken);

        var record = await _repository.UpdateAsync(existing.RequestId, model, cancellationToken);
        return Map(record, kyc);
    }

    /// <summary>
    /// No identity check, no application. Enforced here and not just in the UI —
    /// the endpoint is reachable directly.
    /// </summary>
    private async Task<KycVerificationDto> RequireUsableKycAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var kyc = await _kyc.GetLatestForUserAsync(userId, cancellationToken);

        if (kyc is null)
        {
            throw new ConflictException(
                "Verify your identity before applying to sell. Go to Become a seller and complete the eKYC step.");
        }

        if (!KycConstants.UsableStatuses.Contains(kyc.Status))
        {
            throw new ConflictException(
                kyc.FailureReason
                ?? "Your identity verification did not pass. Please try the eKYC step again.");
        }

        return kyc;
    }

    private async Task<SellerRegistrationWriteModel> BuildModelAsync(
        CreateSellerRegistrationRequest request,
        KycVerificationDto kyc,
        Guid? excludeRequestId,
        CancellationToken cancellationToken)
    {
        var shopName = RequireText(request.ShopName, "Shop name", AdminConstants.MaxShopNameLength);

        if (await _repository.ShopNameTakenAsync(shopName, excludeRequestId, cancellationToken))
            throw new ConflictException("That shop name is already taken. Pick another one.");

        var businessType = NormalizeBusinessType(request.BusinessType);
        var needsLicense = SellerRegistrationConstants.RegisteredBusinessTypes.Contains(businessType);

        var taxCode = OptionalText(
            request.TaxCode,
            "Tax code",
            SellerRegistrationConstants.MaxTaxCodeLength);

        if (needsLicense)
        {
            if (string.IsNullOrWhiteSpace(taxCode))
                throw new AppException("A tax code is required for household and company sellers.");

            if (!TaxCodePattern.IsMatch(taxCode))
                throw new AppException("Tax code must be 10 digits, optionally followed by -NNN.");
        }

        var licenseUrl = OptionalUrl(request.LicenseImageUrl, "Business licence image");
        if (needsLicense && string.IsNullOrWhiteSpace(licenseUrl))
        {
            throw new AppException(
                "Upload a photo of the business licence for household and company sellers.");
        }

        return new SellerRegistrationWriteModel
        {
            ShopName = shopName,
            BusinessInfo = OptionalText(
                request.BusinessInfo,
                "Business info",
                AdminConstants.MaxSellerBusinessInfoLength),
            DocumentUrlsJson = NormalizeDocumentUrls(request.DocumentUrls),
            KycVerificationId = kyc.KycVerificationId,
            BusinessType = businessType,
            TaxCode = needsLicense ? taxCode : null,
            BusinessAddress = OptionalText(
                request.BusinessAddress,
                "Business address",
                SellerRegistrationConstants.MaxBusinessAddressLength),
            ContactPhone = OptionalText(
                request.ContactPhone,
                "Contact phone",
                SellerRegistrationConstants.MaxContactPhoneLength),
            ContactEmail = OptionalText(
                request.ContactEmail,
                "Contact email",
                SellerRegistrationConstants.MaxContactEmailLength),
            LicenseImageUrl = licenseUrl,
        };
    }

    private static string NormalizeBusinessType(string? value)
    {
        var raw = value?.Trim();
        if (string.IsNullOrWhiteSpace(raw))
            throw new AppException("Choose how you are selling: individual, household, or company.");

        var match = SellerRegistrationConstants.BusinessTypes
            .FirstOrDefault(t => string.Equals(t, raw, StringComparison.OrdinalIgnoreCase));

        return match ?? throw new AppException($"Unknown business type '{raw}'.");
    }

    private static string? OptionalUrl(string? value, string label)
    {
        var url = value?.Trim();
        if (string.IsNullOrWhiteSpace(url))
            return null;

        if (url.Length > AdminConstants.MaxSellerDocumentUrlLength)
            throw new AppException($"{label} URL is too long.");

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new AppException($"{label} must be an absolute http or https URL.");
        }

        return url;
    }

    public async Task<BuyerSellerRegistrationDto> GetMineAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId);

        var record = await _repository.GetLatestForUserAsync(userId, cancellationToken)
            ?? throw new NotFoundException("Seller registration request not found.");

        var kyc = record.KycVerificationId is { } kycId
            ? await _kyc.GetByIdAsync(kycId, cancellationToken)
            : await _kyc.GetLatestForUserAsync(userId, cancellationToken);

        return Map(record, kyc);
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

    private static BuyerSellerRegistrationDto Map(
        SellerRegistrationRecord record,
        KycVerificationDto? kyc) => new()
    {
        RequestId = record.RequestId,
        ShopName = record.ShopName,
        BusinessInfo = record.BusinessInfo,
        BusinessType = record.BusinessType,
        TaxCode = record.TaxCode,
        BusinessAddress = record.BusinessAddress,
        ContactPhone = record.ContactPhone,
        ContactEmail = record.ContactEmail,
        LicenseImageUrl = record.LicenseImageUrl,
        DocumentUrls = ParseDocumentUrls(record.DocumentUrlsJson),
        Status = record.Status,
        AdminNote = record.AdminNote,
        ReviewedAt = record.ReviewedAt,
        CreatedAt = record.CreatedAt,
        UpdatedAt = record.UpdatedAt,
        Kyc = kyc,
        CanEdit = SellerRegistrationConstants.EditableStatuses.Contains(record.Status)
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
