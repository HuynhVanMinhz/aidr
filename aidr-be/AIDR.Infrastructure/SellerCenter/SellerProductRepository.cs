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
                ShopName = s.ShopName,
                Status = s.Status
            })
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Guid>> ListAdminUserIdsAsync(CancellationToken cancellationToken = default)
    {
        return await _db.UserRoles.AsNoTracking()
            .Where(ur => ur.Role.RoleCode == RoleCodes.Admin)
            .Select(ur => ur.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);
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
                    .FirstOrDefault(),
                VariantOptionsJson = p.VariantOptionsJson,
                // The list screen shows a price range, so it needs the variant prices;
                // the heavier fields (attributes, image) stay out of the projection.
                Variants = p.Variants
                    .OrderBy(v => v.SortOrder)
                    .Select(v => new SellerProductVariantRecord
                    {
                        VariantId = v.VariantId,
                        Sku = v.Sku,
                        VariantName = v.VariantName,
                        Price = v.Price,
                        SalePrice = v.SalePrice,
                        StockQuantity = v.StockQuantity,
                        ReservedQuantity = v.ReservedQuantity,
                        SortOrder = v.SortOrder,
                        IsActive = v.IsActive
                    })
                    .ToList()
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
            .Include(p => p.Variants)
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
            VariantOptionsJson = model.VariantOptionsJson,
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

        if (model.Variants is { Count: > 0 })
        {
            // Added through the navigation, like the images above: EF fills in ProductId,
            // so this does not depend on the key being known before SaveChanges.
            foreach (var variant in model.Variants)
            {
                entity.Variants.Add(new ProductVariant
                {
                    VariantId = Guid.NewGuid(),
                    Sku = variant.Sku,
                    VariantName = variant.VariantName,
                    AttributesJson = variant.AttributesJson,
                    Price = variant.Price,
                    SalePrice = variant.SalePrice,
                    // Stock arrives through inventory lots, so a new variant starts empty.
                    StockQuantity = 0,
                    ReservedQuantity = 0,
                    ImageUrl = variant.ImageUrl,
                    SortOrder = variant.SortOrder,
                    IsActive = variant.IsActive,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }

            SyncPricingFromVariants(entity, model.Variants, now);
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

        var oldBasePrice = entity.BasePrice;
        var oldSalePrice = entity.SalePrice;

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

        var now = DateTime.UtcNow;
        entity.UpdatedAt = now;

        // Null means the caller did not touch the variant editor; only a supplied list
        // (empty included, which clears them) rewrites what is stored.
        if (model.Variants is not null)
        {
            entity.VariantOptionsJson = model.VariantOptionsJson;
            await ApplyVariantsAsync(entity, model.Variants, now, cancellationToken);
        }

        // Catalogue price may also change via variant rollup — record the same history as UC-92.
        if (entity.BasePrice != oldBasePrice || entity.SalePrice != oldSalePrice)
        {
            _db.ProductPriceHistories.Add(new ProductPriceHistory
            {
                ProductId = productId,
                OldBasePrice = oldBasePrice,
                NewBasePrice = entity.BasePrice,
                OldSalePrice = oldSalePrice,
                NewSalePrice = entity.SalePrice,
                ChangedBy = model.ChangedBy,
                Reason = model.Variants is not null ? "ProductUpdateWithVariants" : "ProductUpdate",
                ChangedAt = now
            });
        }

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
            VariantOptionsJson = product.VariantOptionsJson,
            Images = images,
            Variants = product.Variants
                .OrderBy(v => v.SortOrder)
                .ThenBy(v => v.VariantName)
                .Select(v => new SellerProductVariantRecord
                {
                    VariantId = v.VariantId,
                    Sku = v.Sku,
                    VariantName = v.VariantName,
                    AttributesJson = v.AttributesJson,
                    Price = v.Price,
                    SalePrice = v.SalePrice,
                    StockQuantity = v.StockQuantity,
                    ReservedQuantity = v.ReservedQuantity,
                    ImageUrl = v.ImageUrl,
                    SortOrder = v.SortOrder,
                    IsActive = v.IsActive
                })
                .ToList()
        };
    }

    /// <summary>
    /// Applies the submitted variant set to <paramref name="product"/>: updates the rows the
    /// seller kept, inserts the new ones, deletes the rest. A dropped variant that still holds
    /// stock or appears on an order is refused rather than deleted - removing it would strand
    /// its inventory lots and orphan the order history.
    /// </summary>
    private async Task ApplyVariantsAsync(
        Product product,
        IReadOnlyList<SellerProductVariantWriteModel> variants,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var existing = await _db.ProductVariants
            .Where(v => v.ProductId == product.ProductId)
            .ToListAsync(cancellationToken);

        var keptIds = variants
            .Where(v => v.VariantId is not null)
            .Select(v => v.VariantId!.Value)
            .ToHashSet();

        var removed = existing.Where(v => !keptIds.Contains(v.VariantId)).ToList();
        if (removed.Count > 0)
        {
            var removedIds = removed.Select(v => v.VariantId).ToList();

            var stocked = removed.FirstOrDefault(v => v.StockQuantity > 0);
            if (stocked is not null)
            {
                throw new ConflictException(
                    $"Variant '{stocked.VariantName}' still holds {stocked.StockQuantity} unit(s) in stock. "
                    + "Write the stock off in Inventory before removing it.");
            }

            var orderedId = await _db.OrderItems.AsNoTracking()
                .Where(i => i.VariantId != null && removedIds.Contains(i.VariantId!.Value))
                .Select(i => i.VariantId)
                .FirstOrDefaultAsync(cancellationToken);
            if (orderedId is not null)
            {
                var name = removed.First(v => v.VariantId == orderedId.Value).VariantName;
                throw new ConflictException(
                    $"Variant '{name}' appears on past orders and cannot be deleted. Deactivate it instead.");
            }

            // A cart line is disposable in a way an order is not, so clear it rather than refuse.
            var strandedCartItems = await _db.CartItems
                .Where(i => i.VariantId != null && removedIds.Contains(i.VariantId!.Value))
                .ToListAsync(cancellationToken);
            if (strandedCartItems.Count > 0)
                _db.CartItems.RemoveRange(strandedCartItems);

            _db.ProductVariants.RemoveRange(removed);
        }

        var byId = existing.ToDictionary(v => v.VariantId);

        foreach (var model in variants)
        {
            if (model.VariantId is { } id && byId.TryGetValue(id, out var target))
            {
                target.Sku = model.Sku;
                target.VariantName = model.VariantName;
                target.AttributesJson = model.AttributesJson;
                target.Price = model.Price;
                target.SalePrice = model.SalePrice;
                target.ImageUrl = model.ImageUrl;
                target.SortOrder = model.SortOrder;
                target.IsActive = model.IsActive;
                target.UpdatedAt = now;
                continue;
            }

            _db.ProductVariants.Add(new ProductVariant
            {
                VariantId = Guid.NewGuid(),
                ProductId = product.ProductId,
                Sku = model.Sku,
                VariantName = model.VariantName,
                AttributesJson = model.AttributesJson,
                Price = model.Price,
                SalePrice = model.SalePrice,
                // Stock arrives through inventory lots, so a fresh variant starts empty.
                StockQuantity = 0,
                ReservedQuantity = 0,
                ImageUrl = model.ImageUrl,
                SortOrder = model.SortOrder,
                IsActive = model.IsActive,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        SyncPricingFromVariants(product, variants, now);
    }

    private static void SyncPricingFromVariants(
        Product product,
        IReadOnlyList<SellerProductVariantWriteModel> variants,
        DateTime now) =>
        ProductVariantPricing.Apply(
            product,
            variants
                .Select(v => new ProductVariantPricing.VariantPrice(v.Price, v.SalePrice, v.IsActive))
                .ToList(),
            now);
}
