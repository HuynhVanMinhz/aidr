namespace AIDR.Shared.Dtos.Discovery;

public sealed class ProductQueryRequest
{
    public string? Q { get; set; }
    public Guid? ShopId { get; set; }
    public int? CategoryId { get; set; }
    /// <summary>Comma-separated category ids, e.g. 1,2,3</summary>
    public string? CategoryIds { get; set; }
    public string? Brand { get; set; }
    /// <summary>Comma-separated brand names</summary>
    public string? Brands { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public decimal? MinRating { get; set; }
    public bool? OnSale { get; set; }
    public bool? InStock { get; set; }
    /// <summary>Comma-separated: New, LikeNew, Refurbished, Used</summary>
    public string? Conditions { get; set; }
    /// <summary>Comma-separated key:value pairs, e.g. ram:8GB,storage:256GB</summary>
    public string? SpecFilters { get; set; }
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
    /// <summary>The cheapest way to buy this product - with variants, the cheapest variant.</summary>
    public decimal EffectivePrice { get; init; }
    /// <summary>The dearest variant; equal to <see cref="EffectivePrice"/> when there are none.</summary>
    public decimal MaxEffectivePrice { get; init; }
    public int VariantCount { get; init; }
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

/// <summary>An axis of the variant picker, e.g. <c>Color -> [Orange, White]</c>.</summary>
public sealed class ProductVariantOptionDto
{
    public string Name { get; init; } = null!;
    public IReadOnlyList<string> Values { get; init; } = Array.Empty<string>();
}

/// <summary>
/// One buyable configuration. The storefront matches the shopper's selection against
/// <see cref="Attributes"/> to find the variant, and takes the price and stock from it.
/// </summary>
public sealed class ProductVariantDto
{
    public Guid VariantId { get; init; }
    public string VariantName { get; init; } = null!;
    public string? Sku { get; init; }
    public IReadOnlyDictionary<string, string> Attributes { get; init; } =
        new Dictionary<string, string>();
    public decimal Price { get; init; }
    public decimal? SalePrice { get; init; }
    public decimal EffectivePrice { get; init; }
    public int StockQuantity { get; init; }
    public int AvailableQuantity { get; init; }
    public string? ImageUrl { get; init; }
    public int SortOrder { get; init; }
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
    /// <summary>Empty when the product is sold as a single configuration.</summary>
    public IReadOnlyList<ProductVariantOptionDto> VariantOptions { get; init; } =
        Array.Empty<ProductVariantOptionDto>();
    /// <summary>
    /// Only the active variants - a deactivated one must not be selectable. BasePrice and
    /// EffectivePrice above describe the cheapest of these, for the "from X" label.
    /// </summary>
    public IReadOnlyList<ProductVariantDto> Variants { get; init; } = Array.Empty<ProductVariantDto>();
    public decimal MaxEffectivePrice { get; init; }
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
    public int ProductCount { get; init; }
    public IReadOnlyList<CategoryTreeNodeDto> Children { get; init; } = Array.Empty<CategoryTreeNodeDto>();
}

public sealed class BrandFilterOptionDto
{
    public string Brand { get; init; } = null!;
    public int ProductCount { get; init; }
}
