namespace AIDR.Shared.Dtos.Seller;

public sealed class SellerShopDto
{
    public Guid ShopId { get; init; }
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

    /// <summary>Pickup point on the map; the start of the order tracking route.</summary>
    public double? Latitude { get; init; }
    public double? Longitude { get; init; }

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

public sealed class UpdateSellerShopRequest
{
    public string ShopName { get; set; } = null!;
    public string? Tagline { get; set; }
    public string? ShortDescription { get; set; }
    public string? Description { get; set; }
    public string? LogoUrl { get; set; }
    public string? BannerUrl { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Hotline { get; set; }
    public string? Province { get; set; }
    public string? District { get; set; }
    public string? Ward { get; set; }
    public string? StreetAddress { get; set; }

    /// <summary>Pickup point on the map; the start of the order tracking route.</summary>
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    public string? ReturnPolicy { get; set; }
    public string? ShippingPolicy { get; set; }
    public string? WebsiteUrl { get; set; }
    public string? FacebookUrl { get; set; }
    public string? OpeningHoursJson { get; set; }
}
