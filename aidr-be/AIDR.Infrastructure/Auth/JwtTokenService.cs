using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using AIDR.Modules.Auth.Abstractions;
using AIDR.Modules.Auth.Services;
using AIDR.Shared.Caching;
using AIDR.Shared.Constants;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace AIDR.Infrastructure.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "aidr-api";
    public string Audience { get; set; } = "aidr-fe";
    public string SigningKey { get; set; } = null!;
}

public sealed class JwtTokenService : ITokenService
{
    private readonly JwtOptions _jwt;
    private readonly AuthOptions _auth;
    private readonly ICacheService _cache;

    public JwtTokenService(IOptions<JwtOptions> jwt, IOptions<AuthOptions> auth, ICacheService cache)
    {
        _jwt = jwt.Value;
        _auth = auth.Value;
        _cache = cache;
    }

    public IssuedTokenPair IssueTokens(Guid userId, string email, IEnumerable<string> roles)
    {
        var expires = DateTime.UtcNow.AddMinutes(_auth.AccessTokenMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new("userId", userId.ToString()),
            new(JwtRegisteredClaimNames.Email, email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        foreach (var role in roles.Distinct(StringComparer.OrdinalIgnoreCase))
            claims.Add(new Claim(ClaimTypes.Role, role));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.SigningKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: _jwt.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expires,
            signingCredentials: creds);

        var accessToken = new JwtSecurityTokenHandler().WriteToken(token);
        var refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

        return new IssuedTokenPair
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresInSeconds = (int)TimeSpan.FromMinutes(_auth.AccessTokenMinutes).TotalSeconds
        };
    }

    public Task StoreRefreshTokenAsync(string refreshToken, Guid userId, CancellationToken cancellationToken = default)
    {
        var key = CacheKey(refreshToken);
        var ttl = TimeSpan.FromDays(_auth.RefreshTokenDays);
        return _cache.SetAsync(key, userId.ToString(), ttl, cancellationToken);
    }

    public async Task<Guid?> ValidateRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var value = await _cache.GetAsync<string>(CacheKey(refreshToken), cancellationToken);
        return Guid.TryParse(value, out var userId) ? userId : null;
    }

    public Task RevokeRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default)
        => _cache.RemoveAsync(CacheKey(refreshToken), cancellationToken);

    private static string CacheKey(string refreshToken)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken)));
        return AuthConstants.RefreshTokenCachePrefix + hash;
    }
}
