namespace AIDR.Shared.Dtos.Seller;

public sealed class SellerProductQueryRequest
{
    /// <summary>Filter by status; omit or "all" for every non-deleted product. Use "Deleted" to list soft-deleted.</summary>
    public string? Status { get; set; }
    public string? Q { get; set; }
    public int? CategoryId { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public sealed class SellerProductImageDto
{
    public Guid ProductImageId { get; init; }
    public string ImageUrl { get; init; } = null!;
    public string? PublicId { get; init; }
    public int SortOrder { get; init; }
    public bool IsPrimary { get; init; }
}

public sealed class SellerProductListItemDto
{
    public Guid ProductId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? ShortDescription { get; init; }
    public string? Brand { get; init; }
    public string ConditionType { get; init; } = null!;
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public decimal EffectivePrice { get; init; }
    public string Currency { get; init; } = "VND";
    public int StockQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public string Status { get; init; } = null!;
    public string? PrimaryImageUrl { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = null!;
    public Guid ShopId { get; init; }
    public DateTime? PublishedAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public sealed class SellerProductDetailDto
{
    public Guid ProductId { get; init; }
    public Guid ShopId { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = null!;
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
    public int ReservedQuantity { get; init; }
    public int? WarrantyMonths { get; init; }
    public string? OriginCountry { get; init; }
    public string? TagsJson { get; init; }
    public string? SpecsJson { get; init; }
    public bool IsFeatured { get; init; }
    public string Status { get; init; } = null!;
    public DateTime? PublishedAt { get; init; }
    public decimal AvgRating { get; init; }
    public int ReviewCount { get; init; }
    public int SoldCount { get; init; }
    public int ViewCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public IReadOnlyList<SellerProductImageDto> Images { get; init; } = Array.Empty<SellerProductImageDto>();
}

public sealed class SellerProductImageInput
{
    public string ImageUrl { get; set; } = null!;
    public string? PublicId { get; set; }
    public int SortOrder { get; set; }
    public bool IsPrimary { get; set; }
}

public sealed class CreateSellerProductRequest
{
    public int CategoryId { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string? ShortDescription { get; set; }
    public string? Description { get; set; }
    public string? Brand { get; set; }
    public string? ModelNumber { get; set; }
    public string ConditionType { get; set; } = "New";
    public decimal BasePrice { get; set; }
    public decimal? SalePrice { get; set; }
    public int? WarrantyMonths { get; set; }
    public string? OriginCountry { get; set; }
    public string? TagsJson { get; set; }
    public string? SpecsJson { get; set; }
    public IReadOnlyList<SellerProductImageInput>? Images { get; set; }
}

public sealed class UpdateSellerProductRequest
{
    public int CategoryId { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string? ShortDescription { get; set; }
    public string? Description { get; set; }
    public string? Brand { get; set; }
    public string? ModelNumber { get; set; }
    public string ConditionType { get; set; } = "New";
    public decimal BasePrice { get; set; }
    public decimal? SalePrice { get; set; }
    public int? WarrantyMonths { get; set; }
    public string? OriginCountry { get; set; }
    public string? TagsJson { get; set; }
    public string? SpecsJson { get; set; }
}

public sealed class UploadSellerProductImagesRequest
{
    public IReadOnlyList<SellerProductImageInput> Images { get; set; } = Array.Empty<SellerProductImageInput>();
    /// <summary>When true, replace existing images with the provided set.</summary>
    public bool ReplaceExisting { get; set; }
}
