using AIDR.Infrastructure.Persistence;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.SellerCenter;

public sealed class SellerShopRepository : ISellerShopRepository
{
    private readonly AidrDbContext _db;

    public SellerShopRepository(AidrDbContext db) => _db = db;

    public async Task<SellerShopSettingsRecord?> GetByOwnerAsync(
        Guid ownerUserId,
        CancellationToken cancellationToken = default)
    {
        var shop = await _db.Shops.AsNoTracking()
            .FirstOrDefaultAsync(s => s.OwnerUserId == ownerUserId, cancellationToken);

        return shop is null ? null : Map(shop);
    }

    public async Task<SellerShopSettingsRecord> UpdateAsync(
        Guid ownerUserId,
        string shopName,
        string? tagline,
        string? shortDescription,
        string? description,
        string? logoUrl,
        string? bannerUrl,
        string? email,
        string? phone,
        string? hotline,
        string? province,
        string? district,
        string? ward,
        string? streetAddress,
        double? latitude,
        double? longitude,
        string? returnPolicy,
        string? shippingPolicy,
        string? websiteUrl,
        string? facebookUrl,
        string? openingHoursJson,
        CancellationToken cancellationToken = default)
    {
        var shop = await _db.Shops
            .FirstOrDefaultAsync(s => s.OwnerUserId == ownerUserId, cancellationToken)
            ?? throw new NotFoundException("Shop not found.");

        shop.ShopName = shopName;
        shop.Tagline = tagline;
        shop.ShortDescription = shortDescription;
        shop.Description = description;
        shop.LogoUrl = logoUrl;
        shop.BannerUrl = bannerUrl;
        shop.Email = email;
        shop.Phone = phone;
        shop.Hotline = hotline;
        shop.Province = province;
        shop.District = district;
        shop.Ward = ward;
        shop.StreetAddress = streetAddress;
        shop.Latitude = latitude;
        shop.Longitude = longitude;
        shop.ReturnPolicy = returnPolicy;
        shop.ShippingPolicy = shippingPolicy;
        shop.WebsiteUrl = websiteUrl;
        shop.FacebookUrl = facebookUrl;
        shop.OpeningHoursJson = openingHoursJson;
        // Keep Slug stable — do not regenerate from ShopName.
        shop.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
        return Map(shop);
    }

    private static SellerShopSettingsRecord Map(Persistence.Entities.Shop shop) => new()
    {
        ShopId = shop.ShopId,
        OwnerUserId = shop.OwnerUserId,
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
        Latitude = shop.Latitude,
        Longitude = shop.Longitude,
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
}
