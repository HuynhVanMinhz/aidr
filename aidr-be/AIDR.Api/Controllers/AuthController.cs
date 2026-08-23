using AIDR.Modules.Auth.Abstractions;
using AIDR.Shared.Dtos.Auth;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth) => _auth = auth;

    /// <summary>UC-01 Register Account</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<AuthTokenResponse>>> Register(
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _auth.RegisterAsync(request, cancellationToken);
        return Ok(ApiResult<AuthTokenResponse>.Ok(result, "Registered successfully."));
    }

    /// <summary>UC-02 Login With Email / Password</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<AuthTokenResponse>>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _auth.LoginAsync(request, cancellationToken);
        return Ok(ApiResult<AuthTokenResponse>.Ok(result, "Login successful."));
    }

    /// <summary>UC-03 Login With Google — start OIDC via Keycloak</summary>
    [HttpGet("google")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<GoogleAuthUrlResponse>>> GoogleStart(
        [FromQuery] string redirectUri,
        CancellationToken cancellationToken)
    {
        var result = await _auth.GetGoogleAuthorizationUrlAsync(redirectUri, cancellationToken);
        return Ok(ApiResult<GoogleAuthUrlResponse>.Ok(result));
    }

    /// <summary>UC-03 Login With Google — exchange code and upsert app user</summary>
    [HttpPost("google/callback")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<AuthTokenResponse>>> GoogleCallback(
        [FromBody] GoogleCallbackRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _auth.CompleteGoogleLoginAsync(request, cancellationToken);
        return Ok(ApiResult<AuthTokenResponse>.Ok(result, "Google login successful."));
    }

    /// <summary>UC-04 Logout</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<object?>>> Logout(
        [FromBody] LogoutRequest? request,
        CancellationToken cancellationToken)
    {
        await _auth.LogoutAsync(request ?? new LogoutRequest(), cancellationToken);
        return Ok(ApiResult<object?>.Ok(null, "Logged out."));
    }

    /// <summary>UC-05 Forget Password — request reset link</summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<object?>>> ForgotPassword(
        [FromBody] ForgotPasswordRequest request,
        CancellationToken cancellationToken)
    {
        await _auth.ForgotPasswordAsync(request, cancellationToken);
        return Ok(ApiResult<object?>.Ok(null, "If the email is registered, a reset link has been sent."));
    }

    /// <summary>UC-05 Forget Password — reset with one-time token</summary>
    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<object?>>> ResetPassword(
        [FromBody] ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        await _auth.ResetPasswordAsync(request, cancellationToken);
        return Ok(ApiResult<object?>.Ok(null, "Password has been reset."));
    }
}
