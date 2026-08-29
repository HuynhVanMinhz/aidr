using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Kyc.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Kyc;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Kyc;

public sealed class KycRepository : IKycRepository
{
    private readonly AidrDbContext _db;

    public KycRepository(AidrDbContext db) => _db = db;

    public async Task<KycVerificationDto?> GetLatestForUserAsync(
        Guid userId,
        CancellationToken ct = default)
    {
        var entity = await _db.KycVerifications.AsNoTracking()
            .Where(k => k.UserId == userId)
            .OrderByDescending(k => k.CreatedAt)
            .FirstOrDefaultAsync(ct);

        return entity is null ? null : Map(entity);
    }

    public Task<int> CountAttemptsSinceAsync(Guid userId, DateTime sinceUtc, CancellationToken ct = default) =>
        _db.KycVerifications.AsNoTracking()
            .CountAsync(k => k.UserId == userId && k.CreatedAt >= sinceUtc, ct);

    public Task<bool> DocumentUsedByAnotherUserAsync(
        string documentNumberHash,
        Guid userId,
        CancellationToken ct = default) =>
        _db.KycVerifications.AsNoTracking()
            .AnyAsync(
                k => k.DocumentNumberHash == documentNumberHash
                     && k.UserId != userId
                     && k.Status == KycConstants.StatusPassed,
                ct);

    public async Task<KycVerificationDto> SaveAsync(
        KycVerificationRecord record,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var entity = new KycVerification
        {
            KycVerificationId = Guid.NewGuid(),
            UserId = record.UserId,
            Provider = record.Provider,
            DocumentType = record.DocumentType,
            DocumentNumberMask = record.DocumentNumberMask,
            DocumentNumberHash = record.DocumentNumberHash,
            FullName = record.FullName,
            DateOfBirth = record.DateOfBirth,
            Gender = record.Gender,
            HomeTown = record.HomeTown,
            PermanentAddress = record.PermanentAddress,
            IssueDate = record.IssueDate,
            ExpiryDate = record.ExpiryDate,
            FrontImageUrl = record.FrontImageUrl,
            BackImageUrl = record.BackImageUrl,
            SelfieImageUrl = record.SelfieImageUrl,
            FaceMatchSimilarity = record.FaceMatchSimilarity,
            FaceMatched = record.FaceMatched,
            Status = record.Status,
            FailureReason = record.FailureReason,
            RawOcrJson = record.RawOcrJson,
            RawFaceJson = record.RawFaceJson,
            CreatedAt = now,
            VerifiedAt = record.Status == KycConstants.StatusPending ? null : now,
        };

        _db.KycVerifications.Add(entity);
        await _db.SaveChangesAsync(ct);

        return Map(entity);
    }

    public async Task<KycVerificationDto?> GetByIdAsync(
        Guid kycVerificationId,
        CancellationToken ct = default)
    {
        var entity = await _db.KycVerifications.AsNoTracking()
            .FirstOrDefaultAsync(k => k.KycVerificationId == kycVerificationId, ct);

        return entity is null ? null : Map(entity);
    }

    internal static KycVerificationDto Map(KycVerification k) => new()
    {
        KycVerificationId = k.KycVerificationId,
        Provider = k.Provider,
        Status = k.Status,
        DocumentType = k.DocumentType,
        DocumentNumberMask = k.DocumentNumberMask,
        FullName = k.FullName,
        DateOfBirth = k.DateOfBirth,
        Gender = k.Gender,
        HomeTown = k.HomeTown,
        PermanentAddress = k.PermanentAddress,
        IssueDate = k.IssueDate,
        ExpiryDate = k.ExpiryDate,
        FrontImageUrl = k.FrontImageUrl,
        BackImageUrl = k.BackImageUrl,
        SelfieImageUrl = k.SelfieImageUrl,
        FaceMatchSimilarity = k.FaceMatchSimilarity,
        FaceMatched = k.FaceMatched,
        FailureReason = k.FailureReason,
        IsMock = string.Equals(k.Provider, KycConstants.ProviderMock, StringComparison.OrdinalIgnoreCase),
        CreatedAt = k.CreatedAt,
        VerifiedAt = k.VerifiedAt,
    };
}
