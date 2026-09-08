using AIDR.Infrastructure.Persistence;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Dtos.Engagement;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Engagement;

public sealed class ReviewDigestRepository : IReviewDigestRepository
{
    private readonly AidrDbContext _db;

    public ReviewDigestRepository(AidrDbContext db) => _db = db;

    public Task<bool> ProductExistsAsync(Guid productId, CancellationToken cancellationToken = default)
        => _db.Products.AsNoTracking().AnyAsync(p => p.ProductId == productId, cancellationToken);

    public Task<int> GetVisibleReviewCountAsync(Guid productId, CancellationToken cancellationToken = default)
        => _db.ProductReviews.AsNoTracking()
            .CountAsync(r => r.ProductId == productId && r.IsVisible, cancellationToken);

    public async Task<IReadOnlyList<ReviewDigestReviewRecord>> GetVisibleReviewsForDigestAsync(
        Guid productId,
        int maxCount,
        CancellationToken cancellationToken = default)
    {
        maxCount = Math.Clamp(maxCount, 1, 100);

        return await _db.ProductReviews.AsNoTracking()
            .Where(r => r.ProductId == productId && r.IsVisible)
            .OrderByDescending(r => r.CreatedAt)
            .Take(maxCount)
            .Select(r => new ReviewDigestReviewRecord
            {
                Rating = r.Rating,
                Title = r.Title,
                Content = r.Content ?? string.Empty,
                SentimentLabel = r.SentimentLabel
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<ReviewDigestSnapshotRecord?> GetSnapshotAsync(
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        return await _db.ProductReviewDigestSnapshots.AsNoTracking()
            .Where(s => s.ProductId == productId)
            .Select(s => new ReviewDigestSnapshotRecord
            {
                ProductId = s.ProductId,
                ReviewCount = s.ReviewCount,
                DigestJson = s.DigestJson,
                Source = s.Source,
                GeneratedAt = s.GeneratedAt
            })
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task UpsertSnapshotAsync(
        Guid productId,
        int reviewCount,
        string digestJson,
        string source,
        DateTime generatedAt,
        CancellationToken cancellationToken = default)
    {
        var existing = await _db.ProductReviewDigestSnapshots
            .FirstOrDefaultAsync(s => s.ProductId == productId, cancellationToken);

        if (existing is null)
        {
            _db.ProductReviewDigestSnapshots.Add(new Persistence.Entities.ProductReviewDigestSnapshot
            {
                ProductId = productId,
                ReviewCount = reviewCount,
                DigestJson = digestJson,
                Source = source,
                GeneratedAt = generatedAt
            });
        }
        else
        {
            existing.ReviewCount = reviewCount;
            existing.DigestJson = digestJson;
            existing.Source = source;
            existing.GeneratedAt = generatedAt;
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteSnapshotAsync(Guid productId, CancellationToken cancellationToken = default)
    {
        var existing = await _db.ProductReviewDigestSnapshots
            .FirstOrDefaultAsync(s => s.ProductId == productId, cancellationToken);
        if (existing is null)
            return;

        _db.ProductReviewDigestSnapshots.Remove(existing);
        await _db.SaveChangesAsync(cancellationToken);
    }
}
