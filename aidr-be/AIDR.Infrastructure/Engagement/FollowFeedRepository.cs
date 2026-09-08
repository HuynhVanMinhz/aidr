using AIDR.Infrastructure.Persistence;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Engagement;

public sealed class FollowFeedRepository : IFollowFeedRepository
{
    private readonly AidrDbContext _db;

    public FollowFeedRepository(AidrDbContext db) => _db = db;

    public async Task<FollowFeedResultDto> GetFeedAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var followedShopIds = await _db.SellerFollows.AsNoTracking()
            .Where(f => f.BuyerUserId == userId)
            .Select(f => f.ShopId)
            .ToListAsync(cancellationToken);

        if (followedShopIds.Count == 0)
        {
            return new FollowFeedResultDto
            {
                Items = Array.Empty<FollowFeedItemDto>(),
                Page = page,
                PageSize = pageSize,
                TotalCount = 0
            };
        }

        var now = DateTime.UtcNow;

        var productRows = await _db.Products.AsNoTracking()
            .Where(p => followedShopIds.Contains(p.ShopId)
                        && p.Status == OrderConstants.ApprovedProductStatus)
            .Select(p => new FeedProductRow
            {
                CreatedAt = p.PublishedAt ?? p.CreatedAt,
                ShopId = p.ShopId,
                ShopName = p.Shop.ShopName,
                ShopSlug = p.Shop.Slug,
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
                ShopIsVerified = p.Shop.IsVerified,
                VariantCount = p.Variants.Count(v => v.IsActive),
                MaxVariantEffectivePrice = p.Variants.Any(v => v.IsActive)
                    ? p.Variants.Where(v => v.IsActive).Max(v => (decimal?)(v.SalePrice ?? v.Price))
                    : null
            })
            .ToListAsync(cancellationToken);

        var voucherRows = await _db.Vouchers.AsNoTracking()
            .Where(v => v.ShopId != null
                        && followedShopIds.Contains(v.ShopId.Value)
                        && v.IsActive
                        && v.StartsAt <= now
                        && v.EndsAt >= now
                        && v.Scope == VoucherConstants.ScopeShop)
            .Select(v => new FeedVoucherRow
            {
                CreatedAt = v.CreatedAt,
                ShopId = v.ShopId!.Value,
                ShopName = v.Shop!.ShopName,
                ShopSlug = v.Shop.Slug,
                VoucherId = v.VoucherId,
                Code = v.Code,
                Name = v.Name,
                Description = v.Description,
                DiscountType = v.DiscountType,
                DiscountValue = v.DiscountValue,
                MaxDiscountAmount = v.MaxDiscountAmount,
                MinOrderAmount = v.MinOrderAmount,
                StartsAt = v.StartsAt,
                EndsAt = v.EndsAt
            })
            .ToListAsync(cancellationToken);

        var merged = productRows
            .Select(p => new FollowFeedItemDto
            {
                ItemType = FollowFeedConstants.ItemTypeProduct,
                CreatedAt = p.CreatedAt,
                ShopId = p.ShopId,
                ShopName = p.ShopName,
                ShopSlug = p.ShopSlug,
                Product = MapProduct(p)
            })
            .Concat(voucherRows.Select(v => new FollowFeedItemDto
            {
                ItemType = FollowFeedConstants.ItemTypeVoucher,
                CreatedAt = v.CreatedAt,
                ShopId = v.ShopId,
                ShopName = v.ShopName,
                ShopSlug = v.ShopSlug,
                Voucher = new FollowFeedVoucherDto
                {
                    VoucherId = v.VoucherId,
                    Code = v.Code,
                    Name = v.Name,
                    Description = v.Description,
                    DiscountType = v.DiscountType,
                    DiscountValue = v.DiscountValue,
                    MaxDiscountAmount = v.MaxDiscountAmount,
                    MinOrderAmount = v.MinOrderAmount,
                    StartsAt = v.StartsAt,
                    EndsAt = v.EndsAt
                }
            }))
            .OrderByDescending(i => i.CreatedAt)
            .ToList();

        var totalCount = merged.Count;
        var items = merged
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return new FollowFeedResultDto
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    private static ProductListItemDto MapProduct(FeedProductRow p)
    {
        var effectivePrice = p.SalePrice ?? p.BasePrice;
        if (p.MaxVariantEffectivePrice is { } maxVariant)
            effectivePrice = Math.Min(effectivePrice, maxVariant);

        return new ProductListItemDto
        {
            ProductId = p.ProductId,
            Name = p.Name,
            Slug = p.Slug,
            ShortDescription = p.ShortDescription,
            Brand = p.Brand,
            BasePrice = p.BasePrice,
            SalePrice = p.SalePrice,
            EffectivePrice = effectivePrice,
            MaxEffectivePrice = p.MaxVariantEffectivePrice ?? effectivePrice,
            VariantCount = p.VariantCount,
            Currency = p.Currency,
            StockQuantity = p.StockQuantity,
            AvailableQuantity = Math.Max(0, p.StockQuantity - p.ReservedQuantity),
            AvgRating = p.AvgRating,
            ReviewCount = p.ReviewCount,
            SoldCount = p.SoldCount,
            IsFeatured = p.IsFeatured,
            PrimaryImageUrl = p.PrimaryImageUrl,
            CategoryId = p.CategoryId,
            CategoryName = p.CategoryName,
            ShopId = p.ShopId,
            ShopName = p.ShopName
        };
    }

    private sealed class FeedProductRow
    {
        public DateTime CreatedAt { get; init; }
        public Guid ShopId { get; init; }
        public string ShopName { get; init; } = null!;
        public string ShopSlug { get; init; } = null!;
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
        public bool ShopIsVerified { get; init; }
        public int VariantCount { get; init; }
        public decimal? MaxVariantEffectivePrice { get; init; }
    }

    private sealed class FeedVoucherRow
    {
        public DateTime CreatedAt { get; init; }
        public Guid ShopId { get; init; }
        public string ShopName { get; init; } = null!;
        public string ShopSlug { get; init; } = null!;
        public Guid VoucherId { get; init; }
        public string Code { get; init; } = null!;
        public string Name { get; init; } = null!;
        public string? Description { get; init; }
        public string DiscountType { get; init; } = null!;
        public decimal DiscountValue { get; init; }
        public decimal? MaxDiscountAmount { get; init; }
        public decimal MinOrderAmount { get; init; }
        public DateTime StartsAt { get; init; }
        public DateTime EndsAt { get; init; }
    }
}
