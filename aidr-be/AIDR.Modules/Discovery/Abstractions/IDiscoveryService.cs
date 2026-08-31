using AIDR.Shared.Dtos.Discovery;

namespace AIDR.Modules.Discovery.Abstractions;

public sealed class ProductListQuery
{
    public string? Q { get; init; }
    public Guid? ShopId { get; init; }
    /// <summary>Restrict the result to these ids — used by the batch lookup for link previews.</summary>
    public IReadOnlyList<Guid> ProductIds { get; init; } = Array.Empty<Guid>();
    public int? CategoryId { get; init; }
    public IReadOnlyList<int> CategoryIds { get; init; } = Array.Empty<int>();
    public string? Brand { get; init; }
    public IReadOnlyList<string> Brands { get; init; } = Array.Empty<string>();
    public decimal? MinPrice { get; init; }
    public decimal? MaxPrice { get; init; }
    public decimal? MinRating { get; init; }
    public bool? OnSale { get; init; }
    public bool? InStock { get; init; }
    public IReadOnlyList<string> Conditions { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> SpecFilters { get; init; }
        = new Dictionary<string, string>();
    public string Sort { get; init; } = "newest";
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
}

public sealed class ProductListRecord
{
    /// <summary>Dearest active variant; equal to the product price when there are none.</summary>
    public decimal? MaxVariantEffectivePrice { get; init; }
    public int VariantCount { get; init; }
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

public sealed class ProductVariantRecord
{
    public Guid VariantId { get; init; }
    public string VariantName { get; init; } = null!;
    public string? Sku { get; init; }
    public string? AttributesJson { get; init; }
    public decimal Price { get; init; }
    public decimal? SalePrice { get; init; }
    public int StockQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public string? ImageUrl { get; init; }
    public int SortOrder { get; init; }
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
    public string? VariantOptionsJson { get; init; }
    public IReadOnlyList<ProductImageRecord> Images { get; init; } = Array.Empty<ProductImageRecord>();
    public IReadOnlyList<ProductReviewRecord> RecentReviews { get; init; } = Array.Empty<ProductReviewRecord>();
    /// <summary>Active variants only — the storefront must not offer one that is off sale.</summary>
    public IReadOnlyList<ProductVariantRecord> Variants { get; init; } = Array.Empty<ProductVariantRecord>();
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

public sealed class BrandFilterRecord
{
    public string Brand { get; init; } = null!;
    public int ProductCount { get; init; }
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

public sealed class ShopListRecord
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

    Task<IReadOnlyDictionary<int, int>> GetApprovedProductCountsByCategoryAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<BrandFilterRecord>> GetApprovedBrandOptionsAsync(
        CancellationToken cancellationToken = default);

    Task<ShopPublicRecord?> GetActiveShopByKeyAsync(
        string shopKey,
        CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<ShopListRecord> Items, int TotalCount)> ListActiveShopsAsync(
        int page,
        int pageSize,
        string sort,
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

    /// <summary>
    /// Resolve a handful of approved products by id for link previews (chat cards, shared links).
    /// Unlike <c>GetProductAsync</c> this records no view and returns only list-level fields.
    /// </summary>
    Task<IReadOnlyList<ProductListItemDto>> LookupProductsAsync(
        IReadOnlyList<Guid> productIds,
        CancellationToken cancellationToken = default);

    Task<ProductDetailDto> GetProductAsync(
        Guid productId,
        Guid? viewerUserId,
        string? sessionId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CategoryTreeNodeDto>> GetCategoryTreeAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<BrandFilterOptionDto>> GetBrandFilterOptionsAsync(
        CancellationToken cancellationToken = default);

    Task<PagedResult<ShopListItemDto>> ListShopsAsync(
        int page,
        int pageSize,
        string? sort = null,
        CancellationToken cancellationToken = default);

    Task<ShopPublicDetailDto> GetShopAsync(
        string shopKey,
        ShopProductsQueryRequest? productsQuery = null,
        CancellationToken cancellationToken = default);

    Task<ShopSellerRatingDto> GetShopRatingAsync(
        string shopKey,
        CancellationToken cancellationToken = default);
}
