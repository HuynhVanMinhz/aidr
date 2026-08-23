using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace AIDR.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var raw = principal.FindFirstValue("userId")
            ?? principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub);

        if (Guid.TryParse(raw, out var userId))
            return userId;

        throw new UnauthorizedAccessException("User id claim is missing or invalid.");
    }
}
