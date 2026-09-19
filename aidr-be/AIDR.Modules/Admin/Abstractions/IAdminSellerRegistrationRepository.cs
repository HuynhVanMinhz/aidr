namespace AIDR.Modules.Admin.Abstractions;

public sealed class AdminSellerRegistrationRecord
{
    public Guid RequestId { get; init; }
    public Guid UserId { get; init; }
    public string UserEmail { get; init; } = null!;
    public string UserFullName { get; init; } = null!;
    public string ShopName { get; init; } = null!;
    public string? BusinessInfo { get; init; }
    public string? DocumentUrlsJson { get; init; }
    public string Status { get; init; } = null!;
    public string? AdminNote { get; init; }
    public Guid? ReviewedBy { get; init; }
    public string? ReviewerFullName { get; init; }
    public DateTime? ReviewedAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public Guid? ShopId { get; init; }

    /// <summary>The check this application was submitted with, if any.</summary>
    public Guid? KycVerificationId { get; init; }

    /// <summary>
    /// The applicant's most recent check, whichever application it came from.
    /// Identity belongs to the person, not to one submission - an application
    /// filed before the user verified would otherwise look unverified forever.
    /// </summary>
    public Guid? LatestKycVerificationId { get; init; }

    public string? LatestKycStatus { get; init; }
    public string? BusinessType { get; init; }
    public string? TaxCode { get; init; }
    public string? BusinessAddress { get; init; }
    public string? ContactPhone { get; init; }
    public string? ContactEmail { get; init; }
    public string? LicenseImageUrl { get; init; }
}

public sealed class ApproveSellerRegistrationResult
{
    public AdminSellerRegistrationRecord Request { get; init; } = null!;
    public Guid ShopId { get; init; }
    public Guid WalletId { get; init; }
}

public sealed class AdminSellerRegistrationListSummary
{
    public int PendingCount { get; init; }
    public int ApprovedCount { get; init; }
    public int RejectedCount { get; init; }
}

public interface IAdminSellerRegistrationRepository
{
    Task<(IReadOnlyList<AdminSellerRegistrationRecord> Items, int TotalCount, int Page, AdminSellerRegistrationListSummary Summary)>
        ListPagedAsync(
            string? status,
            string? keyword,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default);

    Task<AdminSellerRegistrationRecord?> GetByIdAsync(
        Guid requestId,
        CancellationToken cancellationToken = default);

    Task<ApproveSellerRegistrationResult> ApproveAsync(
        Guid requestId,
        Guid adminUserId,
        string shopSlug,
        string? shortDescription,
        CancellationToken cancellationToken = default);

    /// <summary>Send a thin application back to the applicant instead of rejecting it.</summary>
    Task<AdminSellerRegistrationRecord> RequestMoreInfoAsync(
        Guid requestId,
        Guid adminUserId,
        string adminNote,
        CancellationToken cancellationToken = default);

    Task<AdminSellerRegistrationRecord> RejectAsync(
        Guid requestId,
        Guid adminUserId,
        string adminNote,
        CancellationToken cancellationToken = default);

    Task<bool> SlugExistsAsync(string slug, CancellationToken cancellationToken = default);
}
