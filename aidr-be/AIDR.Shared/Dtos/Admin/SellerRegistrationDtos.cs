using AIDR.Shared.Dtos.Kyc;

namespace AIDR.Shared.Dtos.Admin;

public sealed class AdminSellerRegistrationDto
{
    public Guid RequestId { get; init; }
    public Guid UserId { get; init; }
    public string UserEmail { get; init; } = null!;
    public string UserFullName { get; init; } = null!;
    public string ShopName { get; init; } = null!;
    public string? BusinessInfo { get; init; }
    public IReadOnlyList<string> DocumentUrls { get; init; } = Array.Empty<string>();
    public string Status { get; init; } = null!;
    public string? AdminNote { get; init; }
    public Guid? ReviewedBy { get; init; }
    public string? ReviewerFullName { get; init; }
    public DateTime? ReviewedAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public Guid? ShopId { get; init; }

    public string? BusinessType { get; init; }
    public string? TaxCode { get; init; }
    public string? BusinessAddress { get; init; }
    public string? ContactPhone { get; init; }
    public string? ContactEmail { get; init; }
    public string? LicenseImageUrl { get; init; }

    /// <summary>Identity check backing this application — reviewed side by side.</summary>
    /// <summary>
    /// Whether an identity check is attached at all. Present on the list too, so
    /// the queue can flag applications that predate eKYC without loading each one.
    /// </summary>
    public bool HasIdentityCheck { get; init; }

    /// <summary>
    /// False when the check belongs to the applicant but was completed after this
    /// application was submitted — the reviewer must be told the difference.
    /// </summary>
    public bool KycLinkedToApplication { get; init; }

    /// <summary>Status of that check, so the queue can show it without loading each row.</summary>
    public string? KycStatus { get; init; }

    public KycVerificationDto? Kyc { get; init; }
}

public sealed class AdminSellerRegistrationListResultDto
{
    public IReadOnlyList<AdminSellerRegistrationDto> Items { get; init; } =
        Array.Empty<AdminSellerRegistrationDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
    public int PendingCount { get; init; }
    public int ApprovedCount { get; init; }
    public int RejectedCount { get; init; }
}

public sealed class RejectSellerRegistrationRequest
{
    public string AdminNote { get; set; } = null!;
}

/// <summary>Send an application back for corrections instead of rejecting it.</summary>
public sealed class RequestMoreInfoRequest
{
    public string AdminNote { get; set; } = null!;
}

public sealed class ApproveSellerRegistrationResultDto
{
    public AdminSellerRegistrationDto Request { get; init; } = null!;
    public Guid ShopId { get; init; }
    public Guid WalletId { get; init; }
}
