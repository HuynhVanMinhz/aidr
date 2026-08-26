namespace AIDR.Modules.AI.Abstractions;

public sealed class AiCategoryLookup
{
    public int CategoryId { get; init; }
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
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public string Currency { get; init; } = "VND";
    public decimal AvgRating { get; init; }
    public int ReviewCount { get; init; }
    public int? WarrantyMonths { get; init; }
    public string? SpecsJson { get; init; }
    public string? TagsJson { get; init; }
    public string? PrimaryImageUrl { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
}

public interface IAiCatalogRepository
{
    Task<IReadOnlyList<AiCategoryLookup>> GetActiveCategoriesAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AiCompareProductRecord>> GetApprovedProductsByIdsAsync(
        IReadOnlyList<Guid> productIds,
        CancellationToken cancellationToken = default);
}
