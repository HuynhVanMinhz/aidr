using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Discovery;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.AI;

public sealed class AiCatalogRepository : IAiCatalogRepository
{
    private readonly AidrDbContext _db;

    public AiCatalogRepository(AidrDbContext db) => _db = db;

    public async Task<IReadOnlyList<AiCategoryLookup>> GetActiveCategoriesAsync(
        CancellationToken cancellationToken = default)
    {
        return await _db.Categories.AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .Select(c => new AiCategoryLookup
            {
                CategoryId = c.CategoryId,
                ParentId = c.ParentId,
                Name = c.Name,
                Slug = c.Slug
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AiCompareProductRecord>> GetApprovedProductsByIdsAsync(
        IReadOnlyList<Guid> productIds,
        CancellationToken cancellationToken = default)
    {
        if (productIds.Count == 0)
            return Array.Empty<AiCompareProductRecord>();

        var idSet = productIds.Distinct().ToList();

        var rows = await BuildApprovedQuery()
            .Where(p => idSet.Contains(p.ProductId))
            .Select(p => new AiCompareProductRecord
            {
                ProductId = p.ProductId,
                Name = p.Name,
                Slug = p.Slug,
                ShortDescription = p.ShortDescription,
                Brand = p.Brand,
                ModelNumber = p.ModelNumber,
                ConditionType = p.ConditionType,
                BasePrice = p.BasePrice,
                SalePrice = p.SalePrice,
                Currency = p.Currency,
                AvgRating = p.AvgRating,
                ReviewCount = p.ReviewCount,
                WarrantyMonths = p.WarrantyMonths,
                OriginCountry = p.OriginCountry,
                StockQuantity = p.StockQuantity,
                ReservedQuantity = p.ReservedQuantity,
                SoldCount = p.SoldCount,
                SpecsJson = p.SpecsJson,
                TagsJson = p.TagsJson,
                PrimaryImageUrl = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault(),
                CategoryId = p.CategoryId,
                CategoryName = p.Category.Name,
                ShopId = p.ShopId,
                ShopName = p.Shop.ShopName
            })
            .ToListAsync(cancellationToken);

        var byId = rows.ToDictionary(r => r.ProductId);
        return productIds
            .Where(id => byId.ContainsKey(id))
            .Select(id => byId[id])
            .ToList();
    }

    public Task<IReadOnlyList<AiCompareProductRecord>> SearchApprovedProductsAsync(
        string? query,
        int take,
        CancellationToken cancellationToken = default)
        => SearchApprovedProductsAsync(
            new ProductQueryRequest { Q = query, Sort = DiscoveryConstants.SortPopular },
            take,
            cancellationToken);

    public async Task<IReadOnlyList<AiCompareProductRecord>> SearchApprovedProductsAsync(
        ProductQueryRequest query,
        int take,
        CancellationToken cancellationToken = default)
    {
        take = Math.Clamp(take, 1, 24);
        var q = ApplySort(ApplyFilters(BuildApprovedQuery(), query), query.Sort);

        return await q
            .Take(take)
            .Select(p => new AiCompareProductRecord
            {
                ProductId = p.ProductId,
                Name = p.Name,
                Slug = p.Slug,
                ShortDescription = p.ShortDescription,
                Brand = p.Brand,
                ModelNumber = p.ModelNumber,
                ConditionType = p.ConditionType,
                BasePrice = p.BasePrice,
                SalePrice = p.SalePrice,
                Currency = p.Currency,
                AvgRating = p.AvgRating,
                ReviewCount = p.ReviewCount,
                WarrantyMonths = p.WarrantyMonths,
                OriginCountry = p.OriginCountry,
                StockQuantity = p.StockQuantity,
                ReservedQuantity = p.ReservedQuantity,
                SoldCount = p.SoldCount,
                SpecsJson = p.SpecsJson,
                TagsJson = p.TagsJson,
                PrimaryImageUrl = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault(),
                CategoryId = p.CategoryId,
                CategoryName = p.Category.Name,
                ShopId = p.ShopId,
                ShopName = p.Shop.ShopName
            })
            .ToListAsync(cancellationToken);
    }

    public Task<int> CountApprovedProductsAsync(
        ProductQueryRequest query,
        CancellationToken cancellationToken = default)
        => ApplyFilters(BuildApprovedQuery(), query).CountAsync(cancellationToken);

    public async Task<AiPriceBands> GetPriceBandsAsync(
        ProductQueryRequest scope,
        CancellationToken cancellationToken = default)
    {
        // One round trip: pull a capped, sorted price sample and bucket it in memory.
        var prices = await ApplyFilters(BuildApprovedQuery(), scope)
            .Select(p => p.SalePrice ?? p.BasePrice)
            .OrderBy(price => price)
            .Take(AiConstants.PriceBandSampleSize)
            .ToListAsync(cancellationToken);

        if (prices.Count == 0)
            return AiPriceBands.Empty;

        return new AiPriceBands
        {
            Count = prices.Count,
            Min = prices[0],
            P33 = prices[prices.Count / 3],
            P66 = prices[prices.Count * 2 / 3],
            Max = prices[^1]
        };
    }

    private static IQueryable<Product> ApplyFilters(IQueryable<Product> q, ProductQueryRequest query)
    {
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var keyword = query.Q.Trim();
            q = q.Where(p =>
                p.Name.Contains(keyword)
                || (p.Brand != null && p.Brand.Contains(keyword))
                || (p.ShortDescription != null && p.ShortDescription.Contains(keyword))
                || (p.TagsJson != null && p.TagsJson.Contains(keyword))
                || (p.SpecsJson != null && p.SpecsJson.Contains(keyword))
                || (p.ModelNumber != null && p.ModelNumber.Contains(keyword))
                || p.Category.Name.Contains(keyword));
        }

        if (!string.IsNullOrWhiteSpace(query.Brand))
        {
            var brand = query.Brand.Trim();
            // Case-insensitive / partial match - seed brands are Title Case but LLM may vary.
            q = q.Where(p => p.Brand != null && p.Brand.Contains(brand));
        }

        if (query.CategoryId is { } categoryId)
        {
            // Include direct category and immediate children (products may sit on parent or leaf).
            q = q.Where(p =>
                p.CategoryId == categoryId
                || p.Category.ParentId == categoryId);
        }

        if (query.ShopId is { } shopId)
            q = q.Where(p => p.ShopId == shopId);

        if (query.MinPrice is { } minPrice)
            q = q.Where(p => (p.SalePrice ?? p.BasePrice) >= minPrice);

        if (query.MaxPrice is { } maxPrice)
            q = q.Where(p => (p.SalePrice ?? p.BasePrice) <= maxPrice);

        if (query.MinRating is { } minRating)
            q = q.Where(p => p.AvgRating >= minRating);

        return q;
    }

    private IQueryable<Product> BuildApprovedQuery()
        => _db.Products.AsNoTracking()
            .Where(p => p.Status == RecommendationConstants.ApprovedStatus
                        && p.Category.IsActive
                        && p.Shop.Status == RecommendationConstants.ActiveShopStatus);

    private static IQueryable<Product> ApplySort(IQueryable<Product> query, string? sort)
    {
        var key = (sort ?? DiscoveryConstants.SortPopular).Trim().ToLowerInvariant();
        return key switch
        {
            DiscoveryConstants.SortPriceAsc => query
                .OrderBy(p => p.SalePrice ?? p.BasePrice)
                .ThenByDescending(p => p.AvgRating),
            DiscoveryConstants.SortPriceDesc => query
                .OrderByDescending(p => p.SalePrice ?? p.BasePrice)
                .ThenByDescending(p => p.AvgRating),
            DiscoveryConstants.SortPopular => query
                .OrderByDescending(p => p.SoldCount)
                .ThenByDescending(p => p.AvgRating)
                .ThenBy(p => p.Name),
            DiscoveryConstants.SortRating => query
                .OrderByDescending(p => p.AvgRating)
                .ThenByDescending(p => p.ReviewCount)
                .ThenByDescending(p => p.SoldCount),
            DiscoveryConstants.SortNewest => query
                .OrderByDescending(p => p.PublishedAt ?? p.CreatedAt)
                .ThenByDescending(p => p.SoldCount),
            _ => query
                .OrderByDescending(p => p.SoldCount)
                .ThenByDescending(p => p.AvgRating)
                .ThenBy(p => p.Name)
        };
    }
}
