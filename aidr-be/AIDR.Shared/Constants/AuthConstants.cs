namespace AIDR.Shared.Constants;

public static class AuthConstants
{
    public const int MinPasswordLength = 8;
    public const int MaxFailedLogins = 5;
    public const int LockoutMinutes = 15;
    public const int DefaultAccessTokenMinutes = 60;
    public const int DefaultRefreshTokenDays = 7;
    public const int DefaultPasswordResetHours = 1;
    public const string RefreshTokenCachePrefix = "auth:refresh:";
    public const string UserStatusActive = "Active";
    public const string UserStatusLocked = "Locked";
    public const string UserStatusPendingDeletion = "PendingDeletion";
}
