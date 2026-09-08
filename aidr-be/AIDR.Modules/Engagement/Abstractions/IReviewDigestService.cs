namespace AIDR.Modules.Engagement.Abstractions;

using AIDR.Shared.Dtos.Engagement;

public interface IReviewDigestService
{
    Task<ReviewDigestDto> GetDigestAsync(Guid productId, CancellationToken cancellationToken = default);
    Task InvalidateAsync(Guid productId, CancellationToken cancellationToken = default);
}

public interface IReviewDigestRepository
{
    Task<bool> ProductExistsAsync(Guid productId, CancellationToken cancellationToken = default);

    Task<int> GetVisibleReviewCountAsync(Guid productId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ReviewDigestReviewRecord>> GetVisibleReviewsForDigestAsync(
        Guid productId,
        int maxCount,
        CancellationToken cancellationToken = default);

    Task<ReviewDigestSnapshotRecord?> GetSnapshotAsync(
        Guid productId,
        CancellationToken cancellationToken = default);

    Task UpsertSnapshotAsync(
        Guid productId,
        int reviewCount,
        string digestJson,
        string source,
        DateTime generatedAt,
        CancellationToken cancellationToken = default);

    Task DeleteSnapshotAsync(Guid productId, CancellationToken cancellationToken = default);
}
