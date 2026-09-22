using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Admin;
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
        await PromoteExpiredTrustReviewsAsync(cancellationToken);

        var stats = await GetProductRatingStatsAsync(productId, cancellationToken);

        var ratingBuckets = await _db.ProductReviews.AsNoTracking()
            .Where(r => r.ProductId == productId && r.IsVisible && r.CountsTowardRating)
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
                r.CountsTowardRating,
                r.ModerationStatus,
                r.CreatedAt,
                r.UpdatedAt,
                HasOpenReportByViewer = viewerUserId != null
                    && r.Reports.Any(x =>
                        x.ReporterUserId == viewerUserId
                        && x.Status == ReviewConstants.ReportStatusOpen)
            })
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        var items = rows.Select(r =>
        {
            var isOwn = viewerUserId is not null && viewerUserId == r.BuyerUserId;
            var canEdit = isOwn
                && r.IsVisible
                && now <= r.CreatedAt.AddDays(ReviewConstants.EditWindowDays);
            var canReport = viewerUserId is not null
                && !isOwn
                && r.IsVisible
                && !r.HasOpenReportByViewer;

            return MapDto(
                r.ReviewId,
                r.ProductId,
                r.BuyerUserId,
                r.OrderId,
                r.Rating,
                r.Title,
                r.Content,
                r.SentimentLabel,
                r.SentimentScore,
                MaskBuyerName(r.BuyerName),
                r.BuyerAvatarUrl,
                r.IsVisible,
                r.CountsTowardRating,
                r.ModerationStatus,
                isOwn,
                canEdit,
                canReport,
                r.CreatedAt,
                r.UpdatedAt);
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
                ContainsProduct = o.Items.Any(i => i.ProductId == productId),
                TotalAmount = o.TotalAmount
            })
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<BuyerTrustSnapshot?> GetBuyerTrustAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.AsNoTracking()
            .Where(u => u.UserId == userId)
            .Select(u => new { u.UserId, u.CreatedAt })
            .FirstOrDefaultAsync(cancellationToken);

        if (user is null)
            return null;

        var completed = await _db.Orders.AsNoTracking()
            .CountAsync(
                o => o.BuyerUserId == userId
                    && o.Status == OrderConstants.StatusCompleted,
                cancellationToken);

        return new BuyerTrustSnapshot
        {
            UserId = user.UserId,
            CreatedAt = user.CreatedAt,
            CompletedOrderCount = completed
        };
    }

    public Task<int> CountBuyerReviewsSinceAsync(
        Guid userId,
        DateTime sinceUtc,
        CancellationToken cancellationToken = default)
        => _db.ProductReviews.AsNoTracking()
            .CountAsync(r => r.BuyerUserId == userId && r.CreatedAt >= sinceUtc, cancellationToken);

    public Task<int> CountBuyerLowRatingsForShopSinceAsync(
        Guid userId,
        Guid shopId,
        byte maxRatingInclusive,
        DateTime sinceUtc,
        CancellationToken cancellationToken = default)
        => _db.ProductReviews.AsNoTracking()
            .CountAsync(
                r => r.BuyerUserId == userId
                    && r.CreatedAt >= sinceUtc
                    && r.Rating <= maxRatingInclusive
                    && r.Order != null
                    && r.Order.ShopId == shopId,
                cancellationToken);

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
        ReviewCreateOutcome outcome,
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
            CountsTowardRating = outcome.CountsTowardRating,
            ModerationStatus = outcome.ModerationStatus,
            TrustReleaseAt = outcome.TrustReleaseAt,
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

    public async Task HideByOwnerAsync(Guid reviewId, CancellationToken cancellationToken = default)
    {
        var entity = await _db.ProductReviews
            .FirstOrDefaultAsync(r => r.ReviewId == reviewId, cancellationToken)
            ?? throw new NotFoundException("Review not found.");

        entity.IsVisible = false;
        entity.CountsTowardRating = false;
        entity.ModerationStatus = ReviewConstants.StatusHiddenByOwner;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        await RecalculateProductRatingAsync(entity.ProductId, cancellationToken);
    }

    public async Task PromoteExpiredTrustReviewsAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var due = await _db.ProductReviews
            .Where(r =>
                r.ModerationStatus == ReviewConstants.StatusPendingTrust
                && r.IsVisible
                && r.TrustReleaseAt != null
                && r.TrustReleaseAt <= now
                && !r.Reports.Any(x => x.Status == ReviewConstants.ReportStatusOpen))
            .ToListAsync(cancellationToken);

        if (due.Count == 0)
            return;

        var productIds = new HashSet<Guid>();
        foreach (var review in due)
        {
            review.CountsTowardRating = true;
            review.ModerationStatus = ReviewConstants.StatusApproved;
            review.TrustReleaseAt = null;
            review.UpdatedAt = now;
            productIds.Add(review.ProductId);
        }

        await _db.SaveChangesAsync(cancellationToken);
        foreach (var productId in productIds)
            await RecalculateProductRatingAsync(productId, cancellationToken);
    }

    public async Task<ProductReviewReportDto> ReportAsync(
        Guid reviewId,
        Guid reporterUserId,
        string reason,
        string? details,
        bool reporterIsShopOwner,
        CancellationToken cancellationToken = default)
    {
        _ = reporterIsShopOwner;

        var review = await _db.ProductReviews
            .FirstOrDefaultAsync(r => r.ReviewId == reviewId, cancellationToken)
            ?? throw new NotFoundException("Review not found.");

        if (!review.IsVisible)
            throw new ConflictException("Hidden reviews cannot be reported.");

        if (review.BuyerUserId == reporterUserId)
            throw new AppException("You cannot report your own review.");

        if (await HasOpenReportAsync(reviewId, reporterUserId, cancellationToken))
            throw new ConflictException("You already have an open report for this review.");

        var now = DateTime.UtcNow;
        var report = new ProductReviewReport
        {
            ReportId = Guid.NewGuid(),
            ReviewId = reviewId,
            ReporterUserId = reporterUserId,
            Reason = reason,
            Details = details,
            Status = ReviewConstants.ReportStatusOpen,
            CreatedAt = now
        };

        _db.ProductReviewReports.Add(report);

        var changedRating = false;
        if (review.CountsTowardRating
            || string.Equals(review.ModerationStatus, ReviewConstants.StatusApproved, StringComparison.OrdinalIgnoreCase)
            || string.Equals(review.ModerationStatus, ReviewConstants.StatusPendingTrust, StringComparison.OrdinalIgnoreCase))
        {
            if (review.CountsTowardRating)
                changedRating = true;

            review.CountsTowardRating = false;
            review.ModerationStatus = ReviewConstants.StatusReported;
            review.UpdatedAt = now;
        }

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            throw new ConflictException("You already have an open report for this review.");
        }

        if (changedRating)
            await RecalculateProductRatingAsync(review.ProductId, cancellationToken);

        return new ProductReviewReportDto
        {
            ReportId = report.ReportId,
            ReviewId = report.ReviewId,
            ReporterUserId = report.ReporterUserId,
            Reason = report.Reason,
            Details = report.Details,
            Status = report.Status,
            CreatedAt = report.CreatedAt
        };
    }

    public Task<bool> HasOpenReportAsync(
        Guid reviewId,
        Guid reporterUserId,
        CancellationToken cancellationToken = default)
        => _db.ProductReviewReports.AsNoTracking().AnyAsync(
            r => r.ReviewId == reviewId
                && r.ReporterUserId == reporterUserId
                && r.Status == ReviewConstants.ReportStatusOpen,
            cancellationToken);

    public Task<Guid?> GetShopOwnerUserIdForReviewAsync(
        Guid reviewId,
        CancellationToken cancellationToken = default)
        => _db.ProductReviews.AsNoTracking()
            .Where(r => r.ReviewId == reviewId)
            .Select(r => (Guid?)r.Product.Shop.OwnerUserId)
            .FirstOrDefaultAsync(cancellationToken);

    public Task<Guid?> GetProductIdForReviewAsync(
        Guid reviewId,
        CancellationToken cancellationToken = default)
        => _db.ProductReviews.AsNoTracking()
            .Where(r => r.ReviewId == reviewId)
            .Select(r => (Guid?)r.ProductId)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<AdminReviewModerationListResult> ListModerationQueueAsync(
        string? statusFilter,
        string? q,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        await PromoteExpiredTrustReviewsAsync(cancellationToken);

        var pendingTrustCount = await _db.ProductReviews.AsNoTracking()
            .CountAsync(r => r.ModerationStatus == ReviewConstants.StatusPendingTrust && r.IsVisible, cancellationToken);
        var reportedCount = await _db.ProductReviews.AsNoTracking()
            .CountAsync(r => r.ModerationStatus == ReviewConstants.StatusReported && r.IsVisible, cancellationToken);

        var query = _db.ProductReviews.AsNoTracking()
            .Where(r => r.IsVisible
                && (r.ModerationStatus == ReviewConstants.StatusPendingTrust
                    || r.ModerationStatus == ReviewConstants.StatusReported));

        if (!string.IsNullOrWhiteSpace(statusFilter)
            && !string.Equals(statusFilter, "all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(r => r.ModerationStatus == statusFilter);
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(r =>
                r.Content!.Contains(term)
                || (r.Title != null && r.Title.Contains(term))
                || r.Buyer.FullName.Contains(term)
                || r.Buyer.Email.Contains(term)
                || r.Product.Name.Contains(term)
                || r.Product.Shop.ShopName.Contains(term));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(r => r.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new AdminReviewModerationItemDto
            {
                ReviewId = r.ReviewId,
                ProductId = r.ProductId,
                ProductName = r.Product.Name,
                ShopId = r.Product.ShopId,
                ShopName = r.Product.Shop.ShopName,
                BuyerUserId = r.BuyerUserId,
                BuyerName = r.Buyer.FullName,
                BuyerEmail = r.Buyer.Email,
                Rating = r.Rating,
                Title = r.Title,
                Content = r.Content,
                ModerationStatus = r.ModerationStatus,
                CountsTowardRating = r.CountsTowardRating,
                IsVisible = r.IsVisible,
                OpenReportCount = r.Reports.Count(x => x.Status == ReviewConstants.ReportStatusOpen),
                LatestReportReason = r.Reports
                    .Where(x => x.Status == ReviewConstants.ReportStatusOpen)
                    .OrderByDescending(x => x.CreatedAt)
                    .Select(x => x.Reason)
                    .FirstOrDefault(),
                LatestReportDetails = r.Reports
                    .Where(x => x.Status == ReviewConstants.ReportStatusOpen)
                    .OrderByDescending(x => x.CreatedAt)
                    .Select(x => x.Details)
                    .FirstOrDefault(),
                LatestReporterUserId = r.Reports
                    .Where(x => x.Status == ReviewConstants.ReportStatusOpen)
                    .OrderByDescending(x => x.CreatedAt)
                    .Select(x => (Guid?)x.ReporterUserId)
                    .FirstOrDefault(),
                LatestReporterName = r.Reports
                    .Where(x => x.Status == ReviewConstants.ReportStatusOpen)
                    .OrderByDescending(x => x.CreatedAt)
                    .Select(x => x.Reporter.FullName)
                    .FirstOrDefault(),
                LatestReporterEmail = r.Reports
                    .Where(x => x.Status == ReviewConstants.ReportStatusOpen)
                    .OrderByDescending(x => x.CreatedAt)
                    .Select(x => x.Reporter.Email)
                    .FirstOrDefault(),
                LatestReporterIsShopOwner = r.Reports
                    .Where(x => x.Status == ReviewConstants.ReportStatusOpen)
                    .OrderByDescending(x => x.CreatedAt)
                    .Select(x => x.ReporterUserId == r.Product.Shop.OwnerUserId)
                    .FirstOrDefault(),
                CreatedAt = r.CreatedAt,
                TrustReleaseAt = r.TrustReleaseAt
            })
            .ToListAsync(cancellationToken);

        return new AdminReviewModerationListResult
        {
            Summary = new AdminReviewModerationListSummary
            {
                PendingTrustCount = pendingTrustCount,
                ReportedCount = reportedCount
            },
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task ApproveModerationAsync(
        Guid reviewId,
        Guid adminUserId,
        CancellationToken cancellationToken = default)
    {
        var review = await _db.ProductReviews
            .Include(r => r.Reports)
            .FirstOrDefaultAsync(r => r.ReviewId == reviewId, cancellationToken)
            ?? throw new NotFoundException("Review not found.");

        if (!review.IsVisible)
            throw new ConflictException("Hidden reviews cannot be approved.");

        var now = DateTime.UtcNow;
        review.CountsTowardRating = true;
        review.ModerationStatus = ReviewConstants.StatusApproved;
        review.TrustReleaseAt = null;
        review.UpdatedAt = now;

        foreach (var report in review.Reports.Where(x => x.Status == ReviewConstants.ReportStatusOpen))
        {
            report.Status = ReviewConstants.ReportStatusDismissed;
            report.ResolvedAt = now;
            report.ResolvedBy = adminUserId;
        }

        await _db.SaveChangesAsync(cancellationToken);
        await RecalculateProductRatingAsync(review.ProductId, cancellationToken);
    }

    public async Task HideByAdminAsync(
        Guid reviewId,
        Guid adminUserId,
        CancellationToken cancellationToken = default)
    {
        var review = await _db.ProductReviews
            .Include(r => r.Reports)
            .FirstOrDefaultAsync(r => r.ReviewId == reviewId, cancellationToken)
            ?? throw new NotFoundException("Review not found.");

        var now = DateTime.UtcNow;
        review.IsVisible = false;
        review.CountsTowardRating = false;
        review.ModerationStatus = ReviewConstants.StatusHiddenByAdmin;
        review.TrustReleaseAt = null;
        review.UpdatedAt = now;

        foreach (var report in review.Reports.Where(x => x.Status == ReviewConstants.ReportStatusOpen))
        {
            report.Status = ReviewConstants.ReportStatusUpheld;
            report.ResolvedAt = now;
            report.ResolvedBy = adminUserId;
        }

        await _db.SaveChangesAsync(cancellationToken);
        await RecalculateProductRatingAsync(review.ProductId, cancellationToken);
    }

    private async Task RecalculateProductRatingAsync(Guid productId, CancellationToken cancellationToken)
    {
        var product = await _db.Products
            .FirstOrDefaultAsync(p => p.ProductId == productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        var visible = await _db.ProductReviews
            .Where(r => r.ProductId == productId && r.IsVisible && r.CountsTowardRating)
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
                r.CountsTowardRating,
                r.ModerationStatus,
                r.CreatedAt,
                r.UpdatedAt
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (row is null)
            return null;

        var canEdit = row.IsVisible
            && DateTime.UtcNow <= row.CreatedAt.AddDays(ReviewConstants.EditWindowDays);

        return MapDto(
            row.ReviewId,
            row.ProductId,
            row.BuyerUserId,
            row.OrderId,
            row.Rating,
            row.Title,
            row.Content,
            row.SentimentLabel,
            row.SentimentScore,
            MaskBuyerName(row.BuyerName),
            row.BuyerAvatarUrl,
            row.IsVisible,
            row.CountsTowardRating,
            row.ModerationStatus,
            isOwn: true,
            canEdit,
            canReport: false,
            row.CreatedAt,
            row.UpdatedAt);
    }

    private static ProductReviewDto MapDto(
        Guid reviewId,
        Guid productId,
        Guid buyerUserId,
        Guid? orderId,
        byte rating,
        string? title,
        string? content,
        string? sentimentLabel,
        decimal? sentimentScore,
        string buyerName,
        string? buyerAvatarUrl,
        bool isVisible,
        bool countsTowardRating,
        string moderationStatus,
        bool isOwn,
        bool canEdit,
        bool canReport,
        DateTime createdAt,
        DateTime updatedAt)
        => new()
        {
            ReviewId = reviewId,
            ProductId = productId,
            BuyerUserId = buyerUserId,
            OrderId = orderId,
            Rating = rating,
            Title = title,
            Content = content,
            SentimentLabel = sentimentLabel,
            SentimentScore = sentimentScore,
            BuyerName = buyerName,
            BuyerAvatarUrl = buyerAvatarUrl,
            IsVisible = isVisible,
            CountsTowardRating = countsTowardRating,
            ModerationStatus = moderationStatus,
            IsOwn = isOwn,
            CanEdit = canEdit,
            CanReport = canReport,
            CreatedAt = createdAt,
            UpdatedAt = updatedAt
        };

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
                ContainsProduct = true,
                TotalAmount = o.TotalAmount
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
