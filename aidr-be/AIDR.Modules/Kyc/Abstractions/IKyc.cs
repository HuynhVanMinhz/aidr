using AIDR.Shared.Dtos.Kyc;

namespace AIDR.Modules.Kyc.Abstractions;

public sealed class FptAiOptions
{
    public const string SectionName = "FptAi";

    public string BaseUrl { get; set; } = "https://api.fpt.ai";
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Skip the live API and return a canned pass. Development only — startup
    /// refuses to boot with this on outside Development, because a fake identity
    /// check that looks real is worse than none at all.
    /// </summary>
    public bool UseMock { get; set; }

    /// <summary>Face similarity at or above this passes automatically.</summary>
    public decimal FaceMatchThreshold { get; set; } = 0.80m;

    /// <summary>Between this and the pass threshold, a human decides.</summary>
    public decimal ManualReviewThreshold { get; set; } = 0.60m;

    public int MaxAttemptsPerDay { get; set; } = 5;
    public int TimeoutSeconds { get; set; } = 30;

    /// <summary>
    /// Hosts the server will fetch images from. Without this the endpoint becomes
    /// an SSRF proxy into the internal network.
    /// </summary>
    public string[] AllowedImageHosts { get; set; } = ["res.cloudinary.com"];

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);
}

/// <summary>Fields FPT.AI reads off a Vietnamese ID card.</summary>
public sealed record IdCardOcrResult
{
    public string? DocumentNumber { get; init; }
    public string? DocumentType { get; init; }
    public string? FullName { get; init; }
    public string? DateOfBirth { get; init; }
    public string? Gender { get; init; }
    public string? HomeTown { get; init; }
    public string? PermanentAddress { get; init; }
    public string? IssueDate { get; init; }
    public string? IssuePlace { get; init; }
    public string? ExpiryDate { get; init; }
    public string? RawJson { get; init; }
    public bool IsMock { get; init; }
}

public sealed class FaceMatchResult
{
    public bool IsMatch { get; init; }
    public decimal Similarity { get; init; }
    public string? RawJson { get; init; }
    public bool IsMock { get; init; }
}

public interface IFptAiEkycClient
{
    bool UseMock { get; }
    bool IsConfigured { get; }

    /// <summary>
    /// Read a Vietnamese ID card. The back is optional; it only adds the issue
    /// date and place, which are not present on the front.
    /// </summary>
    Task<IdCardOcrResult> ReadIdCardAsync(
        string frontImageUrl,
        string? backImageUrl = null,
        CancellationToken ct = default);

    Task<FaceMatchResult> MatchFaceAsync(
        string idCardImageUrl,
        string selfieImageUrl,
        CancellationToken ct = default);
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

    Task<KycVerificationDto> SaveAsync(KycVerificationRecord record, CancellationToken ct = default);

    Task<KycVerificationDto?> GetByIdAsync(Guid kycVerificationId, CancellationToken ct = default);
}

/// <summary>Write model for a completed verification attempt.</summary>
public sealed class KycVerificationRecord
{
    public required Guid UserId { get; init; }
    public string Provider { get; init; } = "FPTAI";
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
