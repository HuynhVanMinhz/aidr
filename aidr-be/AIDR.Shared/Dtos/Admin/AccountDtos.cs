namespace AIDR.Shared.Dtos.Admin;

public sealed class AdminAccountDto
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

public sealed class AdminAccountListResultDto
{
    public IReadOnlyList<AdminAccountDto> Items { get; init; } = Array.Empty<AdminAccountDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
    public int ActiveCount { get; init; }
    public int LockedCount { get; init; }
    public int PendingDeletionCount { get; init; }
    public int BuyerCount { get; init; }
    public int SellerCount { get; init; }
    public int AdminCount { get; init; }
}
