using AIDR.Shared.Dtos.Engagement;

namespace AIDR.Modules.Engagement.Abstractions;

public interface IProductReviewService
{
    Task<ProductReviewListResult> ListAsync(
        Guid productId,
        ProductReviewListQuery query,
        Guid? viewerUserId,
        CancellationToken cancellationToken = default);

    Task<ProductReviewDto> CreateAsync(
        Guid userId,
        Guid productId,
        CreateProductReviewRequest request,
        CancellationToken cancellationToken = default);

    Task<ProductReviewDto> UpdateAsync(
        Guid userId,
        Guid reviewId,
        UpdateProductReviewRequest request,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(
        Guid userId,
        Guid reviewId,
        CancellationToken cancellationToken = default);
}

public interface ISellerRatingService
{
    Task<SellerRatingDto> CreateAsync(
        Guid userId,
        CreateSellerRatingRequest request,
        CancellationToken cancellationToken = default);
}
