using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Auth.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Auth;

public sealed class PasswordResetTokenStore : IPasswordResetTokenStore
{
    private readonly AidrDbContext _db;

    public PasswordResetTokenStore(AidrDbContext db) => _db = db;

    public async Task CreateAsync(Guid userId, string tokenHash, DateTime expiresAtUtc, CancellationToken cancellationToken = default)
    {
        _db.PasswordResetTokens.Add(new PasswordResetToken
        {
            TokenId = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = expiresAtUtc,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<(Guid UserId, Guid TokenId)?> FindValidAsync(string tokenHash, DateTime utcNow, CancellationToken cancellationToken = default)
    {
        var token = await _db.PasswordResetTokens
            .AsNoTracking()
            .Where(t => t.TokenHash == tokenHash && t.UsedAt == null && t.ExpiresAt > utcNow)
            .OrderByDescending(t => t.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return token is null ? null : (token.UserId, token.TokenId);
    }

    public async Task MarkUsedAsync(Guid tokenId, DateTime usedAtUtc, CancellationToken cancellationToken = default)
    {
        var token = await _db.PasswordResetTokens.FirstAsync(t => t.TokenId == tokenId, cancellationToken);
        token.UsedAt = usedAtUtc;
        await _db.SaveChangesAsync(cancellationToken);
    }
}
