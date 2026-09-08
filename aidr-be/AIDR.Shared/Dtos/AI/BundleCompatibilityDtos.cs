namespace AIDR.Shared.Dtos.AI;

public sealed class ProductBundleDto
{
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public IReadOnlyList<BundleItemDto> Items { get; init; } = Array.Empty<BundleItemDto>();
    public int TotalCount { get; init; }
    public string Source { get; init; } = null!;
}

public sealed class BundleItemDto
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
    public int AvailableQuantity { get; init; }
    public decimal AvgRating { get; init; }
    public int ReviewCount { get; init; }
    public string? PrimaryImageUrl { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string? Reason { get; init; }
}

public sealed class CompatibilityCheckRequest
{
    public Guid PrimaryProductId { get; set; }
    public Guid? SecondaryProductId { get; set; }
    public string? FreeTextDevice { get; set; }
}

public sealed class CompatibilityResultDto
{
    public string Verdict { get; init; } = null!;
    public string Headline { get; init; } = null!;
    public IReadOnlyList<string> Reasons { get; init; } = Array.Empty<string>();
    public IReadOnlyList<MatchedSpecDto> MatchedSpecs { get; init; } = Array.Empty<MatchedSpecDto>();
    public string Source { get; init; } = null!;
}

public sealed class MatchedSpecDto
{
    public string Label { get; init; } = null!;
    public string? Primary { get; init; }
    public string? Secondary { get; init; }
}

public sealed class ProductBundleSourceRecord
{
    public Guid ProductId { get; init; }
    public string Name { get; init; } = null!;
    public Guid ShopId { get; init; }
    public int CategoryId { get; init; }
    public string CategorySlug { get; init; } = null!;
    public int? CategoryParentId { get; init; }
}

public sealed class BundleCandidateRecord
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
    public string? PrimaryImageUrl { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public bool SameShop { get; init; }
}
