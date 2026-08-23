namespace AIDR.Modules.Auth.Abstractions;

public interface IPasswordResetTokenStore
{
    Task CreateAsync(Guid userId, string tokenHash, DateTime expiresAtUtc, CancellationToken cancellationToken = default);
    Task<(Guid UserId, Guid TokenId)?> FindValidAsync(string tokenHash, DateTime utcNow, CancellationToken cancellationToken = default);
    Task MarkUsedAsync(Guid tokenId, DateTime usedAtUtc, CancellationToken cancellationToken = default);
}
