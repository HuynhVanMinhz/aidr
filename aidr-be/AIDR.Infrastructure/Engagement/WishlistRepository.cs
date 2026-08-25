using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Engagement;

public sealed class WishlistRepository : IWishlistRepository
{
    private readonly AidrDbContext _db;

    public WishlistRepository(AidrDbContext db) => _db = db;

    public async Task<PagedResult<WishlistItemDto>> ListAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _db.WishlistItems
            .AsNoTracking()
            .Where(w => w.UserId == userId);

        var totalCount = await query.CountAsync(cancellationToken);

        var rows = await query
            .OrderByDescending(w => w.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(w => new
            {
                w.WishlistItemId,
                w.ProductId,
                w.CreatedAt,
                ProductName = w.Product.Name,
                ProductSlug = w.Product.Slug,
                Status = w.Product.Status,
                BasePrice = w.Product.BasePrice,
                SalePrice = w.Product.SalePrice,
                Currency = w.Product.Currency,
                StockQuantity = w.Product.StockQuantity,
                ReservedQuantity = w.Product.ReservedQuantity,
                AvgRating = w.Product.AvgRating,
                CategoryIsActive = w.Product.Category.IsActive,
                ShopId = w.Product.ShopId,
                ShopName = w.Product.Shop.ShopName,
                ShopSlug = w.Product.Shop.Slug,
                ShopStatus = w.Product.Shop.Status,
                PrimaryImageUrl = w.Product.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(r =>
        {
            var available = Math.Max(0, r.StockQuantity - r.ReservedQuantity);
            var isAvailable =
                string.Equals(r.Status, WishlistConstants.ApprovedStatus, StringComparison.OrdinalIgnoreCase)
                && r.CategoryIsActive
                && string.Equals(r.ShopStatus, WishlistConstants.ActiveShopStatus, StringComparison.OrdinalIgnoreCase)
                && available > 0;

            return new WishlistItemDto
            {
                WishlistItemId = r.WishlistItemId,
                ProductId = r.ProductId,
                ProductName = r.ProductName,
                ProductSlug = r.ProductSlug,
                PrimaryImageUrl = r.PrimaryImageUrl,
                ShopId = r.ShopId,
                ShopName = r.ShopName,
                ShopSlug = r.ShopSlug,
                BasePrice = r.BasePrice,
                SalePrice = r.SalePrice,
                EffectivePrice = r.SalePrice ?? r.BasePrice,
                Currency = r.Currency,
                AvailableQuantity = available,
                IsAvailable = isAvailable,
                AvgRating = r.AvgRating,
                CreatedAt = r.CreatedAt
            };
        }).ToList();

        return new PagedResult<WishlistItemDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public Task<WishlistProductSnapshot?> GetWishlistableProductAsync(
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        return _db.Products
            .AsNoTracking()
            .Where(p => p.ProductId == productId)
            .Select(p => new WishlistProductSnapshot
            {
                ProductId = p.ProductId,
                Name = p.Name,
                Slug = p.Slug,
                Status = p.Status,
                BasePrice = p.BasePrice,
                SalePrice = p.SalePrice,
                Currency = p.Currency,
                StockQuantity = p.StockQuantity,
                ReservedQuantity = p.ReservedQuantity,
                AvgRating = p.AvgRating,
                CategoryIsActive = p.Category.IsActive,
                ShopId = p.ShopId,
                ShopName = p.Shop.ShopName,
                ShopSlug = p.Shop.Slug,
                ShopStatus = p.Shop.Status,
                PrimaryImageUrl = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault()
            })
            .FirstOrDefaultAsync(cancellationToken);
    }

    public Task<bool> ExistsAsync(
        Guid userId,
        Guid productId,
        CancellationToken cancellationToken = default)
        => _db.WishlistItems.AnyAsync(
            w => w.UserId == userId && w.ProductId == productId,
            cancellationToken);

    public async Task<WishlistItemDto> AddAsync(
        Guid userId,
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var entity = new WishlistItem
        {
            WishlistItemId = Guid.NewGuid(),
            UserId = userId,
            ProductId = productId,
            CreatedAt = now
        };

        _db.WishlistItems.Add(entity);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            throw new ConflictException("Product is already in your wishlist.");
        }

        var listed = await _db.WishlistItems
            .AsNoTracking()
            .Where(w => w.WishlistItemId == entity.WishlistItemId)
            .Select(w => new
            {
                w.WishlistItemId,
                w.ProductId,
                w.CreatedAt,
                ProductName = w.Product.Name,
                ProductSlug = w.Product.Slug,
                Status = w.Product.Status,
                BasePrice = w.Product.BasePrice,
                SalePrice = w.Product.SalePrice,
                Currency = w.Product.Currency,
                StockQuantity = w.Product.StockQuantity,
                ReservedQuantity = w.Product.ReservedQuantity,
                AvgRating = w.Product.AvgRating,
                CategoryIsActive = w.Product.Category.IsActive,
                ShopId = w.Product.ShopId,
                ShopName = w.Product.Shop.ShopName,
                ShopSlug = w.Product.Shop.Slug,
                ShopStatus = w.Product.Shop.Status,
                PrimaryImageUrl = w.Product.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault()
            })
            .FirstAsync(cancellationToken);

        var available = Math.Max(0, listed.StockQuantity - listed.ReservedQuantity);
        var isAvailable =
            string.Equals(listed.Status, WishlistConstants.ApprovedStatus, StringComparison.OrdinalIgnoreCase)
            && listed.CategoryIsActive
            && string.Equals(listed.ShopStatus, WishlistConstants.ActiveShopStatus, StringComparison.OrdinalIgnoreCase)
            && available > 0;

        return new WishlistItemDto
        {
            WishlistItemId = listed.WishlistItemId,
            ProductId = listed.ProductId,
            ProductName = listed.ProductName,
            ProductSlug = listed.ProductSlug,
            PrimaryImageUrl = listed.PrimaryImageUrl,
            ShopId = listed.ShopId,
            ShopName = listed.ShopName,
            ShopSlug = listed.ShopSlug,
            BasePrice = listed.BasePrice,
            SalePrice = listed.SalePrice,
            EffectivePrice = listed.SalePrice ?? listed.BasePrice,
            Currency = listed.Currency,
            AvailableQuantity = available,
            IsAvailable = isAvailable,
            AvgRating = listed.AvgRating,
            CreatedAt = listed.CreatedAt
        };
    }

    public async Task<RemoveWishlistItemResponse> RemoveAsync(
        Guid userId,
        Guid wishlistItemId,
        CancellationToken cancellationToken = default)
    {
        var item = await _db.WishlistItems
            .FirstOrDefaultAsync(
                w => w.WishlistItemId == wishlistItemId && w.UserId == userId,
                cancellationToken)
            ?? throw new NotFoundException("Wishlist item not found.");

        var response = new RemoveWishlistItemResponse
        {
            WishlistItemId = item.WishlistItemId,
            ProductId = item.ProductId
        };

        _db.WishlistItems.Remove(item);
        await _db.SaveChangesAsync(cancellationToken);
        return response;
    }

    public async Task<RemoveWishlistItemResponse> RemoveByProductAsync(
        Guid userId,
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        var item = await _db.WishlistItems
            .FirstOrDefaultAsync(
                w => w.UserId == userId && w.ProductId == productId,
                cancellationToken)
            ?? throw new NotFoundException("Wishlist item not found.");

        var response = new RemoveWishlistItemResponse
        {
            WishlistItemId = item.WishlistItemId,
            ProductId = item.ProductId
        };

        _db.WishlistItems.Remove(item);
        await _db.SaveChangesAsync(cancellationToken);
        return response;
    }
}
