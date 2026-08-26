using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Caching;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;

namespace AIDR.Modules.AI.Services;

public sealed class RecommendationService : IRecommendationService
{
    private readonly IRecommendationRepository _repository;
    private readonly ICacheService _cache;
    private readonly ILogger<RecommendationService> _logger;

    public RecommendationService(
        IRecommendationRepository repository,
        ICacheService cache,
        ILogger<RecommendationService> logger)
    {
        _repository = repository;
        _cache = cache;
        _logger = logger;
    }

    public async Task<PagedResult<RecommendedProductDto>> GetRecommendationsAsync(
        Guid? userId,
        RecommendationQueryRequest request,
        CancellationToken cancellationToken = default)
    {
        var (page, pageSize) = RecommendationConstants.NormalizePaging(request.Page, request.PageSize);
        var cacheKey = BuildRecommendationsCacheKey(userId, page, pageSize);

        var cached = await _cache.GetAsync<PagedResult<RecommendedProductDto>>(cacheKey, cancellationToken);
        if (cached is not null)
            return cached;

        var merged = await BuildHybridRecommendationsAsync(userId, cancellationToken);
        var total = merged.Count;
        var pageItems = merged
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(MapRecommended)
            .ToList();

        var result = new PagedResult<RecommendedProductDto>
        {
            Items = pageItems,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        };

        await _cache.SetAsync(cacheKey, result, RecommendationConstants.RecommendationsCacheTtl, cancellationToken);
        return result;
    }

