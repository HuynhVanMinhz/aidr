using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Caching;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Engagement.Services;

public sealed class ProductReviewService : IProductReviewService
{
    private readonly IProductReviewRepository _reviews;
    private readonly ICacheService _cache;
    private readonly IReviewDigestService _reviewDigest;

    public ProductReviewService(
        IProductReviewRepository reviews,
        ICacheService cache,
        IReviewDigestService reviewDigest)
    {
        _reviews = reviews;
        _cache = cache;
        _reviewDigest = reviewDigest;
    }

    public async Task<ProductReviewListResult> ListAsync(
        Guid productId,
        ProductReviewListQuery query,
        Guid? viewerUserId,
        CancellationToken cancellationToken = default)
    {
        if (productId == Guid.Empty)
            throw new AppException("Product id is required.");

        if (!await _reviews.ProductExistsAsync(productId, cancellationToken))
            throw new NotFoundException("Product not found.");

        if (query.Rating is not null
            && (query.Rating < ReviewConstants.MinRating || query.Rating > ReviewConstants.MaxRating))
            throw new AppException($"Rating filter must be between {ReviewConstants.MinRating} and {ReviewConstants.MaxRating}.");

        var (page, pageSize) = ReviewConstants.NormalizePaging(query.Page, query.PageSize);
        return await _reviews.ListVisibleAsync(
            productId,
            query.Rating,
            page,
            pageSize,
            viewerUserId,
            cancellationToken);
    }

    public async Task<ProductReviewDto> CreateAsync(
        Guid userId,
        Guid productId,
        CreateProductReviewRequest request,
        CancellationToken cancellationToken = default)
    {
        if (productId == Guid.Empty)
            throw new AppException("Product id is required.");

        if (request.OrderId == Guid.Empty)
            throw new AppException("Order id is required.");

        ValidateRatingAndContent(request.Rating, request.Title, request.Content, out var title, out var content);

        if (!await _reviews.ProductExistsAsync(productId, cancellationToken))
            throw new NotFoundException("Product not found.");

        var order = await _reviews.GetEligibleOrderForProductAsync(
            userId,
            productId,
            request.OrderId,
            cancellationToken)
            ?? throw new NotFoundException("Order not found.");

        EnsureCompletedPurchase(order, requireProduct: true);

        if (await _reviews.ReviewExistsAsync(userId, productId, request.OrderId, cancellationToken))
            throw new ConflictException("You have already reviewed this product for this order.");

        var sinceDay = DateTime.UtcNow.AddHours(-24);
        var recentCount = await _reviews.CountBuyerReviewsSinceAsync(userId, sinceDay, cancellationToken);
        if (recentCount >= ReviewConstants.MaxReviewsPerBuyerPerDay)
            throw new AppException(
                $"You can submit at most {ReviewConstants.MaxReviewsPerBuyerPerDay} reviews per day.");

        if (request.Rating <= ReviewConstants.LowRatingThreshold)
        {
            var sinceLow = DateTime.UtcNow.AddDays(-ReviewConstants.LowRatingWindowDays);
            var lowCount = await _reviews.CountBuyerLowRatingsForShopSinceAsync(
                userId,
                order.ShopId,
                ReviewConstants.LowRatingThreshold,
                sinceLow,
                cancellationToken);
            if (lowCount >= ReviewConstants.MaxLowRatingsPerShopPerWindow)
                throw new AppException(
                    $"You can submit at most {ReviewConstants.MaxLowRatingsPerShopPerWindow} low ratings for the same shop within {ReviewConstants.LowRatingWindowDays} days.");
        }

        var trust = await _reviews.GetBuyerTrustAsync(userId, cancellationToken)
            ?? throw new NotFoundException("User not found.");

        var outcome = ResolveCreateOutcome(trust, order);

        var created = await _reviews.CreateAsync(
            userId,
            productId,
            request.OrderId,
            request.Rating,
            title,
            content,
            outcome,
            cancellationToken);

        await InvalidateProductCacheAsync(productId, cancellationToken);
        await _reviewDigest.InvalidateAsync(productId, cancellationToken);
        return created;
    }

    public async Task<ProductReviewDto> UpdateAsync(
        Guid userId,
        Guid reviewId,
        UpdateProductReviewRequest request,
        CancellationToken cancellationToken = default)
    {
        if (reviewId == Guid.Empty)
            throw new AppException("Review id is required.");

        ValidateRatingAndContent(request.Rating, request.Title, request.Content, out var title, out var content);

        var existing = await _reviews.GetOwnedAsync(userId, reviewId, cancellationToken)
            ?? throw new NotFoundException("Review not found.");

        if (!existing.IsVisible)
            throw new ConflictException("Hidden reviews cannot be updated.");

        var editDeadline = existing.CreatedAt.AddDays(ReviewConstants.EditWindowDays);
        if (DateTime.UtcNow > editDeadline)
            throw new ConflictException(
                $"Reviews can only be edited within {ReviewConstants.EditWindowDays} days of posting.");

        var updated = await _reviews.UpdateAsync(reviewId, request.Rating, title, content, cancellationToken);
        await InvalidateProductCacheAsync(updated.ProductId, cancellationToken);
        await _reviewDigest.InvalidateAsync(updated.ProductId, cancellationToken);
        return updated;
    }

