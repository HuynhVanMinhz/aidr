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
}

public sealed class ApproveSellerRegistrationResult
{
    public AdminSellerRegistrationRecord Request { get; init; } = null!;
    public Guid ShopId { get; init; }
    public Guid WalletId { get; init; }
}

public interface IAdminSellerRegistrationRepository
{
    Task<IReadOnlyList<AdminSellerRegistrationRecord>> ListAsync(
        string? status,
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

    Task<AdminSellerRegistrationRecord> RejectAsync(
        Guid requestId,
        Guid adminUserId,
        string adminNote,
        CancellationToken cancellationToken = default);

    Task<bool> SlugExistsAsync(string slug, CancellationToken cancellationToken = default);
}
