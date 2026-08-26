using AIDR.Shared.Dtos.Seller;

namespace AIDR.Modules.SellerCenter.Abstractions;

public sealed class SellerShopSettingsRecord
{
    public Guid ShopId { get; init; }
    public Guid OwnerUserId { get; init; }
    public string ShopName { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? Tagline { get; init; }
    public string? ShortDescription { get; init; }
    public string? Description { get; init; }
    public string? LogoUrl { get; init; }
    public string? BannerUrl { get; init; }
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? Hotline { get; init; }
    public string? Province { get; init; }
    public string? District { get; init; }
    public string? Ward { get; init; }
    public string? StreetAddress { get; init; }
    public string? ReturnPolicy { get; init; }
    public string? ShippingPolicy { get; init; }
    public string? WebsiteUrl { get; init; }
    public string? FacebookUrl { get; init; }
    public string? OpeningHoursJson { get; init; }
    public string Status { get; init; } = null!;
    public bool IsVerified { get; init; }
    public DateTime? VerifiedAt { get; init; }
    public decimal AvgRating { get; init; }
    public int RatingCount { get; init; }
    public int FollowerCount { get; init; }
    public int ProductCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public interface ISellerShopRepository
{
    Task<SellerShopSettingsRecord?> GetByOwnerAsync(
        Guid ownerUserId,
        CancellationToken cancellationToken = default);

    Task<SellerShopSettingsRecord> UpdateAsync(
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
        string? returnPolicy,
        string? shippingPolicy,
        string? websiteUrl,
        string? facebookUrl,
        string? openingHoursJson,
        CancellationToken cancellationToken = default);
}

public interface ISellerShopService
{
    Task<SellerShopDto> GetMineAsync(
        Guid ownerUserId,
        CancellationToken cancellationToken = default);

    Task<SellerShopDto> UpdateMineAsync(
        Guid ownerUserId,
        UpdateSellerShopRequest request,
        CancellationToken cancellationToken = default);
}
