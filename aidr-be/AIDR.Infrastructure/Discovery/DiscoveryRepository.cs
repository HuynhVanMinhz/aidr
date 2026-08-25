using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Discovery.Abstractions;
using AIDR.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Discovery;

public sealed class DiscoveryRepository : IDiscoveryRepository
{
    private const string ApprovedStatus = "Approved";
    private const string ActiveShopStatus = "Active";

    private readonly AidrDbContext _db;

    public DiscoveryRepository(AidrDbContext db) => _db = db;

    public async Task<(IReadOnlyList<ProductListRecord> Items, int TotalCount)> QueryApprovedProductsAsync(
        ProductListQuery query,
        CancellationToken cancellationToken = default)
    {
        var q = BuildApprovedQuery();

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var keyword = query.Q.Trim();
            q = q.Where(p =>
                p.Name.Contains(keyword)
                || (p.Brand != null && p.Brand.Contains(keyword))
                || (p.ShortDescription != null && p.ShortDescription.Contains(keyword))
                || (p.SpecsJson != null && p.SpecsJson.Contains(keyword))
                || (p.TagsJson != null && p.TagsJson.Contains(keyword))
                || (p.ModelNumber != null && p.ModelNumber.Contains(keyword)));
        }

        if (query.CategoryId is { } categoryId)
            q = q.Where(p => p.CategoryId == categoryId);

        if (query.ShopId is { } shopId)
            q = q.Where(p => p.ShopId == shopId);

        if (!string.IsNullOrWhiteSpace(query.Brand))
        {
            var brand = query.Brand.Trim();
            q = q.Where(p => p.Brand != null && p.Brand == brand);
        }

        if (query.MinPrice is { } minPrice)
            q = q.Where(p => (p.SalePrice ?? p.BasePrice) >= minPrice);

        if (query.MaxPrice is { } maxPrice)
            q = q.Where(p => (p.SalePrice ?? p.BasePrice) <= maxPrice);

        if (query.MinRating is { } minRating)
            q = q.Where(p => p.AvgRating >= minRating);

        q = ApplySort(q, query.Sort);

        var total = await q.CountAsync(cancellationToken);
        var skip = (query.Page - 1) * query.PageSize;

        var items = await q
            .Skip(skip)
            .Take(query.PageSize)
            .Select(p => new ProductListRecord
            {
                ProductId = p.ProductId,
                Name = p.Name,
                Slug = p.Slug,
                ShortDescription = p.ShortDescription,
                Brand = p.Brand,
                BasePrice = p.BasePrice,
                SalePrice = p.SalePrice,
                Currency = p.Currency,
                StockQuantity = p.StockQuantity,
                ReservedQuantity = p.ReservedQuantity,
                AvgRating = p.AvgRating,
                ReviewCount = p.ReviewCount,
                SoldCount = p.SoldCount,
                IsFeatured = p.IsFeatured,
                PrimaryImageUrl = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault(),
                CategoryId = p.CategoryId,
                CategoryName = p.Category.Name,
                ShopId = p.ShopId,
                ShopName = p.Shop.ShopName,
                PublishedAt = p.PublishedAt
            })
            .ToListAsync(cancellationToken);

