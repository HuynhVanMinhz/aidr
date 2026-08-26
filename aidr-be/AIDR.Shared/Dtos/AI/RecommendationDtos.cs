namespace AIDR.Shared.Dtos.AI;

public sealed class RecommendationQueryRequest
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 12;
}

public sealed class SimilarProductsQueryRequest
{
    /// <summary>Max similar products to return (default 12, max 48).</summary>
    public int? Limit { get; set; }
}

/// <summary>Catalog card plus recommendation metadata for home / "For you" blocks.</summary>
public sealed class RecommendedProductDto
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

    /// <summary>0–1 relative score used for ranking.</summary>
    public decimal Score { get; init; }

    /// <summary>Collaborative | Content | Hybrid | Popular</summary>
    public string Strategy { get; init; } = null!;
}

/// <summary>Similar product card for product detail cross-sell.</summary>
public sealed class SimilarProductDto
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

    /// <summary>Content-similarity score (higher = closer).</summary>
    public decimal Score { get; init; }
}
