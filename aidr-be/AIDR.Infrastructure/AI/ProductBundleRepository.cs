using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.AI;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.AI;

public sealed class ProductBundleRepository : IProductBundleRepository
{
    private readonly AidrDbContext _db;

    public ProductBundleRepository(AidrDbContext db) => _db = db;

    public async Task<ProductBundleSourceRecord?> GetBundleSourceAsync(
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        return await BuildApprovedQuery()
            .Where(p => p.ProductId == productId)
            .Select(p => new ProductBundleSourceRecord
            {
                ProductId = p.ProductId,
                Name = p.Name,
                ShopId = p.ShopId,
                CategoryId = p.CategoryId,
                CategorySlug = p.Category.Slug,
                CategoryParentId = p.Category.ParentId
            })
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<int>> ResolveCategoryIdsBySlugsAsync(
        IReadOnlyList<string> slugs,
        CancellationToken cancellationToken = default)
    {
        if (slugs.Count == 0)
            return Array.Empty<int>();

        var normalized = slugs
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s.Trim().ToLowerInvariant())
            .Distinct()
            .ToList();

        var ids = await _db.Categories.AsNoTracking()
            .Where(c => c.IsActive && normalized.Contains(c.Slug))
            .Select(c => c.CategoryId)
            .ToListAsync(cancellationToken);

        var parentIds = await _db.Categories.AsNoTracking()
            .Where(c => c.IsActive && c.ParentId != null && ids.Contains(c.ParentId.Value))
            .Select(c => c.CategoryId)
            .ToListAsync(cancellationToken);

        return ids.Concat(parentIds).Distinct().ToList();
    }

    public async Task<IReadOnlyList<BundleCandidateRecord>> GetAccessoryCandidatesAsync(
        Guid excludeProductId,
        Guid preferShopId,
        IReadOnlyList<int> categoryIds,
        int take,
        CancellationToken cancellationToken = default)
    {
        if (categoryIds.Count == 0)
            return Array.Empty<BundleCandidateRecord>();

        take = Math.Clamp(take, 1, 24);

        var rows = await BuildApprovedQuery()
            .Where(p =>
                p.ProductId != excludeProductId
                && categoryIds.Contains(p.CategoryId)
                && p.StockQuantity > p.ReservedQuantity)
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
                PrimaryImageUrl = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault(),
                p.CategoryId,
                CategoryName = p.Category.Name,
                p.ShopId,
                ShopName = p.Shop.ShopName,
                SameShop = p.ShopId == preferShopId
            })
            .ToListAsync(cancellationToken);

        return rows
            .OrderByDescending(r => r.SameShop)
            .ThenByDescending(r => r.AvgRating)
            .ThenBy(r => r.SalePrice ?? r.BasePrice)
            .GroupBy(r => r.CategoryId)
            .SelectMany(g => g.Take(1))
            .OrderByDescending(r => r.SameShop)
            .ThenByDescending(r => r.AvgRating)
            .ThenBy(r => r.SalePrice ?? r.BasePrice)
            .Take(take)
            .Select(r => new BundleCandidateRecord
            {
                ProductId = r.ProductId,
                Name = r.Name,
                Slug = r.Slug,
                ShortDescription = r.ShortDescription,
                Brand = r.Brand,
                BasePrice = r.BasePrice,
                SalePrice = r.SalePrice,
                Currency = r.Currency,
                StockQuantity = r.StockQuantity,
                ReservedQuantity = r.ReservedQuantity,
                AvgRating = r.AvgRating,
                ReviewCount = r.ReviewCount,
                PrimaryImageUrl = r.PrimaryImageUrl,
                CategoryId = r.CategoryId,
                CategoryName = r.CategoryName,
                ShopId = r.ShopId,
                ShopName = r.ShopName,
                SameShop = r.SameShop
            })
            .ToList();
    }

    private IQueryable<Product> BuildApprovedQuery()
        => _db.Products.AsNoTracking()
            .Where(p =>
                p.Status == RecommendationConstants.ApprovedStatus
                && p.Shop.Status == RecommendationConstants.ActiveShopStatus);
}
