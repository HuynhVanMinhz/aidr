using AIDR.Infrastructure.Persistence;
using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.AI;

public sealed class RecommendationRepository : IRecommendationRepository
{
    private readonly AidrDbContext _db;

    public RecommendationRepository(AidrDbContext db) => _db = db;

    public Task<bool> ProductExistsApprovedAsync(Guid productId, CancellationToken cancellationToken = default)
        => BuildApprovedQuery().AnyAsync(p => p.ProductId == productId, cancellationToken);

    public async Task<SimilarSourceProduct?> GetApprovedProductSourceAsync(
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        return await BuildApprovedQuery()
            .Where(p => p.ProductId == productId)
            .Select(p => new SimilarSourceProduct
            {
                ProductId = p.ProductId,
                CategoryId = p.CategoryId,
                Brand = p.Brand,
                EffectivePrice = p.SalePrice ?? p.BasePrice,
                TagsJson = p.TagsJson,
                ShopId = p.ShopId
            })
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<RecommendationProductRecord>> GetStoredRecommendationsAsync(
        Guid userId,
        int take,
        CancellationToken cancellationToken = default)
    {
        var rows = await _db.ProductRecommendations.AsNoTracking()
            .Where(r => r.UserId == userId)
            .Where(r => r.Product.Status == RecommendationConstants.ApprovedStatus
                        && r.Product.Category.IsActive
                        && r.Product.Shop.Status == RecommendationConstants.ActiveShopStatus)
            .OrderByDescending(r => r.Score)
            .ThenByDescending(r => r.GeneratedAt)
            .Take(take)
            .Select(r => new
            {
                r.Score,
                r.Strategy,
                Product = r.Product,
                CategoryName = r.Product.Category.Name,
                ShopName = r.Product.Shop.ShopName,
                PrimaryImageUrl = r.Product.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        return rows.Select(r => MapProduct(
            r.Product.ProductId,
            r.Product.Name,
            r.Product.Slug,
            r.Product.ShortDescription,
            r.Product.Brand,
            r.Product.BasePrice,
            r.Product.SalePrice,
            r.Product.Currency,
            r.Product.StockQuantity,
            r.Product.ReservedQuantity,
            r.Product.AvgRating,
            r.Product.ReviewCount,
            r.Product.SoldCount,
            r.Product.IsFeatured,
            r.PrimaryImageUrl,
            r.Product.CategoryId,
            r.CategoryName,
            r.Product.ShopId,
            r.ShopName,
            r.Product.PublishedAt,
            r.Product.TagsJson,
            r.Score,
            r.Strategy)).ToList();
    }

    public async Task<IReadOnlyList<Guid>> GetRecentViewedProductIdsAsync(
        Guid userId,
        int take,
        CancellationToken cancellationToken = default)
    {
        var ids = await _db.ViewedProductHistories.AsNoTracking()
            .Where(v => v.UserId == userId)
            .OrderByDescending(v => v.ViewedAt)
            .Select(v => v.ProductId)
            .Take(take * 3)
            .ToListAsync(cancellationToken);

        return ids.Distinct().Take(take).ToList();
    }

    public async Task<(IReadOnlyList<int> CategoryIds, IReadOnlyList<string> Brands)> GetUserAffinityAsync(
        Guid userId,
        int lookback,
        CancellationToken cancellationToken = default)
    {
        var recent = await _db.ViewedProductHistories.AsNoTracking()
            .Where(v => v.UserId == userId)
            .OrderByDescending(v => v.ViewedAt)
            .Take(lookback)
            .Select(v => new { v.Product.CategoryId, v.Product.Brand })
            .ToListAsync(cancellationToken);

        var categories = recent
            .GroupBy(x => x.CategoryId)
            .OrderByDescending(g => g.Count())
            .Select(g => g.Key)
            .Take(5)
            .ToList();

        var brands = recent
            .Where(x => !string.IsNullOrWhiteSpace(x.Brand))
            .GroupBy(x => x.Brand!.Trim(), StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(g => g.Count())
            .Select(g => g.First().Brand!.Trim())
            .Take(5)
            .ToList();

        return (categories, brands);
    }

    public async Task<IReadOnlyList<RecommendationProductRecord>> GetContentAffinityCandidatesAsync(
        IReadOnlyList<int> categoryIds,
        IReadOnlyList<string> brands,
        IReadOnlyCollection<Guid> excludeProductIds,
        int take,
        CancellationToken cancellationToken = default)
    {
        if (categoryIds.Count == 0 && brands.Count == 0)
            return Array.Empty<RecommendationProductRecord>();

        var q = BuildApprovedQuery();
        if (excludeProductIds.Count > 0)
            q = q.Where(p => !excludeProductIds.Contains(p.ProductId));

        if (categoryIds.Count > 0 && brands.Count > 0)
            q = q.Where(p => categoryIds.Contains(p.CategoryId)
                             || (p.Brand != null && brands.Contains(p.Brand)));
        else if (categoryIds.Count > 0)
            q = q.Where(p => categoryIds.Contains(p.CategoryId));
        else
            q = q.Where(p => p.Brand != null && brands.Contains(p.Brand));

        var rows = await q
            .OrderByDescending(p => p.IsFeatured)
            .ThenByDescending(p => p.SoldCount)
            .ThenByDescending(p => p.AvgRating)
            .ThenByDescending(p => p.PublishedAt)
            .Take(take)
            .Select(p => new
            {
                p.ProductId,
                p.Name,
                p.Slug,
                p.ShortDescription,
                p.Brand,
                p.BasePrice,
                p.SalePrice,
                p.Currency,
                p.StockQuantity,
                p.ReservedQuantity,
                p.AvgRating,
                p.ReviewCount,
                p.SoldCount,
                p.IsFeatured,
                PrimaryImageUrl = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault(),
                p.CategoryId,
                CategoryName = p.Category.Name,
                p.ShopId,
                ShopName = p.Shop.ShopName,
                p.PublishedAt,
                p.TagsJson
            })
            .ToListAsync(cancellationToken);

        return rows.Select((r, index) => MapProduct(
            r.ProductId, r.Name, r.Slug, r.ShortDescription, r.Brand,
            r.BasePrice, r.SalePrice, r.Currency, r.StockQuantity, r.ReservedQuantity,
            r.AvgRating, r.ReviewCount, r.SoldCount, r.IsFeatured, r.PrimaryImageUrl,
            r.CategoryId, r.CategoryName, r.ShopId, r.ShopName, r.PublishedAt, r.TagsJson,
            score: Math.Round(0.85m - index * 0.01m, 6),
            strategy: RecommendationConstants.StrategyContent)).ToList();
    }

    public async Task<IReadOnlyList<RecommendationProductRecord>> GetCollaborativeCandidatesAsync(
        IReadOnlyList<Guid> seedProductIds,
        Guid userId,
        IReadOnlyCollection<Guid> excludeProductIds,
        int take,
        CancellationToken cancellationToken = default)
    {
        if (seedProductIds.Count == 0)
            return Array.Empty<RecommendationProductRecord>();

        var peerUserIds = await _db.ViewedProductHistories.AsNoTracking()
            .Where(v => v.UserId != null
                        && v.UserId != userId
                        && seedProductIds.Contains(v.ProductId))
            .Select(v => v.UserId!.Value)
            .Distinct()
            .Take(80)
            .ToListAsync(cancellationToken);

        if (peerUserIds.Count == 0)
            return Array.Empty<RecommendationProductRecord>();

        var coViewed = await _db.ViewedProductHistories.AsNoTracking()
            .Where(v => v.UserId != null
                        && peerUserIds.Contains(v.UserId.Value)
                        && !seedProductIds.Contains(v.ProductId)
                        && (excludeProductIds.Count == 0 || !excludeProductIds.Contains(v.ProductId)))
            .GroupBy(v => v.ProductId)
            .Select(g => new { ProductId = g.Key, Hits = g.Count() })
            .OrderByDescending(x => x.Hits)
            .Take(take)
            .ToListAsync(cancellationToken);

        if (coViewed.Count == 0)
            return Array.Empty<RecommendationProductRecord>();

        var productIds = coViewed.Select(x => x.ProductId).ToList();
        var hitMap = coViewed.ToDictionary(x => x.ProductId, x => x.Hits);
        var maxHits = coViewed.Max(x => x.Hits);

        var products = await BuildApprovedQuery()
            .Where(p => productIds.Contains(p.ProductId))
            .Select(p => new
            {
                p.ProductId,
                p.Name,
                p.Slug,
                p.ShortDescription,
                p.Brand,
                p.BasePrice,
                p.SalePrice,
                p.Currency,
                p.StockQuantity,
                p.ReservedQuantity,
                p.AvgRating,
                p.ReviewCount,
                p.SoldCount,
                p.IsFeatured,
                PrimaryImageUrl = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault(),
                p.CategoryId,
                CategoryName = p.Category.Name,
                p.ShopId,
                ShopName = p.Shop.ShopName,
                p.PublishedAt,
                p.TagsJson
            })
            .ToListAsync(cancellationToken);

        return products
            .Select(r =>
            {
                var hits = hitMap.GetValueOrDefault(r.ProductId, 1);
                var score = maxHits <= 0 ? 0.5m : Math.Round((decimal)hits / maxHits * 0.9m, 6);
                return MapProduct(
                    r.ProductId, r.Name, r.Slug, r.ShortDescription, r.Brand,
                    r.BasePrice, r.SalePrice, r.Currency, r.StockQuantity, r.ReservedQuantity,
                    r.AvgRating, r.ReviewCount, r.SoldCount, r.IsFeatured, r.PrimaryImageUrl,
                    r.CategoryId, r.CategoryName, r.ShopId, r.ShopName, r.PublishedAt, r.TagsJson,
                    score, RecommendationConstants.StrategyCollaborative);
            })
            .OrderByDescending(p => p.Score)
            .ThenByDescending(p => p.SoldCount)
            .ToList();
    }

    public async Task<IReadOnlyList<RecommendationProductRecord>> GetPopularCandidatesAsync(
        IReadOnlyCollection<Guid> excludeProductIds,
        int take,
        CancellationToken cancellationToken = default)
    {
        var q = BuildApprovedQuery();
        if (excludeProductIds.Count > 0)
            q = q.Where(p => !excludeProductIds.Contains(p.ProductId));

        var rows = await q
            .OrderByDescending(p => p.IsFeatured)
            .ThenByDescending(p => p.SoldCount)
            .ThenByDescending(p => p.AvgRating)
            .ThenByDescending(p => p.ViewCount)
            .ThenByDescending(p => p.PublishedAt)
            .Take(take)
            .Select(p => new
            {
                p.ProductId,
                p.Name,
                p.Slug,
                p.ShortDescription,
                p.Brand,
                p.BasePrice,
                p.SalePrice,
                p.Currency,
                p.StockQuantity,
                p.ReservedQuantity,
                p.AvgRating,
                p.ReviewCount,
                p.SoldCount,
                p.IsFeatured,
                PrimaryImageUrl = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault(),
                p.CategoryId,
                CategoryName = p.Category.Name,
                p.ShopId,
                ShopName = p.Shop.ShopName,
                p.PublishedAt,
                p.TagsJson
            })
            .ToListAsync(cancellationToken);

        return rows.Select((r, index) => MapProduct(
            r.ProductId, r.Name, r.Slug, r.ShortDescription, r.Brand,
            r.BasePrice, r.SalePrice, r.Currency, r.StockQuantity, r.ReservedQuantity,
            r.AvgRating, r.ReviewCount, r.SoldCount, r.IsFeatured, r.PrimaryImageUrl,
            r.CategoryId, r.CategoryName, r.ShopId, r.ShopName, r.PublishedAt, r.TagsJson,
            score: Math.Round(0.7m - index * 0.01m, 6),
            strategy: RecommendationConstants.StrategyPopular)).ToList();
    }

    public async Task<IReadOnlyList<RecommendationProductRecord>> GetSimilarCandidatesAsync(
        SimilarSourceProduct source,
        int take,
        CancellationToken cancellationToken = default)
    {
        var minPrice = source.EffectivePrice * 0.6m;
        var maxPrice = source.EffectivePrice <= 0 ? decimal.MaxValue : source.EffectivePrice * 1.4m;

        var candidates = await BuildApprovedQuery()
            .Where(p => p.ProductId != source.ProductId)
            .Where(p => p.CategoryId == source.CategoryId
                        || (source.Brand != null && p.Brand == source.Brand)
                        || ((p.SalePrice ?? p.BasePrice) >= minPrice
                            && (p.SalePrice ?? p.BasePrice) <= maxPrice))
            .OrderByDescending(p => p.CategoryId == source.CategoryId)
            .ThenByDescending(p => source.Brand != null && p.Brand == source.Brand)
            .ThenByDescending(p => p.SoldCount)
            .ThenByDescending(p => p.AvgRating)
            .Take(Math.Max(take * 3, 36))
            .Select(p => new
            {
                p.ProductId,
                p.Name,
                p.Slug,
                p.ShortDescription,
                p.Brand,
                p.BasePrice,
                p.SalePrice,
                p.Currency,
                p.StockQuantity,
                p.ReservedQuantity,
                p.AvgRating,
                p.ReviewCount,
                p.SoldCount,
                p.IsFeatured,
                PrimaryImageUrl = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault(),
                p.CategoryId,
                CategoryName = p.Category.Name,
                p.ShopId,
                ShopName = p.Shop.ShopName,
                p.PublishedAt,
                p.TagsJson
            })
            .ToListAsync(cancellationToken);

        var sourceTags = ParseTags(source.TagsJson);

        return candidates
            .Select(r =>
            {
                var score = 0m;
                if (r.CategoryId == source.CategoryId)
                    score += 3m;
                if (!string.IsNullOrWhiteSpace(source.Brand)
                    && string.Equals(r.Brand, source.Brand, StringComparison.OrdinalIgnoreCase))
                    score += 2m;
                if (r.ShopId == source.ShopId)
                    score += 0.5m;

                var price = r.SalePrice ?? r.BasePrice;
                if (source.EffectivePrice > 0)
                {
                    var ratio = price / source.EffectivePrice;
                    if (ratio is >= 0.7m and <= 1.3m)
                        score += 1m;
                    else if (ratio is >= 0.6m and <= 1.4m)
                        score += 0.5m;
                }

                var overlap = ParseTags(r.TagsJson).Intersect(sourceTags, StringComparer.OrdinalIgnoreCase).Count();
                score += Math.Min(overlap, 3) * 0.75m;
                score += Math.Min(r.AvgRating, 5m) * 0.1m;
                score += Math.Min(r.SoldCount, 200) / 200m * 0.5m;

                return MapProduct(
                    r.ProductId, r.Name, r.Slug, r.ShortDescription, r.Brand,
                    r.BasePrice, r.SalePrice, r.Currency, r.StockQuantity, r.ReservedQuantity,
                    r.AvgRating, r.ReviewCount, r.SoldCount, r.IsFeatured, r.PrimaryImageUrl,
                    r.CategoryId, r.CategoryName, r.ShopId, r.ShopName, r.PublishedAt, r.TagsJson,
                    Math.Round(score, 6), RecommendationConstants.StrategyContent);
            })
            .OrderByDescending(p => p.Score)
            .ThenByDescending(p => p.SoldCount)
            .Take(take)
            .ToList();
    }

    public async Task<IReadOnlyDictionary<Guid, ProductVariantPriceRange>> GetVariantPriceRangesAsync(
        IReadOnlyCollection<Guid> productIds,
        CancellationToken cancellationToken = default)
    {
        if (productIds.Count == 0)
            return new Dictionary<Guid, ProductVariantPriceRange>();

        var rows = await _db.ProductVariants.AsNoTracking()
            .Where(v => productIds.Contains(v.ProductId) && v.IsActive)
            .GroupBy(v => v.ProductId)
            .Select(g => new
            {
                ProductId = g.Key,
                Min = g.Min(v => v.SalePrice ?? v.Price),
                Max = g.Max(v => v.SalePrice ?? v.Price),
                Count = g.Count()
            })
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(
            r => r.ProductId,
            r => new ProductVariantPriceRange(r.Min, r.Max, r.Count));
    }

    private IQueryable<Persistence.Entities.Product> BuildApprovedQuery()
        => _db.Products.AsNoTracking()
            .Where(p => p.Status == RecommendationConstants.ApprovedStatus
                        && p.Category.IsActive
                        && p.Shop.Status == RecommendationConstants.ActiveShopStatus);

    private static RecommendationProductRecord MapProduct(
        Guid productId,
        string name,
        string slug,
        string? shortDescription,
        string? brand,
        decimal basePrice,
        decimal? salePrice,
        string currency,
        int stockQuantity,
        int reservedQuantity,
        decimal avgRating,
        int reviewCount,
        int soldCount,
        bool isFeatured,
        string? primaryImageUrl,
        int categoryId,
        string categoryName,
        Guid shopId,
        string shopName,
        DateTime? publishedAt,
        string? tagsJson,
        decimal score,
        string strategy)
        => new()
        {
            ProductId = productId,
            Name = name,
            Slug = slug,
            ShortDescription = shortDescription,
            Brand = brand,
            BasePrice = basePrice,
            SalePrice = salePrice,
            Currency = currency,
            StockQuantity = stockQuantity,
            ReservedQuantity = reservedQuantity,
            AvgRating = avgRating,
            ReviewCount = reviewCount,
            SoldCount = soldCount,
            IsFeatured = isFeatured,
            PrimaryImageUrl = primaryImageUrl,
            CategoryId = categoryId,
            CategoryName = categoryName,
            ShopId = shopId,
            ShopName = shopName,
            PublishedAt = publishedAt,
            TagsJson = tagsJson,
            Score = score,
            Strategy = strategy
        };

    private static HashSet<string> ParseTags(string? tagsJson)
    {
        if (string.IsNullOrWhiteSpace(tagsJson))
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        try
        {
            var tags = System.Text.Json.JsonSerializer.Deserialize<List<string>>(tagsJson);
            return tags?
                       .Where(t => !string.IsNullOrWhiteSpace(t))
                       .Select(t => t.Trim())
                       .ToHashSet(StringComparer.OrdinalIgnoreCase)
                   ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }
        catch
        {
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }
    }
}
