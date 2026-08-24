using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using AIDR.Modules.Auth.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Auth;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AIDR.Modules.Auth.Services;

public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    public int AccessTokenMinutes { get; set; } = AuthConstants.DefaultAccessTokenMinutes;
    public int RefreshTokenDays { get; set; } = AuthConstants.DefaultRefreshTokenDays;
    public int PasswordResetTokenHours { get; set; } = AuthConstants.DefaultPasswordResetHours;
    public int MaxFailedLogins { get; set; } = AuthConstants.MaxFailedLogins;
    public int LockoutMinutes { get; set; } = AuthConstants.LockoutMinutes;
    public string FrontendResetPasswordUrl { get; set; } = "http://localhost:5173/reset-password";
}

public sealed class AuthService : IAuthService
{
    private static readonly Regex UppercaseRegex = new("[A-Z]", RegexOptions.Compiled);
    private static readonly Regex SpecialCharRegex = new(@"[^a-zA-Z0-9]", RegexOptions.Compiled);

    private readonly IAuthUserRepository _users;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenService _tokenService;
    private readonly IPasswordResetTokenStore _resetTokens;
    private readonly IEmailSender _emailSender;
    private readonly IKeycloakOidcClient _keycloak;
    private readonly AuthOptions _options;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IAuthUserRepository users,
        IPasswordHasher passwordHasher,
        ITokenService tokenService,
        IPasswordResetTokenStore resetTokens,
        IEmailSender emailSender,
        IKeycloakOidcClient keycloak,
        IOptions<AuthOptions> options,
        ILogger<AuthService> logger)
    {
        _users = users;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
        _resetTokens = resetTokens;
        _emailSender = emailSender;
        _keycloak = keycloak;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<AuthTokenResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
    {
        var email = NormalizeEmail(request.Email);
        var fullName = request.FullName.Trim();
        ValidatePassword(request.Password);

        if (string.IsNullOrWhiteSpace(fullName))
            throw new AppException("Full name is required.");

        if (await _users.EmailExistsAsync(email, cancellationToken))
            throw new ConflictException("Email is already registered.");

        var passwordHash = _passwordHasher.Hash(request.Password);
        var user = await _users.CreateBuyerAsync(email, fullName, passwordHash, keycloakSub: null, cancellationToken);
        return await IssueAuthResponseAsync(user, cancellationToken);
    }

    public async Task<AuthTokenResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var email = NormalizeEmail(request.Email);
        var user = await _users.FindByEmailAsync(email, cancellationToken)
            ?? throw new UnauthorizedAppException("Invalid email or password.");

        EnsureAccountCanAuthenticate(user);

        if (string.IsNullOrEmpty(user.PasswordHash) || !_passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            await RegisterFailedLoginAsync(user, cancellationToken);
            throw new UnauthorizedAppException("Invalid email or password.");
        }

        await _users.UpdateLoginSuccessAsync(user.UserId, user.KeycloakSub, cancellationToken);
        var refreshed = await _users.FindByIdAsync(user.UserId, cancellationToken) ?? user;
        return await IssueAuthResponseAsync(refreshed, cancellationToken);
    }

    public Task<GoogleAuthUrlResponse> GetGoogleAuthorizationUrlAsync(string redirectUri, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(redirectUri))
            throw new AppException("RedirectUri is required.");

        var state = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));
        var url = _keycloak.BuildGoogleAuthorizationUrl(redirectUri, state);
        return Task.FromResult(new GoogleAuthUrlResponse { AuthorizationUrl = url });
    }

    public async Task<AuthTokenResponse> CompleteGoogleLoginAsync(GoogleCallbackRequest request, CancellationToken cancellationToken = default)
    {
        var tokenSet = await _keycloak.ExchangeCodeAsync(request.Code, request.RedirectUri, cancellationToken);
        var info = await _keycloak.GetUserInfoAsync(tokenSet.AccessToken, cancellationToken);

        if (string.IsNullOrWhiteSpace(info.Email))
            throw new AppException("Google account did not return an email.", 400);

        var email = NormalizeEmail(info.Email);
        var fullName = string.IsNullOrWhiteSpace(info.Name) ? email.Split('@')[0] : info.Name.Trim();
        var user = await _users.UpsertGoogleUserAsync(email, fullName, info.Sub, cancellationToken);

        EnsureAccountCanAuthenticate(user);
        await _users.UpdateLoginSuccessAsync(user.UserId, info.Sub, cancellationToken);
        var refreshed = await _users.FindByIdAsync(user.UserId, cancellationToken) ?? user;
        return await IssueAuthResponseAsync(refreshed, cancellationToken);
    }

    public async Task LogoutAsync(LogoutRequest request, CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            await _tokenService.RevokeRefreshTokenAsync(request.RefreshToken, cancellationToken);
            try
            {
                await _keycloak.RevokeRefreshTokenAsync(request.RefreshToken, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Keycloak refresh revoke skipped or failed");
            }
        }
    }

    public async Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken = default)
    {
        var email = NormalizeEmail(request.Email);
        var user = await _users.FindByEmailAsync(email, cancellationToken);

        // BR-09: only send for registered emails, but always return success to avoid enumeration.
        if (user is null)
        {
            _logger.LogInformation("Forgot-password requested for unknown email");
            return;
        }

        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
        var tokenHash = HashToken(rawToken);
        var expiresAt = DateTime.UtcNow.AddHours(_options.PasswordResetTokenHours);
        await _resetTokens.CreateAsync(user.UserId, tokenHash, expiresAt, cancellationToken);

        var resetUrl = $"{_options.FrontendResetPasswordUrl.TrimEnd('/')}?token={Uri.EscapeDataString(rawToken)}";
        var body = $"""
            <p>Hello {System.Net.WebUtility.HtmlEncode(user.FullName)},</p>
            <p>You requested a password reset for your AIDR account.</p>
            <p><a href="{resetUrl}">Reset password</a></p>
            <p>This link expires in {_options.PasswordResetTokenHours} hour(s) and can be used only once.</p>
            """;

        await _emailSender.SendAsync(user.Email, "AIDR — Reset password", body, cancellationToken);
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default)
    {
        if (!string.Equals(request.NewPassword, request.ConfirmPassword, StringComparison.Ordinal))
            throw new AppException("Confirm password does not match.");

        ValidatePassword(request.NewPassword);

        var tokenHash = HashToken(request.Token);
        var match = await _resetTokens.FindValidAsync(tokenHash, DateTime.UtcNow, cancellationToken)
            ?? throw new AppException("Reset token is invalid or expired.", 400);

        var passwordHash = _passwordHasher.Hash(request.NewPassword);
        await _users.UpdatePasswordHashAsync(match.UserId, passwordHash, cancellationToken);
        await _resetTokens.MarkUsedAsync(match.TokenId, DateTime.UtcNow, cancellationToken);
    }

    public async Task ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken cancellationToken = default)
    {
        if (!string.Equals(request.NewPassword, request.ConfirmPassword, StringComparison.Ordinal))
            throw new AppException("Confirm password does not match.");

        ValidatePassword(request.NewPassword);

        var user = await _users.FindByIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException("User not found.");

        if (string.IsNullOrEmpty(user.PasswordHash))
            throw new AppException("This account has no password set. Use forgot password to create one.");

        if (!_passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
            throw new UnauthorizedAppException("Current password is incorrect.");

        if (_passwordHasher.Verify(request.NewPassword, user.PasswordHash))
            throw new AppException("New password must be different from the current password.");

        var passwordHash = _passwordHasher.Hash(request.NewPassword);
        await _users.UpdatePasswordHashAsync(userId, passwordHash, cancellationToken);
    }

    private async Task RegisterFailedLoginAsync(AuthUserRecord user, CancellationToken cancellationToken)
    {
        var failed = user.FailedLoginCount + 1;
        DateTime? lockoutUntil = null;
        if (failed >= _options.MaxFailedLogins)
        {
            failed = 0;
            lockoutUntil = DateTime.UtcNow.AddMinutes(_options.LockoutMinutes);
        }

        await _users.UpdateLoginFailureAsync(user.UserId, failed, lockoutUntil, cancellationToken);
    }

    private void EnsureAccountCanAuthenticate(AuthUserRecord user)
    {
        if (string.Equals(user.Status, AuthConstants.UserStatusLocked, StringComparison.OrdinalIgnoreCase))
            throw new ForbiddenAppException("Account is locked.");

        if (!string.Equals(user.Status, AuthConstants.UserStatusActive, StringComparison.OrdinalIgnoreCase))
            throw new ForbiddenAppException("Account is not active.");

        if (user.LockoutUntil is { } until && until > DateTime.UtcNow)
            throw new ForbiddenAppException($"Account temporarily locked until {until:O}.");
    }

    private async Task<AuthTokenResponse> IssueAuthResponseAsync(AuthUserRecord user, CancellationToken cancellationToken)
    {
        var tokens = _tokenService.IssueTokens(user.UserId, user.Email, user.Roles);
        await _tokenService.StoreRefreshTokenAsync(tokens.RefreshToken, user.UserId, cancellationToken);

        return new AuthTokenResponse
        {
            AccessToken = tokens.AccessToken,
            RefreshToken = tokens.RefreshToken,
            ExpiresIn = tokens.ExpiresInSeconds,
            User = new AuthUserDto
            {
                UserId = user.UserId,
                Email = user.Email,
                FullName = user.FullName,
                Roles = user.Roles
            }
        };
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    private static void ValidatePassword(string password)
    {
        // BR-02
        if (string.IsNullOrEmpty(password) || password.Length < AuthConstants.MinPasswordLength)
            throw new AppException($"Password must be at least {AuthConstants.MinPasswordLength} characters.");

        if (!UppercaseRegex.IsMatch(password))
            throw new AppException("Password must contain at least one uppercase letter.");

        if (!SpecialCharRegex.IsMatch(password))
            throw new AppException("Password must contain at least one special character.");
    }

    private static string HashToken(string rawToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexString(bytes);
    }
}
