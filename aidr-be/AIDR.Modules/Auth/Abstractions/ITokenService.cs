namespace AIDR.Modules.Auth.Abstractions;

public sealed class IssuedTokenPair
{
    public string AccessToken { get; init; } = null!;
    public string RefreshToken { get; init; } = null!;
    public int ExpiresInSeconds { get; init; }
}

public interface ITokenService
{
    IssuedTokenPair IssueTokens(Guid userId, string email, IEnumerable<string> roles);
    Task StoreRefreshTokenAsync(string refreshToken, Guid userId, CancellationToken cancellationToken = default);
    Task<Guid?> ValidateRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task RevokeRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default);
}
