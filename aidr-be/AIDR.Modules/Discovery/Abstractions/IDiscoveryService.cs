using AIDR.Shared.Dtos.Discovery;

namespace AIDR.Modules.Discovery.Abstractions;

public sealed class ProductListQuery
{
    public string? Q { get; init; }
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
}