    public async Task<IReadOnlyList<SimilarProductDto>> GetSimilarProductsAsync(
        Guid productId,
        SimilarProductsQueryRequest request,
        CancellationToken cancellationToken = default)
    {
        if (productId == Guid.Empty)
            throw new AppException("Product id is required.");

        var limit = RecommendationConstants.NormalizeSimilarLimit(request.Limit);
        var cacheKey = $"product:{productId:D}:similar:{limit}";

        var cached = await _cache.GetAsync<List<SimilarProductDto>>(cacheKey, cancellationToken);
        if (cached is not null)
            return cached;

        var source = await _repository.GetApprovedProductSourceAsync(productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        var candidates = await _repository.GetSimilarCandidatesAsync(source, limit, cancellationToken);
        var items = candidates.Select(MapSimilar).ToList();

        await _cache.SetAsync(cacheKey, items, RecommendationConstants.SimilarCacheTtl, cancellationToken);
        return items;
    }

    private async Task<List<RecommendationProductRecord>> BuildHybridRecommendationsAsync(
        Guid? userId,
        CancellationToken cancellationToken)
    {
        var pool = new Dictionary<Guid, RecommendationProductRecord>();
        var target = RecommendationConstants.CandidatePoolSize;

        void Merge(IEnumerable<RecommendationProductRecord> items, bool preferExistingStrategy = false)
        {
            foreach (var item in items)
            {
                if (pool.TryGetValue(item.ProductId, out var existing))
                {
                    if (item.Score > existing.Score)
                    {
                        pool[item.ProductId] = preferExistingStrategy
                            ? item with { Strategy = RecommendationConstants.StrategyHybrid, Score = Math.Max(item.Score, existing.Score) }
                            : item with
                            {
                                Strategy = RecommendationConstants.StrategyHybrid,
                                Score = Math.Round((item.Score + existing.Score) / 2m + 0.05m, 6)
                            };
                    }
                    else if (!string.Equals(existing.Strategy, item.Strategy, StringComparison.OrdinalIgnoreCase))
                    {
                        pool[item.ProductId] = existing with
                        {
                            Strategy = RecommendationConstants.StrategyHybrid,
                            Score = Math.Round(existing.Score + 0.03m, 6)
                        };
                    }

                    continue;
                }

                pool[item.ProductId] = item;
                if (pool.Count >= target)
                    break;
            }
        }

        if (userId is { } uid && uid != Guid.Empty)
        {
            try
            {
                var stored = await _repository.GetStoredRecommendationsAsync(uid, target, cancellationToken);
                Merge(stored);

                var recentViews = await _repository.GetRecentViewedProductIdsAsync(
                    uid, RecommendationConstants.RecentViewLookback, cancellationToken);
                var exclude = pool.Keys.Concat(recentViews).ToHashSet();

                if (pool.Count < target)
                {
                    var collab = await _repository.GetCollaborativeCandidatesAsync(
                        recentViews, uid, exclude, target - pool.Count, cancellationToken);
                    Merge(collab);
                    foreach (var id in collab.Select(c => c.ProductId))
                        exclude.Add(id);
                }

                if (pool.Count < target)
                {
                    var (categories, brands) = await _repository.GetUserAffinityAsync(
                        uid, RecommendationConstants.RecentViewLookback, cancellationToken);
                    var content = await _repository.GetContentAffinityCandidatesAsync(
                        categories, brands, exclude, target - pool.Count, cancellationToken);
                    Merge(content);
                    foreach (var id in content.Select(c => c.ProductId))
                        exclude.Add(id);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Personalized recommendations failed for user {UserId}; falling back to popular.", uid);
            }
        }

        if (pool.Count < target)
        {
            var popular = await _repository.GetPopularCandidatesAsync(pool.Keys.ToHashSet(), target - pool.Count, cancellationToken);
            Merge(popular);
        }

        return pool.Values
            .OrderByDescending(p => p.Score)
            .ThenByDescending(p => p.IsFeatured)
            .ThenByDescending(p => p.SoldCount)
            .ThenByDescending(p => p.AvgRating)
            .ToList();
    }

    private static RecommendedProductDto MapRecommended(RecommendationProductRecord r)
    {
        var effective = r.SalePrice ?? r.BasePrice;
        return new RecommendedProductDto
        {
            ProductId = r.ProductId,
            Name = r.Name,
            Slug = r.Slug,
            ShortDescription = r.ShortDescription,
            Brand = r.Brand,
            BasePrice = r.BasePrice,
            SalePrice = r.SalePrice,
            EffectivePrice = effective,
            Currency = r.Currency,
            StockQuantity = r.StockQuantity,
            AvailableQuantity = Math.Max(0, r.StockQuantity - r.ReservedQuantity),
            AvgRating = r.AvgRating,
            ReviewCount = r.ReviewCount,
            SoldCount = r.SoldCount,
            IsFeatured = r.IsFeatured,
            PrimaryImageUrl = r.PrimaryImageUrl,
            CategoryId = r.CategoryId,
            CategoryName = r.CategoryName,
            ShopId = r.ShopId,
            ShopName = r.ShopName,
            PublishedAt = r.PublishedAt,
            Score = r.Score,
            Strategy = r.Strategy
        };
    }

    private static SimilarProductDto MapSimilar(RecommendationProductRecord r)
    {
        var effective = r.SalePrice ?? r.BasePrice;
        return new SimilarProductDto
        {
            ProductId = r.ProductId,
            Name = r.Name,
            Slug = r.Slug,
            ShortDescription = r.ShortDescription,
            Brand = r.Brand,
            BasePrice = r.BasePrice,
            SalePrice = r.SalePrice,
            EffectivePrice = effective,
            Currency = r.Currency,
            StockQuantity = r.StockQuantity,
            AvailableQuantity = Math.Max(0, r.StockQuantity - r.ReservedQuantity),
            AvgRating = r.AvgRating,
            ReviewCount = r.ReviewCount,
            SoldCount = r.SoldCount,
            IsFeatured = r.IsFeatured,
            PrimaryImageUrl = r.PrimaryImageUrl,
            CategoryId = r.CategoryId,
            CategoryName = r.CategoryName,
            ShopId = r.ShopId,
            ShopName = r.ShopName,
            PublishedAt = r.PublishedAt,
            Score = r.Score
        };
    }

    private static string BuildRecommendationsCacheKey(Guid? userId, int page, int pageSize)
    {
        var payload = JsonSerializer.Serialize(new
        {
            userId = userId?.ToString("D") ?? "anon",
            page,
            pageSize
        });
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
        return $"ai:recommendations:{hash}";
    }
}
