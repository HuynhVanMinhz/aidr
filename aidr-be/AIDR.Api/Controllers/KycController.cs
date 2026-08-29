using AIDR.Api.Extensions;
using AIDR.Modules.Kyc.Abstractions;
using AIDR.Shared.Dtos.Kyc;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/kyc")]
[Authorize]
public sealed class KycController : ControllerBase
{
    private readonly IKycService _kyc;

    public KycController(IKycService kyc) => _kyc = kyc;

    /// <summary>Latest identity verification for the signed-in user.</summary>
    [HttpGet("me")]
    public async Task<ActionResult<ApiResult<KycVerificationDto?>>> GetMine(
        CancellationToken cancellationToken)
    {
        var result = await _kyc.GetMineAsync(User.GetUserId(), cancellationToken);
        return Ok(ApiResult<KycVerificationDto?>.Ok(result));
    }

    /// <summary>
    /// Run eKYC: read the ID card and compare the portrait against it.
    /// Images must already be uploaded to an approved host (Cloudinary).
    /// </summary>
    [HttpPost("verify")]
    public async Task<ActionResult<ApiResult<KycVerificationDto>>> Verify(
        [FromBody] KycVerifyRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _kyc.VerifyAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<KycVerificationDto>.Ok(result, result.FailureReason ?? "Identity verified."));
    }
}
