using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using AIDR.Modules.Auth.Abstractions;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AIDR.Infrastructure.Auth;

public sealed class KeycloakOptions
{
    public const string SectionName = "Keycloak";

    public string Authority { get; set; } = null!;
    public string Audience { get; set; } = "aidr-api";
    public bool RequireHttpsMetadata { get; set; }
    public string BaseUrl { get; set; } = "http://localhost:8080";
    public string Realm { get; set; } = "aidr";
    public string FrontendClientId { get; set; } = "aidr-fe";
    public string? FrontendClientSecret { get; set; }
    public string GoogleIdpAlias { get; set; } = "google";
}

public sealed class KeycloakOidcClient : IKeycloakOidcClient
{
    private readonly HttpClient _http;
    private readonly KeycloakOptions _options;
    private readonly ILogger<KeycloakOidcClient> _logger;

    public KeycloakOidcClient(HttpClient http, IOptions<KeycloakOptions> options, ILogger<KeycloakOidcClient> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public string BuildGoogleAuthorizationUrl(string redirectUri, string state)
    {
        var realmBase = $"{_options.BaseUrl.TrimEnd('/')}/realms/{_options.Realm}";
        var query = new Dictionary<string, string>
        {
            ["client_id"] = _options.FrontendClientId,
            ["redirect_uri"] = redirectUri,
            ["response_type"] = "code",
            ["scope"] = "openid email profile",
            ["state"] = state,
            ["kc_idp_hint"] = _options.GoogleIdpAlias
        };

        var qs = string.Join("&", query.Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}"));
        return $"{realmBase}/protocol/openid-connect/auth?{qs}";
    }

    public async Task<KeycloakTokenSet> ExchangeCodeAsync(string code, string redirectUri, CancellationToken cancellationToken = default)
    {
        var tokenUrl = $"{_options.BaseUrl.TrimEnd('/')}/realms/{_options.Realm}/protocol/openid-connect/token";
        var form = new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["code"] = code,
            ["redirect_uri"] = redirectUri,
            ["client_id"] = _options.FrontendClientId
        };

        if (!string.IsNullOrWhiteSpace(_options.FrontendClientSecret))
            form["client_secret"] = _options.FrontendClientSecret;

        using var content = new FormUrlEncodedContent(form);
        using var response = await _http.PostAsync(tokenUrl, content, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogWarning("Keycloak token exchange failed: {Status} {Body}", response.StatusCode, body);
            throw new AppException("Google login failed: unable to exchange authorization code.", 401);
        }

        var payload = await response.Content.ReadFromJsonAsync<KeycloakTokenResponse>(cancellationToken: cancellationToken)
            ?? throw new AppException("Google login failed: empty token response.", 401);

        return new KeycloakTokenSet
        {
            AccessToken = payload.AccessToken,
            RefreshToken = payload.RefreshToken,
            IdToken = payload.IdToken,
            ExpiresIn = payload.ExpiresIn
        };
    }

    public async Task<KeycloakUserInfo> GetUserInfoAsync(string accessToken, CancellationToken cancellationToken = default)
    {
        var userInfoUrl = $"{_options.BaseUrl.TrimEnd('/')}/realms/{_options.Realm}/protocol/openid-connect/userinfo";
        using var request = new HttpRequestMessage(HttpMethod.Get, userInfoUrl);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        using var response = await _http.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogWarning("Keycloak userinfo failed: {Status} {Body}", response.StatusCode, body);
            throw new AppException("Google login failed: unable to load user profile.", 401);
        }

        var payload = await response.Content.ReadFromJsonAsync<KeycloakUserInfoResponse>(cancellationToken: cancellationToken)
            ?? throw new AppException("Google login failed: empty userinfo.", 401);

        return new KeycloakUserInfo
        {
            Sub = payload.Sub,
            Email = payload.Email ?? string.Empty,
            Name = payload.Name ?? payload.PreferredUsername,
            EmailVerified = payload.EmailVerified
        };
    }

    public async Task RevokeRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var logoutUrl = $"{_options.BaseUrl.TrimEnd('/')}/realms/{_options.Realm}/protocol/openid-connect/logout";
        var form = new Dictionary<string, string>
        {
            ["client_id"] = _options.FrontendClientId,
            ["refresh_token"] = refreshToken
        };
        if (!string.IsNullOrWhiteSpace(_options.FrontendClientSecret))
            form["client_secret"] = _options.FrontendClientSecret;

        using var content = new FormUrlEncodedContent(form);
        using var response = await _http.PostAsync(logoutUrl, content, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogDebug("Keycloak logout returned {Status}: {Body}", response.StatusCode, body);
        }
    }

    private sealed class KeycloakTokenResponse
    {
        [JsonPropertyName("access_token")]
        public string AccessToken { get; set; } = null!;

        [JsonPropertyName("refresh_token")]
        public string? RefreshToken { get; set; }

        [JsonPropertyName("id_token")]
        public string? IdToken { get; set; }

        [JsonPropertyName("expires_in")]
        public int ExpiresIn { get; set; }
    }

    private sealed class KeycloakUserInfoResponse
    {
        [JsonPropertyName("sub")]
        public string Sub { get; set; } = null!;

        [JsonPropertyName("email")]
        public string? Email { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("preferred_username")]
        public string? PreferredUsername { get; set; }

        [JsonPropertyName("email_verified")]
        public bool EmailVerified { get; set; }
    }
}
