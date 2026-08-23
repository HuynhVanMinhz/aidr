namespace AIDR.Modules.Auth.Abstractions;

public sealed class AuthUserRecord
{
    public Guid UserId { get; init; }
    public string? KeycloakSub { get; init; }
    public string Email { get; init; } = null!;
    public string FullName { get; init; } = null!;
    public string? PasswordHash { get; init; }
    public string Status { get; init; } = null!;
    public int FailedLoginCount { get; init; }
    public DateTime? LockoutUntil { get; init; }
    public IReadOnlyList<string> Roles { get; init; } = Array.Empty<string>();
}

public interface IAuthUserRepository
{
    Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default);
    Task<AuthUserRecord?> FindByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<AuthUserRecord?> FindByIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<AuthUserRecord?> FindByKeycloakSubAsync(string keycloakSub, CancellationToken cancellationToken = default);
    Task<AuthUserRecord> CreateBuyerAsync(string email, string fullName, string? passwordHash, string? keycloakSub, CancellationToken cancellationToken = default);
    Task UpdateLoginSuccessAsync(Guid userId, string? keycloakSub, CancellationToken cancellationToken = default);
    Task UpdateLoginFailureAsync(Guid userId, int failedLoginCount, DateTime? lockoutUntil, CancellationToken cancellationToken = default);
    Task UpdatePasswordHashAsync(Guid userId, string passwordHash, CancellationToken cancellationToken = default);
    Task LinkKeycloakSubAsync(Guid userId, string keycloakSub, CancellationToken cancellationToken = default);
    Task<AuthUserRecord> UpsertGoogleUserAsync(string email, string fullName, string keycloakSub, CancellationToken cancellationToken = default);
}
