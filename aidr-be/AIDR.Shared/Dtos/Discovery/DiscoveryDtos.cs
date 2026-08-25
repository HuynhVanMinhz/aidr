namespace AIDR.Shared.Dtos.Discovery;

public sealed class ProductQueryRequest
{
    public string? Q { get; set; }
    public Guid? ShopId { get; set; }
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

public sealed class PagedResult<T>
{
    public IReadOnlyList<T> Items { get; init; } = Array.Empty<T>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public sealed class ProductListItemDto
{
    public Guid ProductId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? ShortDescription { get; init; }
    public string? Brand { get; init; }
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public decimal EffectivePrice { get; init; }
    public string Currency { get; init; } = "VND";
    public int StockQuantity { get; init; }
    public int AvailableQuantity { get; init; }
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

public sealed class ProductImageDto
{
    public Guid ProductImageId { get; init; }
    public string ImageUrl { get; init; } = null!;
    public int SortOrder { get; init; }
    public bool IsPrimary { get; init; }
}

public sealed class ProductShopSummaryDto
{
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? LogoUrl { get; init; }
    public bool IsVerified { get; init; }
    public decimal AvgRating { get; init; }
    public int RatingCount { get; init; }
}

public sealed class ProductCategorySummaryDto
{
    public int CategoryId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
}

public sealed class ProductReviewSummaryDto
{
    public Guid ReviewId { get; init; }
    public byte Rating { get; init; }
    public string? Title { get; init; }
    public string? Content { get; init; }
    public string BuyerName { get; init; } = null!;
    public DateTime CreatedAt { get; init; }
}

public sealed class ProductDetailDto
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
    public decimal EffectivePrice { get; init; }
    public string Currency { get; init; } = "VND";
    public int StockQuantity { get; init; }
    public int AvailableQuantity { get; init; }
    public int? WarrantyMonths { get; init; }
    public string? OriginCountry { get; init; }
    public string? SpecsJson { get; init; }
    public string? TagsJson { get; init; }
    public decimal AvgRating { get; init; }
    public int ReviewCount { get; init; }
    public int SoldCount { get; init; }
    public int ViewCount { get; set; }
    public bool IsFeatured { get; init; }
    public DateTime? PublishedAt { get; init; }
    public ProductCategorySummaryDto Category { get; init; } = null!;
    public ProductShopSummaryDto Shop { get; init; } = null!;
    public IReadOnlyList<ProductImageDto> Images { get; init; } = Array.Empty<ProductImageDto>();
    public IReadOnlyList<ProductReviewSummaryDto> RecentReviews { get; init; } = Array.Empty<ProductReviewSummaryDto>();
}

public sealed class CategoryTreeNodeDto
{
    public int CategoryId { get; init; }
    public int? ParentId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? Description { get; init; }
    public string? ImageUrl { get; init; }
    public int SortOrder { get; init; }
    public IReadOnlyList<CategoryTreeNodeDto> Children { get; init; } = Array.Empty<CategoryTreeNodeDto>();
}
