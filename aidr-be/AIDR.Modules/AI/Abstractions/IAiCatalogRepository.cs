using AIDR.Shared.Dtos.Discovery;

namespace AIDR.Modules.AI.Abstractions;

public sealed class AiCategoryLookup
{
    public int CategoryId { get; init; }
    public int? ParentId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
}

public sealed class AiCompareProductRecord
{
    public Guid ProductId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? ShortDescription { get; init; }
    public string? Brand { get; init; }
    public string? ModelNumber { get; init; }
    public string ConditionType { get; init; } = "New";
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public string Currency { get; init; } = "VND";
    public decimal AvgRating { get; init; }
    public int ReviewCount { get; init; }
    public int? WarrantyMonths { get; init; }
    public string? OriginCountry { get; init; }
    public int StockQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public int SoldCount { get; init; }
    public string? SpecsJson { get; init; }
    public string? TagsJson { get; init; }
    public string? PrimaryImageUrl { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
}

/// <summary>Price distribution of Approved products in a filter scope - drives budget chips.</summary>
public sealed class AiPriceBands
{
    /// <summary>Matching products, capped at <see cref="AIDR.Shared.Constants.AiConstants.PriceBandSampleSize"/>.</summary>
    public int Count { get; init; }

    public decimal Min { get; init; }
    public decimal P33 { get; init; }
    public decimal P66 { get; init; }
    public decimal Max { get; init; }

    public static AiPriceBands Empty { get; } = new();
}

public interface IAiCatalogRepository
{
    Task<IReadOnlyList<AiCategoryLookup>> GetActiveCategoriesAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AiCompareProductRecord>> GetApprovedProductsByIdsAsync(
        IReadOnlyList<Guid> productIds,
        CancellationToken cancellationToken = default);

    /// <summary>Keyword search over Approved products for shopping-assistant context.</summary>
    Task<IReadOnlyList<AiCompareProductRecord>> SearchApprovedProductsAsync(
        string? query,
        int take,
        CancellationToken cancellationToken = default);

    /// <summary>Filtered search aligned with Discovery ProductQueryRequest (Approved only).</summary>
    Task<IReadOnlyList<AiCompareProductRecord>> SearchApprovedProductsAsync(
        ProductQueryRequest query,
        int take,
        CancellationToken cancellationToken = default);

    /// <summary>How many Approved products match - used to decide whether another question helps.</summary>
    Task<int> CountApprovedProductsAsync(
        ProductQueryRequest query,
        CancellationToken cancellationToken = default);

    /// <summary>Real price distribution for the scope, so budget chips always match live stock.</summary>
    Task<AiPriceBands> GetPriceBandsAsync(
        ProductQueryRequest scope,
        CancellationToken cancellationToken = default);
}
