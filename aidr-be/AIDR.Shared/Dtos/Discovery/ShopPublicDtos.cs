namespace AIDR.Shared.Dtos.Discovery;

public sealed class ShopProductsQueryRequest
{
    public string? Q { get; set; }
    public int? CategoryId { get; set; }
    public string? Brand { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public decimal? MinRating { get; set; }
    /// <summary>newest | price_asc | price_desc | popular | rating</summary>
    public string? Sort { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public sealed class ShopPublicAddressDto
{
    public string? Province { get; init; }
    public string? District { get; init; }
    public string? Ward { get; init; }
    public string? StreetAddress { get; init; }
}

public sealed class ShopPublicContactDto
{
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? Hotline { get; init; }
    public string? WebsiteUrl { get; init; }
    public string? FacebookUrl { get; init; }
}

public sealed class ShopSellerRatingDto
{
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public decimal AvgRating { get; init; }
    public int RatingCount { get; init; }
}

/// <summary>Compact public shop card for listings (home / directory).</summary>
public sealed class ShopListItemDto
{
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? Tagline { get; init; }
    public string? LogoUrl { get; init; }
    public bool IsVerified { get; init; }
    public decimal AvgRating { get; init; }
    public int RatingCount { get; init; }
    public int FollowerCount { get; init; }
    public int ProductCount { get; init; }
}

public sealed class ShopPublicDetailDto
{
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? Tagline { get; init; }
    public string? ShortDescription { get; init; }
    public string? Description { get; init; }
    public string? LogoUrl { get; init; }
    public string? BannerUrl { get; init; }
    public bool IsVerified { get; init; }
    public DateTime? VerifiedAt { get; init; }
    public decimal AvgRating { get; init; }
    public int RatingCount { get; init; }
    public int FollowerCount { get; init; }
    public int ProductCount { get; init; }
    public string? ReturnPolicy { get; init; }
    public string? ShippingPolicy { get; init; }
    public string? OpeningHoursJson { get; init; }
    public ShopPublicContactDto Contact { get; init; } = null!;
    public ShopPublicAddressDto Address { get; init; } = null!;
    public DateTime CreatedAt { get; init; }
    public PagedResult<ProductListItemDto> Products { get; init; } = null!;
}
