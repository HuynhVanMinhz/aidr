using AIDR.Infrastructure.Persistence;
using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Constants;
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

        var rows = await _db.Products.AsNoTracking()
            .Where(p => idSet.Contains(p.ProductId)
                        && p.Status == RecommendationConstants.ApprovedStatus
                        && p.Category.IsActive
                        && p.Shop.Status == RecommendationConstants.ActiveShopStatus)
            .Select(p => new AiCompareProductRecord
            {
                ProductId = p.ProductId,
                Name = p.Name,
                Slug = p.Slug,
                ShortDescription = p.ShortDescription,
                Brand = p.Brand,
                ModelNumber = p.ModelNumber,
                BasePrice = p.BasePrice,
                SalePrice = p.SalePrice,
                Currency = p.Currency,
                AvgRating = p.AvgRating,
                ReviewCount = p.ReviewCount,
                WarrantyMonths = p.WarrantyMonths,
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

        // Preserve request order for stable compare UI.
        var byId = rows.ToDictionary(r => r.ProductId);
        return productIds
            .Where(id => byId.ContainsKey(id))
            .Select(id => byId[id])
            .ToList();
    }

    public async Task<IReadOnlyList<AiCompareProductRecord>> SearchApprovedProductsAsync(
        string? query,
        int take,
        CancellationToken cancellationToken = default)
    {
        take = Math.Clamp(take, 1, 24);
        var q = (query ?? string.Empty).Trim();

        var baseQuery = _db.Products.AsNoTracking()
            .Where(p => p.Status == RecommendationConstants.ApprovedStatus
                        && p.Category.IsActive
                        && p.Shop.Status == RecommendationConstants.ActiveShopStatus);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var like = $"%{q}%";
            baseQuery = baseQuery.Where(p =>
                EF.Functions.Like(p.Name, like)
                || (p.Brand != null && EF.Functions.Like(p.Brand, like))
                || (p.ShortDescription != null && EF.Functions.Like(p.ShortDescription, like))
                || (p.TagsJson != null && EF.Functions.Like(p.TagsJson, like))
                || EF.Functions.Like(p.Category.Name, like));
        }

        return await baseQuery
            .OrderByDescending(p => p.SoldCount)
            .ThenByDescending(p => p.AvgRating)
            .ThenBy(p => p.Name)
            .Take(take)
            .Select(p => new AiCompareProductRecord
            {
                ProductId = p.ProductId,
                Name = p.Name,
                Slug = p.Slug,
                ShortDescription = p.ShortDescription,
                Brand = p.Brand,
                ModelNumber = p.ModelNumber,
                BasePrice = p.BasePrice,
                SalePrice = p.SalePrice,
                Currency = p.Currency,
                AvgRating = p.AvgRating,
                ReviewCount = p.ReviewCount,
                WarrantyMonths = p.WarrantyMonths,
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
}
