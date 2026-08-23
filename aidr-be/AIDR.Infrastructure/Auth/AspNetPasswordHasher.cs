using AIDR.Modules.Auth.Abstractions;
using Microsoft.AspNetCore.Identity;

namespace AIDR.Infrastructure.Auth;

public sealed class AspNetPasswordHasher : IPasswordHasher
{
    private readonly PasswordHasher<object> _hasher = new();

    public string Hash(string password) => _hasher.HashPassword(new object(), password);

    public bool Verify(string password, string passwordHash)
    {
        if (string.IsNullOrEmpty(passwordHash))
            return false;

        var result = _hasher.VerifyHashedPassword(new object(), passwordHash, password);
        return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
    }
}
