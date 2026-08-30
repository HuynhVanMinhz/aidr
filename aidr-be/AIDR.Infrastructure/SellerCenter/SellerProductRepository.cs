using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.SellerCenter;

public sealed class SellerProductRepository : ISellerProductRepository
{
    private readonly AidrDbContext _db;

    public SellerProductRepository(AidrDbContext db) => _db = db;

    public async Task<SellerShopRecord?> GetActiveShopByOwnerAsync(
        Guid ownerUserId,
        CancellationToken cancellationToken = default)
    {
        return await _db.Shops.AsNoTracking()
            .Where(s => s.OwnerUserId == ownerUserId && s.Status == AdminConstants.ShopStatusActive)
            .Select(s => new SellerShopRecord
            {
                ShopId = s.ShopId,
                OwnerUserId = s.OwnerUserId,
                Status = s.Status
            })
            .FirstOrDefaultAsync(cancellationToken);
    }

    public Task<bool> CategoryExistsAndActiveAsync(int categoryId, CancellationToken cancellationToken = default) =>
        _db.Categories.AsNoTracking()
            .AnyAsync(c => c.CategoryId == categoryId && c.IsActive, cancellationToken);

    public Task<bool> SlugExistsInShopAsync(
        Guid shopId,
        string slug,
        Guid? excludeProductId = null,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Products.AsNoTracking()
            .Where(p => p.ShopId == shopId && p.Slug == slug);

        if (excludeProductId is { } id)
            query = query.Where(p => p.ProductId != id);

        return query.AnyAsync(cancellationToken);
    }

    public async Task<(IReadOnlyList<SellerProductRecord> Items, int TotalCount)> ListByShopAsync(
        Guid shopId,
        string? status,
        string? keyword,
        int? categoryId,
        bool includeDeleted,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Products.AsNoTracking()
            .Where(p => p.ShopId == shopId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(p => p.Status == status);
        }
        else if (!includeDeleted)
        {
            query = query.Where(p => p.Status != SellerProductConstants.StatusDeleted);
        }

        if (categoryId is { } catId)
            query = query.Where(p => p.CategoryId == catId);

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var q = keyword.Trim();
            query = query.Where(p =>
                p.Name.Contains(q) ||
                (p.Brand != null && p.Brand.Contains(q)) ||
                (p.ModelNumber != null && p.ModelNumber.Contains(q)) ||
                p.Slug.Contains(q));
        }

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(p => p.UpdatedAt)
            .ThenByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new SellerProductRecord
            {
                ProductId = p.ProductId,
                ShopId = p.ShopId,
                CategoryId = p.CategoryId,
                CategoryName = p.Category.Name,
                Name = p.Name,
                Slug = p.Slug,
                ShortDescription = p.ShortDescription,
                Description = p.Description,
                Brand = p.Brand,
                ModelNumber = p.ModelNumber,
                ConditionType = p.ConditionType,
                BasePrice = p.BasePrice,
                SalePrice = p.SalePrice,
                Currency = p.Currency,
                StockQuantity = p.StockQuantity,
                ReservedQuantity = p.ReservedQuantity,
                WarrantyMonths = p.WarrantyMonths,
                OriginCountry = p.OriginCountry,
                TagsJson = p.TagsJson,
                SpecsJson = p.SpecsJson,
                IsFeatured = p.IsFeatured,
                Status = p.Status,
                PublishedAt = p.PublishedAt,
                AvgRating = p.AvgRating,
                ReviewCount = p.ReviewCount,
                SoldCount = p.SoldCount,
                ViewCount = p.ViewCount,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt,
                PrimaryImageUrl = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        return (items, total);
    }

    public async Task<SellerProductRecord?> GetByIdForShopAsync(
        Guid shopId,
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        var product = await _db.Products.AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.ShopId == shopId && p.ProductId == productId, cancellationToken);

