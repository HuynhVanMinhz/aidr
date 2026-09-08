using AIDR.Shared.Dtos.Kyc;

namespace AIDR.Modules.Kyc.Abstractions;

public sealed class DuplicateApprovedSellerMatch
{
    public Guid UserId { get; init; }
    public string UserEmail { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
}

public interface IKycRepository
{
    Task<KycVerificationDto?> GetLatestForUserAsync(Guid userId, CancellationToken ct = default);

    Task<int> CountAttemptsSinceAsync(Guid userId, DateTime sinceUtc, CancellationToken ct = default);

    /// <summary>True when another user already passed KYC with this identity.</summary>
    Task<bool> DocumentUsedByAnotherUserAsync(
        string documentNumberHash,
        Guid userId,
        CancellationToken ct = default);

    Task<DuplicateApprovedSellerMatch?> FindDuplicateApprovedSellerAsync(
        string documentNumberHash,
        Guid userId,
        CancellationToken ct = default);

    Task<DuplicateApprovedSellerMatch?> FindDuplicateApprovedSellerForVerificationAsync(
        Guid kycVerificationId,
        Guid userId,
        CancellationToken ct = default);

    Task<KycVerificationDto> SaveAsync(KycVerificationRecord record, CancellationToken ct = default);

    Task<KycVerificationDto?> GetByIdAsync(Guid kycVerificationId, CancellationToken ct = default);
}

/// <summary>Write model for a completed verification attempt.</summary>
public sealed class KycVerificationRecord
{
    public required Guid UserId { get; init; }
    public string Provider { get; init; } = "GEMINI";
    public string? DocumentType { get; init; }
    public string? DocumentNumberMask { get; init; }
    public string? DocumentNumberHash { get; init; }
    public string? FullName { get; init; }
    public string? DateOfBirth { get; init; }
    public string? Gender { get; init; }
    public string? HomeTown { get; init; }
    public string? PermanentAddress { get; init; }
    public string? IssueDate { get; init; }
    public string? ExpiryDate { get; init; }
    public string? FrontImageUrl { get; init; }
    public string? BackImageUrl { get; init; }
    public string? SelfieImageUrl { get; init; }
    public decimal? FaceMatchSimilarity { get; init; }
    public bool FaceMatched { get; init; }
    public required string Status { get; init; }
    public string? FailureReason { get; init; }
    public string? RawOcrJson { get; init; }
    public string? RawFaceJson { get; init; }
}

public interface IKycService
{
    Task<KycVerificationDto?> GetMineAsync(Guid userId, CancellationToken ct = default);

    Task<KycVerificationDto> VerifyAsync(
        Guid userId,
        KycVerifyRequest request,
        CancellationToken ct = default);
}
