using AIDR.Shared.Dtos.Discovery;

namespace AIDR.Modules.Discovery.Abstractions;

public sealed class ProductListQuery
{
    public string? Q { get; init; }
    public Guid? ShopId { get; init; }
    public int? CategoryId { get; init; }
    public string? Brand { get; init; }
    public decimal? MinPrice { get; init; }
    public decimal? MaxPrice { get; init; }
    public decimal? MinRating { get; init; }
    public string Sort { get; init; } = "newest";
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
}

public sealed class ProductListRecord
{
    public Guid ProductId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? ShortDescription { get; init; }
    public string? Brand { get; init; }
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public string Currency { get; init; } = "VND";
    public int StockQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public decimal AvgRating { get; init; }
    public int ReviewCount { get; init; }
    public int SoldCount { get; init; }
    public bool IsFeatured { get; init; }
    public string? PrimaryImageUrl { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public DateTime? PublishedAt { get; init; }
}

public sealed class ProductImageRecord
{
    public Guid ProductImageId { get; init; }
    public string ImageUrl { get; init; } = null!;
    public int SortOrder { get; init; }
    public bool IsPrimary { get; init; }
}

public sealed class ProductReviewRecord
{
    public Guid ReviewId { get; init; }
    public byte Rating { get; init; }
    public string? Title { get; init; }
    public string? Content { get; init; }
    public string BuyerName { get; init; } = null!;
    public DateTime CreatedAt { get; init; }
}

public sealed class ProductDetailRecord
{
    public Guid ProductId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? ShortDescription { get; init; }
    public string? Description { get; init; }
    public string? Brand { get; init; }
    public string? ModelNumber { get; init; }
    public string ConditionType { get; init; } = null!;
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public string Currency { get; init; } = "VND";
    public int StockQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public int? WarrantyMonths { get; init; }
    public string? OriginCountry { get; init; }
    public string? SpecsJson { get; init; }
    public string? TagsJson { get; init; }
    public decimal AvgRating { get; init; }
    public int ReviewCount { get; init; }
    public int SoldCount { get; init; }
    public int ViewCount { get; init; }
    public bool IsFeatured { get; init; }
    public DateTime? PublishedAt { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = null!;
    public string CategorySlug { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string ShopSlug { get; init; } = null!;
    public string? ShopLogoUrl { get; init; }
    public bool ShopIsVerified { get; init; }
    public decimal ShopAvgRating { get; init; }
    public int ShopRatingCount { get; init; }
    public IReadOnlyList<ProductImageRecord> Images { get; init; } = Array.Empty<ProductImageRecord>();
    public IReadOnlyList<ProductReviewRecord> RecentReviews { get; init; } = Array.Empty<ProductReviewRecord>();
}

public sealed class CategoryRecord
{
    public int CategoryId { get; init; }
    public int? ParentId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? Description { get; init; }
    public string? ImageUrl { get; init; }
    public int SortOrder { get; init; }
}

public sealed class ShopPublicRecord
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
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? Hotline { get; init; }
    public string? WebsiteUrl { get; init; }
    public string? FacebookUrl { get; init; }
    public string? Province { get; init; }
    public string? District { get; init; }
    public string? Ward { get; init; }
    public string? StreetAddress { get; init; }
    public DateTime CreatedAt { get; init; }
}

public interface IDiscoveryRepository
{
    Task<(IReadOnlyList<ProductListRecord> Items, int TotalCount)> QueryApprovedProductsAsync(
        ProductListQuery query,
        CancellationToken cancellationToken = default);

    Task<ProductDetailRecord?> GetApprovedProductByIdAsync(
        Guid productId,
        int recentReviewsLimit,
        CancellationToken cancellationToken = default);

    Task RecordProductViewAsync(
        Guid productId,
        Guid? userId,
        string? sessionId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CategoryRecord>> GetActiveCategoriesAsync(
        CancellationToken cancellationToken = default);

    Task<ShopPublicRecord?> GetActiveShopByKeyAsync(
        string shopKey,
        CancellationToken cancellationToken = default);
}

public interface IDiscoveryService
{
    Task<PagedResult<ProductListItemDto>> ListProductsAsync(
        ProductQueryRequest request,
        CancellationToken cancellationToken = default);

    Task<PagedResult<ProductListItemDto>> SearchProductsAsync(
        ProductQueryRequest request,
        CancellationToken cancellationToken = default);

    Task<ProductDetailDto> GetProductAsync(
        Guid productId,
        Guid? viewerUserId,
        string? sessionId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CategoryTreeNodeDto>> GetCategoryTreeAsync(
        CancellationToken cancellationToken = default);

    Task<ShopPublicDetailDto> GetShopAsync(
        string shopKey,
        ShopProductsQueryRequest? productsQuery = null,
        CancellationToken cancellationToken = default);

    Task<ShopSellerRatingDto> GetShopRatingAsync(
        string shopKey,
        CancellationToken cancellationToken = default);
}