        return product is null ? null : MapDetail(product);
    }

    public async Task<SellerProductRecord> CreateAsync(
        Guid shopId,
        SellerProductWriteModel model,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var entity = new Product
        {
            ShopId = shopId,
            CategoryId = model.CategoryId,
            Name = model.Name,
            Slug = model.Slug,
            ShortDescription = model.ShortDescription,
            Description = model.Description,
            Brand = model.Brand,
            ModelNumber = model.ModelNumber,
            ConditionType = model.ConditionType,
            BasePrice = model.BasePrice,
            SalePrice = model.SalePrice,
            Currency = SellerProductConstants.CurrencyVnd,
            WarrantyMonths = model.WarrantyMonths,
            OriginCountry = model.OriginCountry,
            TagsJson = model.TagsJson,
            SpecsJson = model.SpecsJson,
            Status = model.Status,
            PublishedAt = model.PublishedAt,
            CreatedAt = now,
            UpdatedAt = now
        };

        if (model.Images is { Count: > 0 })
        {
            foreach (var image in model.Images)
            {
                entity.Images.Add(new ProductImage
                {
                    ImageUrl = image.ImageUrl,
                    PublicId = image.PublicId,
                    SortOrder = image.SortOrder,
                    IsPrimary = image.IsPrimary,
                    CreatedAt = now
                });
            }
        }

        _db.Products.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        return (await GetByIdForShopAsync(shopId, entity.ProductId, cancellationToken))!;
    }

    public async Task<SellerProductRecord> UpdateAsync(
        Guid shopId,
        Guid productId,
        SellerProductWriteModel model,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.Products
            .FirstOrDefaultAsync(p => p.ShopId == shopId && p.ProductId == productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        if (entity.Status == SellerProductConstants.StatusDeleted)
            throw new ConflictException("Cannot update a deleted product.");

        entity.CategoryId = model.CategoryId;
        entity.Name = model.Name;
        entity.Slug = model.Slug;
        entity.ShortDescription = model.ShortDescription;
        entity.Description = model.Description;
        entity.Brand = model.Brand;
        entity.ModelNumber = model.ModelNumber;
        entity.ConditionType = model.ConditionType;
        entity.BasePrice = model.BasePrice;
        entity.SalePrice = model.SalePrice;
        entity.WarrantyMonths = model.WarrantyMonths;
        entity.OriginCountry = model.OriginCountry;
        entity.TagsJson = model.TagsJson;
        entity.SpecsJson = model.SpecsJson;
        entity.Status = model.Status;
        entity.PublishedAt = model.PublishedAt;
        entity.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        return (await GetByIdForShopAsync(shopId, productId, cancellationToken))!;
    }

    public async Task SoftDeleteAsync(Guid shopId, Guid productId, CancellationToken cancellationToken = default)
    {
        var entity = await _db.Products
            .FirstOrDefaultAsync(p => p.ShopId == shopId && p.ProductId == productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        if (entity.Status == SellerProductConstants.StatusDeleted)
            throw new ConflictException("Product is already deleted.");

        entity.Status = SellerProductConstants.StatusDeleted;
        entity.PublishedAt = null;
        entity.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<SellerProductRecord> AddImagesAsync(
        Guid shopId,
        Guid productId,
        IReadOnlyList<SellerProductImageWriteModel> images,
        bool replaceExisting,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.Products
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.ShopId == shopId && p.ProductId == productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        if (entity.Status == SellerProductConstants.StatusDeleted)
            throw new ConflictException("Cannot add images to a deleted product.");

        var now = DateTime.UtcNow;

        if (replaceExisting)
        {
            if (entity.Images.Count > 0)
                _db.ProductImages.RemoveRange(entity.Images);
            entity.Images.Clear();
        }
        else if (images.Any(i => i.IsPrimary))
        {
            foreach (var existing in entity.Images)
                existing.IsPrimary = false;
        }

        foreach (var image in images)
        {
            entity.Images.Add(new ProductImage
            {
                ImageUrl = image.ImageUrl,
                PublicId = image.PublicId,
                SortOrder = image.SortOrder,
                IsPrimary = image.IsPrimary,
                CreatedAt = now
            });
        }

        if (!entity.Images.Any(i => i.IsPrimary) && entity.Images.Count > 0)
        {
            var first = entity.Images.OrderBy(i => i.SortOrder).First();
            first.IsPrimary = true;
        }

        entity.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);

        return (await GetByIdForShopAsync(shopId, productId, cancellationToken))!;
    }

    public Task<int> GetImageCountAsync(Guid productId, CancellationToken cancellationToken = default) =>
        _db.ProductImages.AsNoTracking().CountAsync(i => i.ProductId == productId, cancellationToken);

    public async Task<Guid?> FindIdBySlugAsync(
        Guid shopId,
        string slug,
        CancellationToken cancellationToken = default)
    {
        // A deleted product still owns its slug, so an import row that matches one
        // must resolve to it rather than fail on the unique index later.
        var match = await _db.Products.AsNoTracking()
            .Where(p => p.ShopId == shopId && p.Slug == slug)
            .Select(p => (Guid?)p.ProductId)
            .FirstOrDefaultAsync(cancellationToken);

        return match;
    }

    public async Task<IReadOnlyDictionary<Guid, IReadOnlyList<string>>> ListImageUrlsAsync(
        IReadOnlyCollection<Guid> productIds,
        CancellationToken cancellationToken = default)
    {
        if (productIds.Count == 0)
            return new Dictionary<Guid, IReadOnlyList<string>>();

        var rows = await _db.ProductImages.AsNoTracking()
            .Where(i => productIds.Contains(i.ProductId))
            .OrderByDescending(i => i.IsPrimary)
            .ThenBy(i => i.SortOrder)
            .Select(i => new { i.ProductId, i.ImageUrl })
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(r => r.ProductId)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<string>)g.Select(r => r.ImageUrl).ToList());
    }

    public async Task<IReadOnlyList<SellerCategoryOptionRecord>> ListActiveCategoryOptionsAsync(
        CancellationToken cancellationToken = default)
    {
        return await _db.Categories.AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .Select(c => new SellerCategoryOptionRecord
            {
                CategoryId = c.CategoryId,
                ParentId = c.ParentId,
                Name = c.Name
            })
            .ToListAsync(cancellationToken);
    }

    private static SellerProductRecord MapDetail(Product product)
    {
        var images = product.Images
            .OrderByDescending(i => i.IsPrimary)
            .ThenBy(i => i.SortOrder)
            .Select(i => new SellerProductImageRecord
            {
                ProductImageId = i.ProductImageId,
                ImageUrl = i.ImageUrl,
                PublicId = i.PublicId,
                SortOrder = i.SortOrder,
                IsPrimary = i.IsPrimary
            })
            .ToList();

        return new SellerProductRecord
        {
            ProductId = product.ProductId,
            ShopId = product.ShopId,
            CategoryId = product.CategoryId,
            CategoryName = product.Category?.Name ?? string.Empty,
            Name = product.Name,
            Slug = product.Slug,
            ShortDescription = product.ShortDescription,
            Description = product.Description,
            Brand = product.Brand,
            ModelNumber = product.ModelNumber,
            ConditionType = product.ConditionType,
            BasePrice = product.BasePrice,
            SalePrice = product.SalePrice,
            Currency = product.Currency,
            StockQuantity = product.StockQuantity,
            ReservedQuantity = product.ReservedQuantity,
            WarrantyMonths = product.WarrantyMonths,
            OriginCountry = product.OriginCountry,
            TagsJson = product.TagsJson,
            SpecsJson = product.SpecsJson,
            IsFeatured = product.IsFeatured,
            Status = product.Status,
            PublishedAt = product.PublishedAt,
            AvgRating = product.AvgRating,
            ReviewCount = product.ReviewCount,
            SoldCount = product.SoldCount,
            ViewCount = product.ViewCount,
            CreatedAt = product.CreatedAt,
            UpdatedAt = product.UpdatedAt,
            PrimaryImageUrl = images.FirstOrDefault()?.ImageUrl,
            Images = images
        };
    }
}
