using System.ComponentModel.DataAnnotations;

namespace AIDR.Shared.Dtos.Auth;

public sealed class RegisterRequest
{
    [Required, MaxLength(128)]
    public string FullName { get; set; } = null!;

    [Required, EmailAddress, MaxLength(256)]
    public string Email { get; set; } = null!;

    [Required, MinLength(8), MaxLength(128)]
    public string Password { get; set; } = null!;
}

public sealed class LoginRequest
{
    [Required, EmailAddress, MaxLength(256)]
    public string Email { get; set; } = null!;

    [Required, MaxLength(128)]
    public string Password { get; set; } = null!;
}

public sealed class ForgotPasswordRequest
{
    [Required, EmailAddress, MaxLength(256)]
    public string Email { get; set; } = null!;
}

public sealed class ResetPasswordRequest
{
    [Required]
    public string Token { get; set; } = null!;

    [Required, MinLength(8), MaxLength(128)]
    public string NewPassword { get; set; } = null!;

    [Required, MinLength(8), MaxLength(128)]
    public string ConfirmPassword { get; set; } = null!;
}

public sealed class LogoutRequest
{
    public string? RefreshToken { get; set; }
}

public sealed class GoogleLoginStartRequest
{
    /// <summary>Frontend callback URL registered with Keycloak client.</summary>
    [Required]
    public string RedirectUri { get; set; } = null!;
}

public sealed class GoogleCallbackRequest
{
    [Required]
    public string Code { get; set; } = null!;

    [Required]
    public string RedirectUri { get; set; } = null!;
}

public sealed class AuthUserDto
{
    public Guid UserId { get; set; }
    public string Email { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public IReadOnlyList<string> Roles { get; set; } = Array.Empty<string>();
}

public sealed class AuthTokenResponse
{
    public string AccessToken { get; set; } = null!;
    public string RefreshToken { get; set; } = null!;
    public int ExpiresIn { get; set; }
    public string TokenType { get; set; } = "Bearer";
    public AuthUserDto User { get; set; } = null!;
}

public sealed class GoogleAuthUrlResponse
{
    public string AuthorizationUrl { get; set; } = null!;
}
