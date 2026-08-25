using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Admin;

public sealed class AdminAccountRepository : IAdminAccountRepository
{
    private readonly AidrDbContext _db;

    public AdminAccountRepository(AidrDbContext db) => _db = db;

    public async Task<(IReadOnlyList<AdminAccountRecord> Items, int TotalCount, int Page, AdminAccountListSummary Summary)>
        ListPagedAsync(
            string? status,
            string? roleCode,
            string? keyword,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default)
    {
        var query = _db.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(u => u.Status == status);

        if (!string.IsNullOrWhiteSpace(roleCode))
            query = query.Where(u => u.UserRoles.Any(ur => ur.Role.RoleCode == roleCode));

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var term = keyword.Trim();
            query = query.Where(u =>
                u.Email.Contains(term) ||
                u.FullName.Contains(term) ||
                (u.Phone != null && u.Phone.Contains(term)));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var summary = await BuildSummaryAsync(cancellationToken);

        if (totalCount == 0)
            return (Array.Empty<AdminAccountRecord>(), 0, 1, summary);

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        if (page > totalPages)
            page = totalPages;

        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .ThenBy(u => u.Email)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var userIds = users.Select(u => u.UserId).ToList();
        var rolesByUser = await LoadRolesAsync(userIds, cancellationToken);

        var items = users.Select(u => Map(u, rolesByUser)).ToList();
        return (items, totalCount, page, summary);
    }

    public async Task<AdminAccountRecord?> GetByIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserId == userId, cancellationToken);

        if (user is null)
            return null;

        var rolesByUser = await LoadRolesAsync([userId], cancellationToken);
        return Map(user, rolesByUser);
    }

    public async Task<AdminAccountRecord> SetStatusAsync(
        Guid userId,
        string status,
        bool clearLoginLockout,
        CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == userId, cancellationToken)
            ?? throw new NotFoundException("Account was not found.");

        user.Status = status;
        user.UpdatedAt = DateTime.UtcNow;

        if (clearLoginLockout)
        {
            user.FailedLoginCount = 0;
            user.LockoutUntil = null;
        }

        await _db.SaveChangesAsync(cancellationToken);

        var rolesByUser = await LoadRolesAsync([userId], cancellationToken);
        return Map(user, rolesByUser);
    }

    private async Task<AdminAccountListSummary> BuildSummaryAsync(CancellationToken cancellationToken)
    {
        var statusCounts = await _db.Users.AsNoTracking()
            .GroupBy(u => u.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var roleCounts = await _db.UserRoles.AsNoTracking()
            .GroupBy(ur => ur.Role.RoleCode)
            .Select(g => new { RoleCode = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        return new AdminAccountListSummary
        {
            ActiveCount = statusCounts
                .Where(r => string.Equals(r.Status, AdminConstants.UserStatusActive, StringComparison.OrdinalIgnoreCase))
                .Select(r => r.Count)
                .FirstOrDefault(),
            LockedCount = statusCounts
                .Where(r => string.Equals(r.Status, AdminConstants.UserStatusLocked, StringComparison.OrdinalIgnoreCase))
                .Select(r => r.Count)
                .FirstOrDefault(),
            PendingDeletionCount = statusCounts
                .Where(r => string.Equals(
                    r.Status,
                    AdminConstants.UserStatusPendingDeletion,
                    StringComparison.OrdinalIgnoreCase))
                .Select(r => r.Count)
                .FirstOrDefault(),
            BuyerCount = roleCounts
                .Where(r => string.Equals(r.RoleCode, RoleCodes.Buyer, StringComparison.OrdinalIgnoreCase))
                .Select(r => r.Count)
                .FirstOrDefault(),
            SellerCount = roleCounts
                .Where(r => string.Equals(r.RoleCode, RoleCodes.Seller, StringComparison.OrdinalIgnoreCase))
                .Select(r => r.Count)
                .FirstOrDefault(),
            AdminCount = roleCounts
                .Where(r => string.Equals(r.RoleCode, RoleCodes.Admin, StringComparison.OrdinalIgnoreCase))
                .Select(r => r.Count)
                .FirstOrDefault()
        };
    }

    private async Task<Dictionary<Guid, List<string>>> LoadRolesAsync(
        IReadOnlyCollection<Guid> userIds,
        CancellationToken cancellationToken)
    {
        if (userIds.Count == 0)
            return new Dictionary<Guid, List<string>>();

        var rows = await _db.UserRoles.AsNoTracking()
            .Where(ur => userIds.Contains(ur.UserId))
            .Select(ur => new { ur.UserId, ur.Role.RoleCode })
            .ToListAsync(cancellationToken);

        return rows
            .GroupBy(r => r.UserId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(x => x.RoleCode)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(x => x, StringComparer.OrdinalIgnoreCase)
                    .ToList());
    }

    private static AdminAccountRecord Map(
        User user,
        IReadOnlyDictionary<Guid, List<string>> rolesByUser)
    {
        rolesByUser.TryGetValue(user.UserId, out var roles);
        return new AdminAccountRecord
        {
            UserId = user.UserId,
            Email = user.Email,
            EmailConfirmed = user.EmailConfirmed,
            FullName = user.FullName,
            Phone = user.Phone,
            AvatarUrl = user.AvatarUrl,
            Status = user.Status,
            Roles = roles ?? [],
            LastLoginAt = user.LastLoginAt,
            LockoutUntil = user.LockoutUntil,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt
        };
    }
}
