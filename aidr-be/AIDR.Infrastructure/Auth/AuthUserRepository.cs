using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Auth.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Auth;

public sealed class AuthUserRepository : IAuthUserRepository
{
    private readonly AidrDbContext _db;

    public AuthUserRepository(AidrDbContext db) => _db = db;

    public Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default)
        => _db.Users.AnyAsync(u => u.Email == email, cancellationToken);

    public async Task<AuthUserRecord?> FindByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        var user = await QueryUsers()
            .FirstOrDefaultAsync(u => u.Email == email, cancellationToken);
        return user is null ? null : Map(user);
    }

    public async Task<AuthUserRecord?> FindByIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await QueryUsers()
            .FirstOrDefaultAsync(u => u.UserId == userId, cancellationToken);
        return user is null ? null : Map(user);
    }

    public async Task<AuthUserRecord?> FindByKeycloakSubAsync(string keycloakSub, CancellationToken cancellationToken = default)
    {
        var user = await QueryUsers()
            .FirstOrDefaultAsync(u => u.KeycloakSub == keycloakSub, cancellationToken);
        return user is null ? null : Map(user);
    }

    public async Task<AuthUserRecord> CreateBuyerAsync(
        string email,
        string fullName,
        string? passwordHash,
        string? keycloakSub,
        CancellationToken cancellationToken = default)
    {
        var buyerRole = await _db.Roles.FirstOrDefaultAsync(r => r.RoleCode == RoleCodes.Buyer, cancellationToken)
            ?? throw new AppException("BUYER role is not seeded in database.", 500);

        var now = DateTime.UtcNow;
        var user = new User
        {
            UserId = Guid.NewGuid(),
            Email = email,
            FullName = fullName,
            PasswordHash = passwordHash,
            KeycloakSub = keycloakSub,
            EmailConfirmed = false,
            Status = AuthConstants.UserStatusActive,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.Users.Add(user);
        _db.UserRoles.Add(new UserRole
        {
            UserId = user.UserId,
            RoleId = buyerRole.RoleId,
            AssignedAt = now
        });

        await _db.SaveChangesAsync(cancellationToken);
        return (await FindByIdAsync(user.UserId, cancellationToken))!;
    }

    public async Task UpdateLoginSuccessAsync(Guid userId, string? keycloakSub, CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstAsync(u => u.UserId == userId, cancellationToken);
        user.FailedLoginCount = 0;
        user.LockoutUntil = null;
        user.LastLoginAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(keycloakSub) && string.IsNullOrWhiteSpace(user.KeycloakSub))
            user.KeycloakSub = keycloakSub;
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateLoginFailureAsync(Guid userId, int failedLoginCount, DateTime? lockoutUntil, CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstAsync(u => u.UserId == userId, cancellationToken);
        user.FailedLoginCount = failedLoginCount;
        user.LockoutUntil = lockoutUntil;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdatePasswordHashAsync(Guid userId, string passwordHash, CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstAsync(u => u.UserId == userId, cancellationToken);
        user.PasswordHash = passwordHash;
        user.FailedLoginCount = 0;
        user.LockoutUntil = null;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task LinkKeycloakSubAsync(Guid userId, string keycloakSub, CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstAsync(u => u.UserId == userId, cancellationToken);
        user.KeycloakSub = keycloakSub;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<AuthUserRecord> UpsertGoogleUserAsync(
        string email,
        string fullName,
        string keycloakSub,
        CancellationToken cancellationToken = default)
    {
        var existingBySub = await FindByKeycloakSubAsync(keycloakSub, cancellationToken);
        if (existingBySub is not null)
            return existingBySub;

        var existingByEmail = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

        if (existingByEmail is not null)
        {
            existingByEmail.KeycloakSub ??= keycloakSub;
            existingByEmail.EmailConfirmed = true;
            existingByEmail.UpdatedAt = DateTime.UtcNow;
            if (string.IsNullOrWhiteSpace(existingByEmail.FullName))
                existingByEmail.FullName = fullName;
            await _db.SaveChangesAsync(cancellationToken);
            return (await FindByIdAsync(existingByEmail.UserId, cancellationToken))!;
        }

        return await CreateBuyerAsync(email, fullName, passwordHash: null, keycloakSub, cancellationToken);
    }

    private IQueryable<User> QueryUsers()
        => _db.Users.AsNoTracking().Include(u => u.UserRoles).ThenInclude(ur => ur.Role);

    private static AuthUserRecord Map(User user) => new()
    {
        UserId = user.UserId,
        KeycloakSub = user.KeycloakSub,
        Email = user.Email,
        FullName = user.FullName,
        PasswordHash = string.IsNullOrEmpty(user.PasswordHash) ? null : user.PasswordHash,
        Status = user.Status,
        FailedLoginCount = user.FailedLoginCount,
        LockoutUntil = user.LockoutUntil,
        Roles = user.UserRoles.Select(ur => ur.Role.RoleCode).ToList()
    };
}
