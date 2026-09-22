using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Dtos.Engagement;

namespace AIDR.Modules.Engagement.Abstractions;

public sealed class EligibleOrderSnapshot
{
    public Guid OrderId { get; init; }
    public Guid BuyerUserId { get; init; }
    public Guid ShopId { get; init; }
    public string Status { get; init; } = null!;
    public bool ContainsProduct { get; init; }
    public decimal TotalAmount { get; init; }
}

public sealed class BuyerTrustSnapshot
{
    public Guid UserId { get; init; }
    public DateTime CreatedAt { get; init; }
    public int CompletedOrderCount { get; init; }
}

public sealed class ShopRatingTarget
{
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string Status { get; init; } = null!;
}

public sealed class ReviewCreateOutcome
{
    public bool CountsTowardRating { get; init; }
    public string ModerationStatus { get; init; } = null!;
    public DateTime? TrustReleaseAt { get; init; }
}

public interface IProductReviewRepository
{
    Task<bool> ProductExistsAsync(Guid productId, CancellationToken cancellationToken = default);

    Task<(decimal AvgRating, int ReviewCount)> GetProductRatingStatsAsync(
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<ProductReviewListResult> ListVisibleAsync(
        Guid productId,
        int? ratingFilter,
        int page,
        int pageSize,
        Guid? viewerUserId,
        CancellationToken cancellationToken = default);

    Task<EligibleOrderSnapshot?> GetEligibleOrderForProductAsync(
        Guid userId,
        Guid productId,
        Guid orderId,
        CancellationToken cancellationToken = default);

    Task<BuyerTrustSnapshot?> GetBuyerTrustAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<int> CountBuyerReviewsSinceAsync(
        Guid userId,
        DateTime sinceUtc,
        CancellationToken cancellationToken = default);

    Task<int> CountBuyerLowRatingsForShopSinceAsync(
        Guid userId,
        Guid shopId,
        byte maxRatingInclusive,
        DateTime sinceUtc,
        CancellationToken cancellationToken = default);

    Task<bool> ReviewExistsAsync(
        Guid userId,
        Guid productId,
        Guid orderId,
        CancellationToken cancellationToken = default);

    Task<ProductReviewDto> CreateAsync(
        Guid userId,
        Guid productId,
        Guid orderId,
        byte rating,
        string? title,
        string content,
        ReviewCreateOutcome outcome,
        CancellationToken cancellationToken = default);

    Task<ProductReviewDto?> GetOwnedAsync(
        Guid userId,
        Guid reviewId,
        CancellationToken cancellationToken = default);

    Task<ProductReviewDto> UpdateAsync(
        Guid reviewId,
        byte rating,
        string? title,
        string content,
        CancellationToken cancellationToken = default);

    Task HideByOwnerAsync(Guid reviewId, CancellationToken cancellationToken = default);

    Task PromoteExpiredTrustReviewsAsync(CancellationToken cancellationToken = default);

    Task<ProductReviewReportDto> ReportAsync(
        Guid reviewId,
        Guid reporterUserId,
        string reason,
        string? details,
        bool reporterIsShopOwner,
        CancellationToken cancellationToken = default);

    Task<bool> HasOpenReportAsync(
        Guid reviewId,
        Guid reporterUserId,
        CancellationToken cancellationToken = default);

    Task<Guid?> GetShopOwnerUserIdForReviewAsync(
        Guid reviewId,
        CancellationToken cancellationToken = default);

    Task<Guid?> GetProductIdForReviewAsync(
        Guid reviewId,
        CancellationToken cancellationToken = default);

    Task<AdminReviewModerationListResult> ListModerationQueueAsync(
        string? statusFilter,
        string? q,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task ApproveModerationAsync(Guid reviewId, Guid adminUserId, CancellationToken cancellationToken = default);

    Task HideByAdminAsync(Guid reviewId, Guid adminUserId, CancellationToken cancellationToken = default);
}

public interface ISellerRatingRepository
{
    Task<ShopRatingTarget?> GetShopAsync(Guid shopId, CancellationToken cancellationToken = default);

    Task<EligibleOrderSnapshot?> GetEligibleOrderForShopAsync(
        Guid userId,
        Guid shopId,
        Guid orderId,
        CancellationToken cancellationToken = default);

    Task<bool> RatingExistsAsync(
        Guid userId,
        Guid shopId,
        Guid orderId,
        CancellationToken cancellationToken = default);

    Task<SellerRatingDto> CreateAsync(
        Guid userId,
        Guid shopId,
        Guid orderId,
        byte score,
        string? comment,
        CancellationToken cancellationToken = default);
}
