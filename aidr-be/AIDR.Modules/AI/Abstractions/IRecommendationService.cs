using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Dtos.Discovery;

namespace AIDR.Modules.AI.Abstractions;

public sealed record RecommendationProductRecord
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
    public string? TagsJson { get; init; }
    public decimal Score { get; init; }
    public string Strategy { get; init; } = null!;
}

/// <summary>
/// The price span of one product's active variants. Recommendation cards are built from
/// their own queries, which know nothing about variants, so the span is looked up for the
/// final set of product ids rather than joined into six different projections.
/// </summary>
public sealed record ProductVariantPriceRange(decimal Min, decimal Max, int VariantCount);

public sealed class SimilarSourceProduct
{
    public Guid ProductId { get; init; }
    public int CategoryId { get; init; }
    public string? Brand { get; init; }
    public decimal EffectivePrice { get; init; }
    public string? TagsJson { get; init; }
    public Guid ShopId { get; init; }
}

public interface IRecommendationRepository
{
    Task<bool> ProductExistsApprovedAsync(Guid productId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Active-variant price spans for the given products. Products with no variants are
    /// absent from the result - the caller falls back to the product's own price.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, ProductVariantPriceRange>> GetVariantPriceRangesAsync(
        IReadOnlyCollection<Guid> productIds,
        CancellationToken cancellationToken = default);

    Task<SimilarSourceProduct?> GetApprovedProductSourceAsync(
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RecommendationProductRecord>> GetStoredRecommendationsAsync(
        Guid userId,
        int take,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> GetRecentViewedProductIdsAsync(
        Guid userId,
        int take,
        CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<int> CategoryIds, IReadOnlyList<string> Brands)> GetUserAffinityAsync(
        Guid userId,
        int lookback,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RecommendationProductRecord>> GetContentAffinityCandidatesAsync(
        IReadOnlyList<int> categoryIds,
        IReadOnlyList<string> brands,
        IReadOnlyCollection<Guid> excludeProductIds,
        int take,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RecommendationProductRecord>> GetCollaborativeCandidatesAsync(
        IReadOnlyList<Guid> seedProductIds,
        Guid userId,
        IReadOnlyCollection<Guid> excludeProductIds,
        int take,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RecommendationProductRecord>> GetPopularCandidatesAsync(
        IReadOnlyCollection<Guid> excludeProductIds,
        int take,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RecommendationProductRecord>> GetSimilarCandidatesAsync(
        SimilarSourceProduct source,
        int take,
        CancellationToken cancellationToken = default);
}

public interface IRecommendationService
{
    Task<PagedResult<RecommendedProductDto>> GetRecommendationsAsync(
        Guid? userId,
        RecommendationQueryRequest request,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SimilarProductDto>> GetSimilarProductsAsync(
        Guid productId,
        SimilarProductsQueryRequest request,
        CancellationToken cancellationToken = default);
}
