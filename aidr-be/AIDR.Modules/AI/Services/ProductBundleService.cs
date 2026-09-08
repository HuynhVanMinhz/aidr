using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Caching;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.AI.Services;

public sealed class ProductBundleService : IProductBundleService
{
    private readonly IProductBundleRepository _repository;
    private readonly IRecommendationService _recommendations;
    private readonly IAiCatalogRepository _catalog;
    private readonly AccessoryRulesProvider _rules;
    private readonly ICacheService _cache;

    public ProductBundleService(
        IProductBundleRepository repository,
        IRecommendationService recommendations,
        IAiCatalogRepository catalog,
        AccessoryRulesProvider rules,
        ICacheService cache)
    {
        _repository = repository;
        _recommendations = recommendations;
        _catalog = catalog;
        _rules = rules;
        _cache = cache;
    }

    public async Task<ProductBundleDto> GetBundleAsync(
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        if (productId == Guid.Empty)
            throw new AppException("Product id is required.");

        var cacheKey = BundleConstants.CacheKey(productId);
        var cached = await _cache.GetAsync<ProductBundleDto>(cacheKey, cancellationToken);
        if (cached is not null)
            return cached;

        var source = await _repository.GetBundleSourceAsync(productId, cancellationToken)
            ?? throw new NotFoundException("Product not found or not available.");

        var categories = await _catalog.GetActiveCategoriesAsync(cancellationToken);
        var slugById = categories.ToDictionary(c => c.CategoryId, c => c.Slug);

        var rule = _rules.ResolveRule(
            source.CategorySlug,
            source.CategoryParentId,
            parentId => slugById.GetValueOrDefault(parentId));

        var maxItems = rule?.MaxItems ?? BundleConstants.MaxBundleItems;
        maxItems = Math.Clamp(maxItems, BundleConstants.MinBundleItems, BundleConstants.MaxBundleItems);

        IReadOnlyList<BundleCandidateRecord> candidates = Array.Empty<BundleCandidateRecord>();
        if (rule is not null && rule.AccessoryCategories.Count > 0)
        {
            var categoryIds = await _repository.ResolveCategoryIdsBySlugsAsync(
                rule.AccessoryCategories,
                cancellationToken);

            candidates = await _repository.GetAccessoryCandidatesAsync(
                productId,
                source.ShopId,
                categoryIds,
                maxItems,
                cancellationToken);
        }

        if (candidates.Count < BundleConstants.MinBundleItems)
        {
            var similar = await _recommendations.GetSimilarProductsAsync(
                productId,
                new SimilarProductsQueryRequest { Limit = maxItems },
                cancellationToken);

            var existingIds = candidates.Select(c => c.ProductId).ToHashSet();
            var fallback = similar
                .Where(s => s.ProductId != productId && !existingIds.Contains(s.ProductId))
                .Select(MapSimilarToCandidate)
                .Take(maxItems - candidates.Count)
                .ToList();

            candidates = candidates.Concat(fallback).Take(maxItems).ToList();
        }

        var items = candidates
            .Select(c => MapItem(c, BuildReason(c)))
            .ToList();

        var result = new ProductBundleDto
        {
            ProductId = source.ProductId,
            ProductName = source.Name,
            Items = items,
            TotalCount = items.Count,
            Source = BundleConstants.SourceRule
        };

        await _cache.SetAsync(
            cacheKey,
            result,
            TimeSpan.FromMinutes(BundleConstants.CacheTtlMinutes),
            cancellationToken);

        return result;
    }

    private static BundleCandidateRecord MapSimilarToCandidate(SimilarProductDto similar) =>
        new()
        {
            ProductId = similar.ProductId,
            Name = similar.Name,
            Slug = similar.Slug,
            ShortDescription = similar.ShortDescription,
            Brand = similar.Brand,
            BasePrice = similar.BasePrice,
            SalePrice = similar.SalePrice,
            Currency = similar.Currency,
            StockQuantity = similar.StockQuantity,
            ReservedQuantity = similar.StockQuantity - similar.AvailableQuantity,
            AvgRating = similar.AvgRating,
            ReviewCount = similar.ReviewCount,
            PrimaryImageUrl = similar.PrimaryImageUrl,
            CategoryId = similar.CategoryId,
            CategoryName = similar.CategoryName,
            ShopId = similar.ShopId,
            ShopName = similar.ShopName,
            SameShop = false
        };

    private static BundleItemDto MapItem(BundleCandidateRecord candidate, string? reason)
    {
        var effective = candidate.SalePrice is decimal sale && sale > 0 && sale < candidate.BasePrice
            ? sale
            : candidate.BasePrice;
        var available = Math.Max(0, candidate.StockQuantity - candidate.ReservedQuantity);

        return new BundleItemDto
        {
            ProductId = candidate.ProductId,
            Name = candidate.Name,
            Slug = candidate.Slug,
            ShortDescription = candidate.ShortDescription,
            Brand = candidate.Brand,
            BasePrice = candidate.BasePrice,
            SalePrice = candidate.SalePrice,
            EffectivePrice = effective,
            Currency = candidate.Currency,
            AvailableQuantity = available,
            AvgRating = candidate.AvgRating,
            ReviewCount = candidate.ReviewCount,
            PrimaryImageUrl = candidate.PrimaryImageUrl,
            CategoryId = candidate.CategoryId,
            CategoryName = candidate.CategoryName,
            ShopId = candidate.ShopId,
            ShopName = candidate.ShopName,
            Reason = reason
        };
    }

    private static string? BuildReason(BundleCandidateRecord candidate)
    {
        if (candidate.SameShop)
            return "Popular accessory from the same shop.";
        if (candidate.AvgRating >= 4.0m && candidate.ReviewCount >= 5)
            return "Highly rated by other buyers.";
        return "Recommended to complete your setup.";
    }
}
