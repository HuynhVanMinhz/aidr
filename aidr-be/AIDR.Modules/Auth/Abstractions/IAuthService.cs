using AIDR.Shared.Dtos.Auth;

namespace AIDR.Modules.Auth.Abstractions;

public interface IAuthService
{
    Task<AuthTokenResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);
    Task<AuthTokenResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<GoogleAuthUrlResponse> GetGoogleAuthorizationUrlAsync(string redirectUri, CancellationToken cancellationToken = default);
    Task<AuthTokenResponse> CompleteGoogleLoginAsync(GoogleCallbackRequest request, CancellationToken cancellationToken = default);
    Task LogoutAsync(LogoutRequest request, CancellationToken cancellationToken = default);
    Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken = default);
    Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken = default);
}
