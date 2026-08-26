using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.SellerCenter.Services;

public sealed class SellerShopService : ISellerShopService
{
    private readonly ISellerShopRepository _shops;

    public SellerShopService(ISellerShopRepository shops) => _shops = shops;

    public async Task<SellerShopDto> GetMineAsync(
        Guid ownerUserId,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(ownerUserId);

        var shop = await _shops.GetByOwnerAsync(ownerUserId, cancellationToken)
            ?? throw new NotFoundException("Shop not found.");

        return Map(shop);
    }

    public async Task<SellerShopDto> UpdateMineAsync(
        Guid ownerUserId,
        UpdateSellerShopRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(ownerUserId);
        if (request is null)
            throw new AppException("Shop update body is required.");

        var shopName = RequireText(request.ShopName, "Shop name", AdminConstants.MaxShopNameLength);

        var updated = await _shops.UpdateAsync(
            ownerUserId,
            shopName,
            OptionalText(request.Tagline, "Tagline", AdminConstants.MaxShopTaglineLength),
            OptionalText(request.ShortDescription, "Short description", AdminConstants.MaxShopShortDescriptionLength),
            OptionalText(request.Description, "Description", int.MaxValue),
            OptionalUrl(request.LogoUrl, "Logo URL"),
            OptionalUrl(request.BannerUrl, "Banner URL"),
            OptionalText(request.Email, "Email", AdminConstants.MaxShopEmailLength),
            OptionalText(request.Phone, "Phone", AdminConstants.MaxShopPhoneLength),
            OptionalText(request.Hotline, "Hotline", AdminConstants.MaxShopPhoneLength),
            OptionalText(request.Province, "Province", AdminConstants.MaxShopProvinceLength),
            OptionalText(request.District, "District", AdminConstants.MaxShopDistrictLength),
            OptionalText(request.Ward, "Ward", AdminConstants.MaxShopWardLength),
            OptionalText(request.StreetAddress, "Street address", AdminConstants.MaxShopStreetAddressLength),
            OptionalText(request.ReturnPolicy, "Return policy", AdminConstants.MaxShopPolicyLength),
            OptionalText(request.ShippingPolicy, "Shipping policy", AdminConstants.MaxShopPolicyLength),
            OptionalUrl(request.WebsiteUrl, "Website URL"),
            OptionalUrl(request.FacebookUrl, "Facebook URL"),
            OptionalText(request.OpeningHoursJson, "Opening hours JSON", AdminConstants.MaxShopOpeningHoursJsonLength),
            cancellationToken);

        return Map(updated);
    }

    private static SellerShopDto Map(SellerShopSettingsRecord shop) => new()
    {
        ShopId = shop.ShopId,
        ShopName = shop.ShopName,
        Slug = shop.Slug,
        Tagline = shop.Tagline,
        ShortDescription = shop.ShortDescription,
        Description = shop.Description,
        LogoUrl = shop.LogoUrl,
        BannerUrl = shop.BannerUrl,
        Email = shop.Email,
        Phone = shop.Phone,
        Hotline = shop.Hotline,
        Province = shop.Province,
        District = shop.District,
        Ward = shop.Ward,
        StreetAddress = shop.StreetAddress,
        ReturnPolicy = shop.ReturnPolicy,
        ShippingPolicy = shop.ShippingPolicy,
        WebsiteUrl = shop.WebsiteUrl,
        FacebookUrl = shop.FacebookUrl,
        OpeningHoursJson = shop.OpeningHoursJson,
        Status = shop.Status,
        IsVerified = shop.IsVerified,
        VerifiedAt = shop.VerifiedAt,
        AvgRating = shop.AvgRating,
        RatingCount = shop.RatingCount,
        FollowerCount = shop.FollowerCount,
        ProductCount = shop.ProductCount,
        CreatedAt = shop.CreatedAt,
        UpdatedAt = shop.UpdatedAt
    };

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

    private static string? OptionalUrl(string? value, string fieldName)
    {
        var trimmed = OptionalText(value, fieldName, AdminConstants.MaxShopUrlLength);
        if (trimmed is null)
            return null;

        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new AppException($"{fieldName} must be an absolute http or https URL.");
        }

        return trimmed;
    }

    private static void EnsureUserId(Guid userId)
    {
        if (userId == Guid.Empty)
            throw new AppException("User id is required.");
    }
}