        return (items, total);
    }

    public async Task<ProductDetailRecord?> GetApprovedProductByIdAsync(
        Guid productId,
        int recentReviewsLimit,
        CancellationToken cancellationToken = default)
    {
        var product = await BuildApprovedQuery()
            .Where(p => p.ProductId == productId)
            .Select(p => new
            {
                p.ProductId,
                p.Name,
                p.Slug,
                p.ShortDescription,
                p.Description,
                p.Brand,
                p.ModelNumber,
                p.ConditionType,
                p.BasePrice,
                p.SalePrice,
                p.Currency,
                p.StockQuantity,
                p.ReservedQuantity,
                p.WarrantyMonths,
                p.OriginCountry,
                p.SpecsJson,
                p.TagsJson,
                p.AvgRating,
                p.ReviewCount,
                p.SoldCount,
                p.ViewCount,
                p.IsFeatured,
                p.PublishedAt,
                p.CategoryId,
                CategoryName = p.Category.Name,
                CategorySlug = p.Category.Slug,
                p.ShopId,
                ShopName = p.Shop.ShopName,
                ShopSlug = p.Shop.Slug,
                ShopLogoUrl = p.Shop.LogoUrl,
                ShopIsVerified = p.Shop.IsVerified,
                ShopAvgRating = p.Shop.AvgRating,
                ShopRatingCount = p.Shop.RatingCount,
                Images = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => new ProductImageRecord
                    {
                        ProductImageId = i.ProductImageId,
                        ImageUrl = i.ImageUrl,
                        SortOrder = i.SortOrder,
                        IsPrimary = i.IsPrimary
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (product is null)
            return null;

        var reviews = await _db.ProductReviews.AsNoTracking()
            .Where(r => r.ProductId == productId && r.IsVisible)
            .OrderByDescending(r => r.CreatedAt)
            .Take(recentReviewsLimit)
            .Select(r => new ProductReviewRecord
            {
                ReviewId = r.ReviewId,
                Rating = r.Rating,
                Title = r.Title,
                Content = r.Content,
                BuyerName = r.Buyer.FullName,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return new ProductDetailRecord
        {
            ProductId = product.ProductId,
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
            SpecsJson = product.SpecsJson,
            TagsJson = product.TagsJson,
            AvgRating = product.AvgRating,
            ReviewCount = product.ReviewCount,
            SoldCount = product.SoldCount,
            ViewCount = product.ViewCount,
            IsFeatured = product.IsFeatured,
            PublishedAt = product.PublishedAt,
            CategoryId = product.CategoryId,
            CategoryName = product.CategoryName,
            CategorySlug = product.CategorySlug,
            ShopId = product.ShopId,
            ShopName = product.ShopName,
            ShopSlug = product.ShopSlug,
            ShopLogoUrl = product.ShopLogoUrl,
            ShopIsVerified = product.ShopIsVerified,
            ShopAvgRating = product.ShopAvgRating,
            ShopRatingCount = product.ShopRatingCount,
            Images = product.Images,
            RecentReviews = reviews
        };
    }

    public async Task RecordProductViewAsync(
        Guid productId,
        Guid? userId,
        string? sessionId,
        CancellationToken cancellationToken = default)
    {
        var product = await _db.Products
            .FirstOrDefaultAsync(p => p.ProductId == productId && p.Status == ApprovedStatus, cancellationToken);

        if (product is null)
            return;

        product.ViewCount += 1;
        product.UpdatedAt = DateTime.UtcNow;

        _db.ViewedProductHistories.Add(new ViewedProductHistory
        {
            UserId = userId,
            SessionId = sessionId,
            ProductId = productId,
            ViewedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CategoryRecord>> GetActiveCategoriesAsync(
        CancellationToken cancellationToken = default)
    {
        return await _db.Categories.AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .Select(c => new CategoryRecord
            {
                CategoryId = c.CategoryId,
                ParentId = c.ParentId,
                Name = c.Name,
                Slug = c.Slug,
                Description = c.Description,
                ImageUrl = c.ImageUrl,
                SortOrder = c.SortOrder
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<ShopPublicRecord?> GetActiveShopByKeyAsync(
        string shopKey,
        CancellationToken cancellationToken = default)
    {
        var key = shopKey.Trim();
        IQueryable<Shop> query = _db.Shops.AsNoTracking()
            .Where(s => s.Status == ActiveShopStatus);

        if (Guid.TryParse(key, out var shopId))
            query = query.Where(s => s.ShopId == shopId);
        else
            query = query.Where(s => s.Slug == key);

        var shop = await query
            .Select(s => new
            {
                s.ShopId,
                s.ShopName,
                s.Slug,
                s.Tagline,
                s.ShortDescription,
                s.Description,
                s.LogoUrl,
                s.BannerUrl,
                s.IsVerified,
                s.VerifiedAt,
                s.AvgRating,
                s.RatingCount,
                s.FollowerCount,
                s.ReturnPolicy,
                s.ShippingPolicy,
                s.OpeningHoursJson,
                s.Email,
                s.Phone,
                s.Hotline,
                s.WebsiteUrl,
                s.FacebookUrl,
                s.Province,
                s.District,
                s.Ward,
                s.StreetAddress,
                s.CreatedAt
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (shop is null)
            return null;

        var approvedProductCount = await _db.Products.AsNoTracking()
            .CountAsync(
                p => p.ShopId == shop.ShopId
                     && p.Status == ApprovedStatus
                     && p.Category.IsActive,
                cancellationToken);

        return new ShopPublicRecord
        {
            ShopId = shop.ShopId,
            ShopName = shop.ShopName,
            Slug = shop.Slug,
            Tagline = shop.Tagline,
            ShortDescription = shop.ShortDescription,
            Description = shop.Description,
            LogoUrl = shop.LogoUrl,
            BannerUrl = shop.BannerUrl,
            IsVerified = shop.IsVerified,
            VerifiedAt = shop.VerifiedAt,
            AvgRating = shop.AvgRating,
            RatingCount = shop.RatingCount,
            FollowerCount = shop.FollowerCount,
            ProductCount = approvedProductCount,
            ReturnPolicy = shop.ReturnPolicy,
            ShippingPolicy = shop.ShippingPolicy,
            OpeningHoursJson = shop.OpeningHoursJson,
            Email = shop.Email,
            Phone = shop.Phone,
            Hotline = shop.Hotline,
            WebsiteUrl = shop.WebsiteUrl,
            FacebookUrl = shop.FacebookUrl,
            Province = shop.Province,
            District = shop.District,
            Ward = shop.Ward,
            StreetAddress = shop.StreetAddress,
            CreatedAt = shop.CreatedAt
        };
    }

    private IQueryable<Product> BuildApprovedQuery()
        => _db.Products.AsNoTracking()
            .Where(p => p.Status == ApprovedStatus
                        && p.Category.IsActive
                        && p.Shop.Status == ActiveShopStatus);

    private static IQueryable<Product> ApplySort(IQueryable<Product> query, string sort)
        => sort.ToLowerInvariant() switch
        {
            DiscoveryConstants.SortPriceAsc => query
                .OrderBy(p => p.SalePrice ?? p.BasePrice)
                .ThenByDescending(p => p.PublishedAt),
            DiscoveryConstants.SortPriceDesc => query
                .OrderByDescending(p => p.SalePrice ?? p.BasePrice)
                .ThenByDescending(p => p.PublishedAt),
            DiscoveryConstants.SortPopular => query
                .OrderByDescending(p => p.SoldCount)
                .ThenByDescending(p => p.ViewCount)
                .ThenByDescending(p => p.PublishedAt),
            DiscoveryConstants.SortRating => query
                .OrderByDescending(p => p.AvgRating)
                .ThenByDescending(p => p.ReviewCount)
                .ThenByDescending(p => p.PublishedAt),
            _ => query
                .OrderByDescending(p => p.IsFeatured)
                .ThenByDescending(p => p.PublishedAt ?? p.CreatedAt)
        };
}
