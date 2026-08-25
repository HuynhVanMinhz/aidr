using AIDR.Shared.Dtos.Admin;

namespace AIDR.Modules.Admin.Abstractions;

public sealed class AdminAccountRecord
{
    public Guid UserId { get; init; }
    public string Email { get; init; } = null!;
    public bool EmailConfirmed { get; init; }
    public string FullName { get; init; } = null!;
    public string? Phone { get; init; }
    public string? AvatarUrl { get; init; }
    public string Status { get; init; } = null!;
    public IReadOnlyList<string> Roles { get; init; } = Array.Empty<string>();
    public DateTime? LastLoginAt { get; init; }
    public DateTime? LockoutUntil { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public sealed class AdminAccountListSummary
{
    public int ActiveCount { get; init; }
    public int LockedCount { get; init; }
    public int PendingDeletionCount { get; init; }
    public int BuyerCount { get; init; }
    public int SellerCount { get; init; }
    public int AdminCount { get; init; }
}

public interface IAdminAccountRepository
{
    Task<(IReadOnlyList<AdminAccountRecord> Items, int TotalCount, int Page, AdminAccountListSummary Summary)>
        ListPagedAsync(
            string? status,
            string? roleCode,
            string? keyword,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default);

    Task<AdminAccountRecord?> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<AdminAccountRecord> SetStatusAsync(
        Guid userId,
        string status,
        bool clearLoginLockout,
        CancellationToken cancellationToken = default);
}

public interface IAdminAccountService
{
    Task<AdminAccountListResultDto> ListAsync(
        string? status,
        string? role,
        string? q,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<AdminAccountDto> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<AdminAccountDto> LockAsync(
        Guid userId,
        Guid adminUserId,
        CancellationToken cancellationToken = default);

    Task<AdminAccountDto> UnlockAsync(
        Guid userId,
        Guid adminUserId,
        CancellationToken cancellationToken = default);
}