    public async Task DeleteAsync(
        Guid userId,
        Guid reviewId,
        CancellationToken cancellationToken = default)
    {
        if (reviewId == Guid.Empty)
            throw new AppException("Review id is required.");

        var existing = await _reviews.GetOwnedAsync(userId, reviewId, cancellationToken)
            ?? throw new NotFoundException("Review not found.");

        if (!existing.IsVisible)
            throw new ConflictException("Review is already hidden.");

        await _reviews.HideByOwnerAsync(reviewId, cancellationToken);
        await InvalidateProductCacheAsync(existing.ProductId, cancellationToken);
        await _reviewDigest.InvalidateAsync(existing.ProductId, cancellationToken);
    }

    public async Task<ProductReviewReportDto> ReportAsync(
        Guid userId,
        Guid reviewId,
        ReportProductReviewRequest request,
        CancellationToken cancellationToken = default)
    {
        if (reviewId == Guid.Empty)
            throw new AppException("Review id is required.");

        var reason = (request.Reason ?? string.Empty).Trim();
        if (!ReviewConstants.AllowedReportReasons.Contains(reason))
            throw new AppException("Invalid report reason.");

        var details = string.IsNullOrWhiteSpace(request.Details) ? null : request.Details.Trim();
        if (details is not null && details.Length > ReviewConstants.MaxReportDetailsLength)
            throw new AppException(
                $"Report details must not exceed {ReviewConstants.MaxReportDetailsLength} characters.");

        var shopOwnerId = await _reviews.GetShopOwnerUserIdForReviewAsync(reviewId, cancellationToken)
            ?? throw new NotFoundException("Review not found.");

        var isShopOwner = shopOwnerId == userId;

        var report = await _reviews.ReportAsync(
            reviewId,
            userId,
            reason,
            details,
            isShopOwner,
            cancellationToken);

        await InvalidateDigestForReviewAsync(reviewId, cancellationToken);
        return report;
    }

    public async Task<AdminReviewModerationListResult> ListModerationQueueAsync(
        AdminReviewModerationListQuery query,
        CancellationToken cancellationToken = default)
    {
        var status = string.IsNullOrWhiteSpace(query.Status)
            ? ReviewConstants.StatusReported
            : query.Status.Trim();

        if (!string.Equals(status, "all", StringComparison.OrdinalIgnoreCase)
            && !ReviewConstants.AdminQueueStatuses.Contains(status))
            throw new AppException("Status filter must be PendingTrust, Reported, or all.");

        var (page, pageSize) = ReviewConstants.NormalizeAdminPaging(query.Page, query.PageSize);
        return await _reviews.ListModerationQueueAsync(status, query.Q, page, pageSize, cancellationToken);
    }

    public async Task ApproveModerationAsync(
        Guid adminUserId,
        Guid reviewId,
        CancellationToken cancellationToken = default)
    {
        if (reviewId == Guid.Empty)
            throw new AppException("Review id is required.");

        await _reviews.ApproveModerationAsync(reviewId, adminUserId, cancellationToken);
        await InvalidateDigestForReviewAsync(reviewId, cancellationToken);
    }

    public async Task HideByAdminAsync(
        Guid adminUserId,
        Guid reviewId,
        CancellationToken cancellationToken = default)
    {
        if (reviewId == Guid.Empty)
            throw new AppException("Review id is required.");

        await _reviews.HideByAdminAsync(reviewId, adminUserId, cancellationToken);
        await InvalidateDigestForReviewAsync(reviewId, cancellationToken);
    }

    private static ReviewCreateOutcome ResolveCreateOutcome(BuyerTrustSnapshot trust, EligibleOrderSnapshot order)
    {
        var accountAgeDays = (DateTime.UtcNow - trust.CreatedAt).TotalDays;
        var needsTrustHold =
            accountAgeDays < ReviewConstants.TrustMinAccountAgeDays
            || trust.CompletedOrderCount < ReviewConstants.TrustMinCompletedOrders
            || order.TotalAmount < ReviewConstants.MinOrderTotalForFullWeight;

        if (!needsTrustHold)
        {
            return new ReviewCreateOutcome
            {
                CountsTowardRating = true,
                ModerationStatus = ReviewConstants.StatusApproved,
                TrustReleaseAt = null
            };
        }

        return new ReviewCreateOutcome
        {
            CountsTowardRating = false,
            ModerationStatus = ReviewConstants.StatusPendingTrust,
            TrustReleaseAt = DateTime.UtcNow.AddHours(ReviewConstants.TrustHoldHours)
        };
    }

