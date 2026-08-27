using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Engagement;

public sealed class ProductReviewRepository : IProductReviewRepository
{
    private readonly AidrDbContext _db;

    public ProductReviewRepository(AidrDbContext db) => _db = db;

    public Task<bool> ProductExistsAsync(Guid productId, CancellationToken cancellationToken = default)
        => _db.Products.AsNoTracking().AnyAsync(p => p.ProductId == productId, cancellationToken);

    public async Task<(decimal AvgRating, int ReviewCount)> GetProductRatingStatsAsync(
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        var product = await _db.Products.AsNoTracking()
            .Where(p => p.ProductId == productId)
            .Select(p => new { p.AvgRating, p.ReviewCount })
            .FirstOrDefaultAsync(cancellationToken);

        return product is null ? (0, 0) : (product.AvgRating, product.ReviewCount);
    }

    public async Task<ProductReviewListResult> ListVisibleAsync(
        Guid productId,
        int? ratingFilter,
        int page,
        int pageSize,
        Guid? viewerUserId,
        CancellationToken cancellationToken = default)
    {
        var stats = await GetProductRatingStatsAsync(productId, cancellationToken);

        var ratingBuckets = await _db.ProductReviews.AsNoTracking()
            .Where(r => r.ProductId == productId && r.IsVisible)
            .GroupBy(r => r.Rating)
            .Select(g => new { Rating = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var ratingBreakdown = new int[5];
        foreach (var bucket in ratingBuckets)
        {
            if (bucket.Rating is >= 1 and <= 5)
                ratingBreakdown[bucket.Rating - 1] = bucket.Count;
        }

        var query = _db.ProductReviews.AsNoTracking()
            .Where(r => r.ProductId == productId && r.IsVisible);

        if (ratingFilter is not null)
            query = query.Where(r => r.Rating == ratingFilter.Value);

        var totalCount = await query.CountAsync(cancellationToken);

        var rows = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new
            {
                r.ReviewId,
                r.ProductId,
                r.BuyerUserId,
                r.OrderId,
                r.Rating,
                r.Title,
                r.Content,
                r.SentimentLabel,
                r.SentimentScore,
                BuyerName = r.Buyer.FullName,
                BuyerAvatarUrl = r.Buyer.AvatarUrl,
                r.IsVisible,
                r.CreatedAt,
                r.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        var items = rows.Select(r =>
        {
            var isOwn = viewerUserId is not null && viewerUserId == r.BuyerUserId;
            var canEdit = isOwn
                && r.IsVisible
                && now <= r.CreatedAt.AddDays(ReviewConstants.EditWindowDays);

            return new ProductReviewDto
            {
                ReviewId = r.ReviewId,
                ProductId = r.ProductId,
                BuyerUserId = r.BuyerUserId,
                OrderId = r.OrderId,
                Rating = r.Rating,
                Title = r.Title,
                Content = r.Content,
                SentimentLabel = r.SentimentLabel,
                SentimentScore = r.SentimentScore,
                BuyerName = MaskBuyerName(r.BuyerName),
                BuyerAvatarUrl = r.BuyerAvatarUrl,
                IsVisible = r.IsVisible,
                IsOwn = isOwn,
                CanEdit = canEdit,
                CreatedAt = r.CreatedAt,
                UpdatedAt = r.UpdatedAt
            };
        }).ToList();

        return new ProductReviewListResult
        {
            ProductId = productId,
            AvgRating = stats.AvgRating,
            ReviewCount = ratingBreakdown.Sum() > 0 ? ratingBreakdown.Sum() : stats.ReviewCount,
            RatingBreakdown = ratingBreakdown,
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<EligibleOrderSnapshot?> GetEligibleOrderForProductAsync(
        Guid userId,
        Guid productId,
        Guid orderId,
        CancellationToken cancellationToken = default)
    {
        return await _db.Orders.AsNoTracking()
            .Where(o => o.OrderId == orderId && o.BuyerUserId == userId)
            .Select(o => new EligibleOrderSnapshot
            {
                OrderId = o.OrderId,
                BuyerUserId = o.BuyerUserId,
                ShopId = o.ShopId,
                Status = o.Status,
                ContainsProduct = o.Items.Any(i => i.ProductId == productId)
            })
            .FirstOrDefaultAsync(cancellationToken);
    }

    public Task<bool> ReviewExistsAsync(
        Guid userId,
        Guid productId,
        Guid orderId,
        CancellationToken cancellationToken = default)
        => _db.ProductReviews.AnyAsync(
            r => r.BuyerUserId == userId && r.ProductId == productId && r.OrderId == orderId,
            cancellationToken);

    public async Task<ProductReviewDto> CreateAsync(
        Guid userId,
        Guid productId,
        Guid orderId,
        byte rating,
        string? title,
        string content,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var entity = new ProductReview
        {
            ReviewId = Guid.NewGuid(),
            ProductId = productId,
            BuyerUserId = userId,
            OrderId = orderId,
            Rating = rating,
            Title = title,
            Content = content,
            IsVisible = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.ProductReviews.Add(entity);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            throw new ConflictException("You have already reviewed this product for this order.");
        }

        await RecalculateProductRatingAsync(productId, cancellationToken);
        return await MapOwnedAsync(entity.ReviewId, userId, cancellationToken)
            ?? throw new NotFoundException("Review not found.");
    }

    public Task<ProductReviewDto?> GetOwnedAsync(
        Guid userId,
        Guid reviewId,
        CancellationToken cancellationToken = default)
        => MapOwnedAsync(reviewId, userId, cancellationToken);

    public async Task<ProductReviewDto> UpdateAsync(
        Guid reviewId,
        byte rating,
        string? title,
        string content,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.ProductReviews
            .FirstOrDefaultAsync(r => r.ReviewId == reviewId, cancellationToken)
            ?? throw new NotFoundException("Review not found.");

        entity.Rating = rating;
        entity.Title = title;
        entity.Content = content;
        entity.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
        await RecalculateProductRatingAsync(entity.ProductId, cancellationToken);

        return await MapOwnedAsync(reviewId, entity.BuyerUserId, cancellationToken)
            ?? throw new NotFoundException("Review not found.");
    }

    public async Task HideAsync(Guid reviewId, CancellationToken cancellationToken = default)
    {
        var entity = await _db.ProductReviews
            .FirstOrDefaultAsync(r => r.ReviewId == reviewId, cancellationToken)
            ?? throw new NotFoundException("Review not found.");

        entity.IsVisible = false;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await RecalculateProductRatingAsync(entity.ProductId, cancellationToken);
    }

    private async Task RecalculateProductRatingAsync(Guid productId, CancellationToken cancellationToken)
    {
        var product = await _db.Products
            .FirstOrDefaultAsync(p => p.ProductId == productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        var visible = await _db.ProductReviews
            .Where(r => r.ProductId == productId && r.IsVisible)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Count = g.Count(),
                Avg = g.Average(r => (decimal)r.Rating)
            })
            .FirstOrDefaultAsync(cancellationToken);

        product.ReviewCount = visible?.Count ?? 0;
        product.AvgRating = visible is null
            ? 0
            : decimal.Round(visible.Avg, 2, MidpointRounding.AwayFromZero);
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<ProductReviewDto?> MapOwnedAsync(
        Guid reviewId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var row = await _db.ProductReviews.AsNoTracking()
            .Where(r => r.ReviewId == reviewId && r.BuyerUserId == userId)
            .Select(r => new
            {
                r.ReviewId,
                r.ProductId,
                r.BuyerUserId,
                r.OrderId,
                r.Rating,
                r.Title,
                r.Content,
                r.SentimentLabel,
                r.SentimentScore,
                BuyerName = r.Buyer.FullName,
                BuyerAvatarUrl = r.Buyer.AvatarUrl,
                r.IsVisible,
                r.CreatedAt,
                r.UpdatedAt
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (row is null)
            return null;

        var canEdit = row.IsVisible
            && DateTime.UtcNow <= row.CreatedAt.AddDays(ReviewConstants.EditWindowDays);

        return new ProductReviewDto
        {
            ReviewId = row.ReviewId,
            ProductId = row.ProductId,
            BuyerUserId = row.BuyerUserId,
            OrderId = row.OrderId,
            Rating = row.Rating,
            Title = row.Title,
            Content = row.Content,
            SentimentLabel = row.SentimentLabel,
            SentimentScore = row.SentimentScore,
            BuyerName = MaskBuyerName(row.BuyerName),
            BuyerAvatarUrl = row.BuyerAvatarUrl,
            IsVisible = row.IsVisible,
            IsOwn = true,
            CanEdit = canEdit,
            CreatedAt = row.CreatedAt,
            UpdatedAt = row.UpdatedAt
        };
    }

    private static string MaskBuyerName(string fullName)
    {
        var name = (fullName ?? string.Empty).Trim();
        if (name.Length <= 1)
            return name.Length == 0 ? "Buyer" : name;

        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 1)
            return parts[0][0] + new string('*', Math.Max(1, parts[0].Length - 1));

        return string.Join(' ', parts.Select((part, index) =>
            index == parts.Length - 1
                ? part
                : part[0] + "."));
    }
}

public sealed class SellerRatingRepository : ISellerRatingRepository
{
    private readonly AidrDbContext _db;

    public SellerRatingRepository(AidrDbContext db) => _db = db;

    public Task<ShopRatingTarget?> GetShopAsync(Guid shopId, CancellationToken cancellationToken = default)
        => _db.Shops.AsNoTracking()
            .Where(s => s.ShopId == shopId)
            .Select(s => new ShopRatingTarget
            {
                ShopId = s.ShopId,
                ShopName = s.ShopName,
                Slug = s.Slug,
                Status = s.Status
            })
            .FirstOrDefaultAsync(cancellationToken);

    public Task<EligibleOrderSnapshot?> GetEligibleOrderForShopAsync(
        Guid userId,
        Guid shopId,
        Guid orderId,
        CancellationToken cancellationToken = default)
        => _db.Orders.AsNoTracking()
            .Where(o => o.OrderId == orderId && o.BuyerUserId == userId && o.ShopId == shopId)
            .Select(o => new EligibleOrderSnapshot
            {
                OrderId = o.OrderId,
                BuyerUserId = o.BuyerUserId,
                ShopId = o.ShopId,
                Status = o.Status,
                ContainsProduct = true
            })
            .FirstOrDefaultAsync(cancellationToken);

    public Task<bool> RatingExistsAsync(
        Guid userId,
        Guid shopId,
        Guid orderId,
        CancellationToken cancellationToken = default)
        => _db.SellerRatings.AnyAsync(
            r => r.BuyerUserId == userId && r.ShopId == shopId && r.OrderId == orderId,
            cancellationToken);

    public async Task<SellerRatingDto> CreateAsync(
        Guid userId,
        Guid shopId,
        Guid orderId,
        byte score,
        string? comment,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var entity = new SellerRating
        {
            SellerRatingId = Guid.NewGuid(),
            ShopId = shopId,
            BuyerUserId = userId,
            OrderId = orderId,
            Score = score,
            Comment = comment,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.SellerRatings.Add(entity);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            throw new ConflictException("You have already rated this shop for this order.");
        }

        await RecalculateShopRatingAsync(shopId, cancellationToken);

        var shop = await _db.Shops.AsNoTracking()
            .Where(s => s.ShopId == shopId)
            .Select(s => new { s.ShopName, s.Slug, s.AvgRating, s.RatingCount })
            .FirstAsync(cancellationToken);

        return new SellerRatingDto
        {
            SellerRatingId = entity.SellerRatingId,
            ShopId = shopId,
            ShopName = shop.ShopName,
            ShopSlug = shop.Slug,
            BuyerUserId = userId,
            OrderId = orderId,
            Score = score,
            Comment = comment,
            ShopAvgRating = shop.AvgRating,
            ShopRatingCount = shop.RatingCount,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt
        };
    }

    private async Task RecalculateShopRatingAsync(Guid shopId, CancellationToken cancellationToken)
    {
        var shop = await _db.Shops
            .FirstOrDefaultAsync(s => s.ShopId == shopId, cancellationToken)
            ?? throw new NotFoundException("Shop not found.");

        var stats = await _db.SellerRatings
            .Where(r => r.ShopId == shopId)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Count = g.Count(),
                Avg = g.Average(r => (decimal)r.Score)
            })
            .FirstOrDefaultAsync(cancellationToken);

        shop.RatingCount = stats?.Count ?? 0;
        shop.AvgRating = stats is null
            ? 0
            : decimal.Round(stats.Avg, 2, MidpointRounding.AwayFromZero);
        shop.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }
}
