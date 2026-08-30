namespace AIDR.Shared.Dtos.Kyc;

public sealed class KycVerifyRequest
{
    public string FrontImageUrl { get; set; } = null!;
    public string? BackImageUrl { get; set; }
    public string SelfieImageUrl { get; set; } = null!;
}

public sealed class KycVerificationDto
{
    public Guid KycVerificationId { get; init; }
    public string Provider { get; init; } = null!;
    public string Status { get; init; } = null!;
    public string? DocumentType { get; init; }
    /// <summary>Masked — the full number never leaves the server.</summary>
    public string? DocumentNumberMask { get; init; }
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
    public string? FailureReason { get; init; }
    public bool IsMock { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? VerifiedAt { get; init; }

    /// <summary>Passed or ManualReview — enough to submit a seller application.</summary>
    public bool CanStartSellerApplication =>
        Status is "Passed" or "ManualReview";
}
