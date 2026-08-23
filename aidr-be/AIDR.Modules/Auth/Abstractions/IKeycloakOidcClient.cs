namespace AIDR.Modules.Auth.Abstractions;

public sealed class KeycloakTokenSet
{
    public string AccessToken { get; init; } = null!;
    public string? RefreshToken { get; init; }
    public string? IdToken { get; init; }
    public int ExpiresIn { get; init; }
}

public sealed class KeycloakUserInfo
{
    public string Sub { get; init; } = null!;
    public string Email { get; init; } = null!;
    public string? Name { get; init; }
    public bool EmailVerified { get; init; }
}

public interface IKeycloakOidcClient
{
    string BuildGoogleAuthorizationUrl(string redirectUri, string state);
    Task<KeycloakTokenSet> ExchangeCodeAsync(string code, string redirectUri, CancellationToken cancellationToken = default);
    Task<KeycloakUserInfo> GetUserInfoAsync(string accessToken, CancellationToken cancellationToken = default);
    Task RevokeRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default);
}
