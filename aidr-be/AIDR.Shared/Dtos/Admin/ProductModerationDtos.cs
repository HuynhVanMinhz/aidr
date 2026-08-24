namespace AIDR.Shared.Dtos.Admin;

public sealed class AdminProductImageDto
{
    public Guid ProductImageId { get; init; }
    public string ImageUrl { get; init; } = null!;
    public string? PublicId { get; init; }
    public int SortOrder { get; init; }
    public bool IsPrimary { get; init; }
}

public sealed class AdminProductListItemDto
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
    public string Status { get; init; } = null!;
    public string? PrimaryImageUrl { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public DateTime? PublishedAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public sealed class AdminProductDetailDto
{
    public Guid ProductId { get; init; }
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
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
    public IReadOnlyList<AdminProductImageDto> Images { get; init; } = Array.Empty<AdminProductImageDto>();
}

public sealed class AdminProductListResultDto
{
    public IReadOnlyList<AdminProductListItemDto> Items { get; init; } =
        Array.Empty<AdminProductListItemDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
    public int PendingCount { get; init; }
    public int ApprovedCount { get; init; }
    public int RejectedCount { get; init; }
}

public sealed class RejectProductRequest
{
    public string Reason { get; set; } = null!;
}

public sealed class ProductModerationHistoryItemDto
{
    public long ModerationId { get; init; }
    public Guid ProductId { get; init; }
    public Guid AdminUserId { get; init; }
    public string AdminFullName { get; init; } = null!;
    public string Action { get; init; } = null!;
    public string FromStatus { get; init; } = null!;
    public string ToStatus { get; init; } = null!;
    public string? Reason { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class ProductModerationHistoryResultDto
{
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public string CurrentStatus { get; init; } = null!;
    public IReadOnlyList<ProductModerationHistoryItemDto> Items { get; init; } =
        Array.Empty<ProductModerationHistoryItemDto>();
}
