using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Admin.Services;

public sealed class AdminAccountService : IAdminAccountService
{
    private readonly IAdminAccountRepository _repository;

    public AdminAccountService(IAdminAccountRepository repository) => _repository = repository;

    public async Task<AdminAccountListResultDto> ListAsync(
        string? status,
        string? role,
        string? q,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var normalizedStatus = NormalizeStatusFilter(status);
        var normalizedRole = NormalizeRoleFilter(role);
        var (normalizedPage, normalizedPageSize) = AdminConstants.NormalizePaging(page, pageSize);
        var keyword = NormalizeSearch(q);

        var (items, totalCount, effectivePage, summary) = await _repository.ListPagedAsync(
            normalizedStatus,
            normalizedRole,
            keyword,
            normalizedPage,
            normalizedPageSize,
            cancellationToken);

        return new AdminAccountListResultDto
        {
            Items = items.Select(Map).ToList(),
            Page = effectivePage,
            PageSize = normalizedPageSize,
            TotalCount = totalCount,
            ActiveCount = summary.ActiveCount,
            LockedCount = summary.LockedCount,
            PendingDeletionCount = summary.PendingDeletionCount,
            BuyerCount = summary.BuyerCount,
            SellerCount = summary.SellerCount,
            AdminCount = summary.AdminCount
        };
    }

    public async Task<AdminAccountDto> GetByIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId, "User id");

        var record = await _repository.GetByIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException("Account was not found.");

        return Map(record);
    }

    public async Task<AdminAccountDto> LockAsync(
        Guid userId,
        Guid adminUserId,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId, "User id");
        EnsureUserId(adminUserId, "Admin user id");

        if (userId == adminUserId)
            throw new AppException("You cannot lock your own account.");

        var existing = await _repository.GetByIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException("Account was not found.");

        if (HasRole(existing, RoleCodes.Admin))
            throw new AppException("Admin accounts cannot be locked.");

        if (string.Equals(existing.Status, AdminConstants.UserStatusLocked, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Account is already locked.");

        if (string.Equals(
                existing.Status,
                AdminConstants.UserStatusPendingDeletion,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException("Accounts pending deletion cannot be locked.");
        }

        if (!string.Equals(existing.Status, AdminConstants.UserStatusActive, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Only active accounts can be locked.");

        var record = await _repository.SetStatusAsync(
            userId,
            AdminConstants.UserStatusLocked,
            clearLoginLockout: false,
            cancellationToken);

        return Map(record);
    }

    public async Task<AdminAccountDto> UnlockAsync(
        Guid userId,
        Guid adminUserId,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId, "User id");
        EnsureUserId(adminUserId, "Admin user id");

        var existing = await _repository.GetByIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException("Account was not found.");

        if (!string.Equals(existing.Status, AdminConstants.UserStatusLocked, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Only locked accounts can be unlocked.");

        var record = await _repository.SetStatusAsync(
            userId,
            AdminConstants.UserStatusActive,
            clearLoginLockout: true,
            cancellationToken);

        return Map(record);
    }

    private static string? NormalizeStatusFilter(string? status)
    {
        if (string.IsNullOrWhiteSpace(status) ||
            string.Equals(status.Trim(), "all", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var trimmed = status.Trim();
        var match = AdminConstants.AllowedUserStatuses.FirstOrDefault(s =>
            string.Equals(s, trimmed, StringComparison.OrdinalIgnoreCase));

        if (match is null)
            throw new AppException("Status filter must be Active, Locked, PendingDeletion, or all.");

        return match;
    }

    private static string? NormalizeRoleFilter(string? role)
    {
        if (string.IsNullOrWhiteSpace(role) ||
            string.Equals(role.Trim(), "all", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var trimmed = role.Trim().ToUpperInvariant();
        return trimmed switch
        {
            RoleCodes.Buyer => RoleCodes.Buyer,
            RoleCodes.Seller => RoleCodes.Seller,
            RoleCodes.Admin => RoleCodes.Admin,
            _ => throw new AppException("Role filter must be BUYER, SELLER, ADMIN, or all.")
        };
    }

    private static string? NormalizeSearch(string? q)
    {
        if (string.IsNullOrWhiteSpace(q))
            return null;

        var trimmed = q.Trim();
        if (trimmed.Length > AdminConstants.MaxListSearchLength)
        {
            throw new AppException(
                $"Search query must not exceed {AdminConstants.MaxListSearchLength} characters.");
        }

        return trimmed;
    }

    private static void EnsureUserId(Guid userId, string fieldName)
    {
        if (userId == Guid.Empty)
            throw new AppException($"{fieldName} is required.");
    }

    private static bool HasRole(AdminAccountRecord record, string roleCode) =>
        record.Roles.Any(r => string.Equals(r, roleCode, StringComparison.OrdinalIgnoreCase));

    private static AdminAccountDto Map(AdminAccountRecord record) => new()
    {
        UserId = record.UserId,
        Email = record.Email,
        EmailConfirmed = record.EmailConfirmed,
        FullName = record.FullName,
        Phone = record.Phone,
        AvatarUrl = record.AvatarUrl,
        Status = record.Status,
        Roles = record.Roles,
        LastLoginAt = record.LastLoginAt,
        LockoutUntil = record.LockoutUntil,
        CreatedAt = record.CreatedAt,
        UpdatedAt = record.UpdatedAt
    };
}
