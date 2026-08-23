using AIDR.Api.Extensions;
using AIDR.Modules.Profile.Abstractions;
using AIDR.Shared.Dtos.Profile;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/profile")]
[Authorize]
public sealed class ProfileController : ControllerBase
{
    private readonly IProfileService _profile;

    public ProfileController(IProfileService profile) => _profile = profile;

    /// <summary>UC-07 View Profile</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<ProfileResponse>>> Get(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _profile.GetProfileAsync(userId, cancellationToken);
        return Ok(ApiResult<ProfileResponse>.Ok(result));
    }

    /// <summary>UC-08 Update Profile</summary>
    [HttpPut]
    public async Task<ActionResult<ApiResult<ProfileResponse>>> Update(
        [FromBody] UpdateProfileRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _profile.UpdateProfileAsync(userId, request, cancellationToken);
        return Ok(ApiResult<ProfileResponse>.Ok(result, "Profile updated."));
    }
}
