using AIDR.Shared.Dtos.Admin;
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

    Task<ProductReviewReportDto> ReportAsync(
        Guid userId,
        Guid reviewId,
        ReportProductReviewRequest request,
        CancellationToken cancellationToken = default);

    Task<AdminReviewModerationListResult> ListModerationQueueAsync(
        AdminReviewModerationListQuery query,
        CancellationToken cancellationToken = default);

    Task ApproveModerationAsync(
        Guid adminUserId,
        Guid reviewId,
        CancellationToken cancellationToken = default);

    Task HideByAdminAsync(
        Guid adminUserId,
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