    private async Task InvalidateDigestForReviewAsync(Guid reviewId, CancellationToken cancellationToken)
    {
        var productId = await _reviews.GetProductIdForReviewAsync(reviewId, cancellationToken);
        if (productId is null)
            return;

        await InvalidateProductCacheAsync(productId.Value, cancellationToken);
        await _reviewDigest.InvalidateAsync(productId.Value, cancellationToken);
    }

    private static void ValidateRatingAndContent(
        byte rating,
        string? title,
        string? content,
        out string? normalizedTitle,
        out string normalizedContent)
    {
        if (rating < ReviewConstants.MinRating || rating > ReviewConstants.MaxRating)
            throw new AppException($"Rating must be between {ReviewConstants.MinRating} and {ReviewConstants.MaxRating}.");

        normalizedContent = (content ?? string.Empty).Trim();
        if (normalizedContent.Length == 0)
            throw new AppException("Review content is required.");

        if (normalizedContent.Length > ReviewConstants.MaxContentLength)
            throw new AppException($"Review content must not exceed {ReviewConstants.MaxContentLength} characters.");

        normalizedTitle = string.IsNullOrWhiteSpace(title) ? null : title.Trim();
        if (normalizedTitle is not null && normalizedTitle.Length > ReviewConstants.MaxTitleLength)
            throw new AppException($"Review title must not exceed {ReviewConstants.MaxTitleLength} characters.");
    }

    private static void EnsureCompletedPurchase(EligibleOrderSnapshot order, bool requireProduct)
    {
        if (!string.Equals(order.Status, OrderConstants.StatusCompleted, StringComparison.OrdinalIgnoreCase))
            throw new AppException("You can only review products from completed orders.");

        if (requireProduct && !order.ContainsProduct)
            throw new AppException("This order does not include the product.");
    }

    private Task InvalidateProductCacheAsync(Guid productId, CancellationToken cancellationToken) =>
        _cache.RemoveAsync(SellerProductConstants.ProductDetailCacheKey(productId), cancellationToken);
}

public sealed class SellerRatingService : ISellerRatingService
{
    private readonly ISellerRatingRepository _ratings;
    private readonly ICacheService _cache;

    public SellerRatingService(ISellerRatingRepository ratings, ICacheService cache)
    {
        _ratings = ratings;
        _cache = cache;
    }

    public async Task<SellerRatingDto> CreateAsync(
        Guid userId,
        CreateSellerRatingRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.ShopId == Guid.Empty)
            throw new AppException("Shop id is required.");

        if (request.OrderId == Guid.Empty)
            throw new AppException("Order id is required.");

        if (request.Score < ReviewConstants.MinRating || request.Score > ReviewConstants.MaxRating)
            throw new AppException($"Score must be between {ReviewConstants.MinRating} and {ReviewConstants.MaxRating}.");

        var comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim();
        if (comment is not null && comment.Length > ReviewConstants.MaxSellerCommentLength)
            throw new AppException($"Comment must not exceed {ReviewConstants.MaxSellerCommentLength} characters.");

        var shop = await _ratings.GetShopAsync(request.ShopId, cancellationToken)
            ?? throw new NotFoundException("Shop not found.");

        if (!string.Equals(shop.Status, DiscoveryConstants.ActiveShopStatus, StringComparison.OrdinalIgnoreCase))
            throw new AppException("Shop is not available.");

        var order = await _ratings.GetEligibleOrderForShopAsync(
            userId,
            request.ShopId,
            request.OrderId,
            cancellationToken)
            ?? throw new NotFoundException("Order not found.");

        if (!string.Equals(order.Status, OrderConstants.StatusCompleted, StringComparison.OrdinalIgnoreCase))
            throw new AppException("You can only rate a seller after the order is completed.");

        if (await _ratings.RatingExistsAsync(userId, request.ShopId, request.OrderId, cancellationToken))
            throw new ConflictException("You have already rated this shop for this order.");

        var created = await _ratings.CreateAsync(
            userId,
            request.ShopId,
            request.OrderId,
            request.Score,
            comment,
            cancellationToken);

        await InvalidateShopRatingCacheAsync(shop.ShopId, shop.Slug, cancellationToken);
        return created;
    }

    private async Task InvalidateShopRatingCacheAsync(
        Guid shopId,
        string slug,
        CancellationToken cancellationToken)
    {
        await _cache.RemoveAsync($"shop:rating:{shopId:D}", cancellationToken);
        if (!string.IsNullOrWhiteSpace(slug))
            await _cache.RemoveAsync($"shop:rating:{slug.Trim().ToLowerInvariant()}", cancellationToken);
    }
}
