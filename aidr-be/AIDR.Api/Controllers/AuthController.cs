using AIDR.Modules.Auth.Abstractions;
using AIDR.Shared.Dtos.Auth;
using AIDR.Shared.Results;
using AIDR.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth) => _auth = auth;

    /// <summary>Register a new buyer account.</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<AuthTokenResponse>>> Register(
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _auth.RegisterAsync(request, cancellationToken);
        return Ok(ApiResult<AuthTokenResponse>.Ok(result, "Registered successfully."));
    }

    /// <summary>Login with email and password.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<AuthTokenResponse>>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _auth.LoginAsync(request, cancellationToken);
        return Ok(ApiResult<AuthTokenResponse>.Ok(result, "Login successful."));
    }

    /// <summary>Start Google login via Keycloak OIDC.</summary>
    [HttpGet("google")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<GoogleAuthUrlResponse>>> GoogleStart(
        [FromQuery] string redirectUri,
        CancellationToken cancellationToken)
    {
        var result = await _auth.GetGoogleAuthorizationUrlAsync(redirectUri, cancellationToken);
        return Ok(ApiResult<GoogleAuthUrlResponse>.Ok(result));
    }

    /// <summary>Complete Google login — exchange code and upsert app user.</summary>
    [HttpPost("google/callback")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<AuthTokenResponse>>> GoogleCallback(
        [FromBody] GoogleCallbackRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _auth.CompleteGoogleLoginAsync(request, cancellationToken);
        return Ok(ApiResult<AuthTokenResponse>.Ok(result, "Google login successful."));
    }

    /// <summary>Logout and revoke refresh token when provided.</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<object?>>> Logout(
        [FromBody] LogoutRequest? request,
        CancellationToken cancellationToken)
    {
        await _auth.LogoutAsync(request ?? new LogoutRequest(), cancellationToken);
        return Ok(ApiResult<object?>.Ok(null, "Logged out."));
    }

    /// <summary>Request a password reset link by email.</summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<object?>>> ForgotPassword(
        [FromBody] ForgotPasswordRequest request,
        CancellationToken cancellationToken)
    {
        await _auth.ForgotPasswordAsync(request, cancellationToken);
        return Ok(ApiResult<object?>.Ok(null, "If the email is registered, a reset link has been sent."));
    }

    /// <summary>Reset password with a one-time token.</summary>
    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<object?>>> ResetPassword(
        [FromBody] ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        await _auth.ResetPasswordAsync(request, cancellationToken);
        return Ok(ApiResult<object?>.Ok(null, "Password has been reset."));
    }

    /// <summary>Change password for the authenticated user.</summary>
    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult<ApiResult<object?>>> ChangePassword(
        [FromBody] ChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        await _auth.ChangePasswordAsync(userId, request, cancellationToken);
        return Ok(ApiResult<object?>.Ok(null, "Password changed successfully."));
    }
}
