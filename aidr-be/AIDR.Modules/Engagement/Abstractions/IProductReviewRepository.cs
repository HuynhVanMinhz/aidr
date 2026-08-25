using AIDR.Shared.Dtos.Engagement;

namespace AIDR.Modules.Engagement.Abstractions;

public sealed class EligibleOrderSnapshot
{
    public Guid OrderId { get; init; }
    public Guid BuyerUserId { get; init; }
    public Guid ShopId { get; init; }
    public string Status { get; init; } = null!;
    public bool ContainsProduct { get; init; }
}

public sealed class ShopRatingTarget
{
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string Status { get; init; } = null!;
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

    Task HideAsync(Guid reviewId, CancellationToken cancellationToken = default);
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
