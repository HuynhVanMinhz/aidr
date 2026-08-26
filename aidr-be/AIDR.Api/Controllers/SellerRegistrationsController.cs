using AIDR.Api.Extensions;
using AIDR.Modules.Profile.Abstractions;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/seller-registrations")]
[Authorize(Policy = "Buyer")]
public sealed class SellerRegistrationsController : ControllerBase
{
    private readonly ISellerRegistrationService _registrations;

    public SellerRegistrationsController(ISellerRegistrationService registrations) =>
        _registrations = registrations;

    /// <summary>Submit a seller registration request for the current buyer.</summary>
    [HttpPost]
    public async Task<ActionResult<ApiResult<BuyerSellerRegistrationDto>>> Create(
        [FromBody] CreateSellerRegistrationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _registrations.CreateAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<BuyerSellerRegistrationDto>.Ok(
            result,
            "Seller registration submitted."));
    }

    /// <summary>Get the latest seller registration request for the current buyer.</summary>
    [HttpGet("me")]
    public async Task<ActionResult<ApiResult<BuyerSellerRegistrationDto>>> GetMine(
        CancellationToken cancellationToken)
    {
        var result = await _registrations.GetMineAsync(User.GetUserId(), cancellationToken);
        return Ok(ApiResult<BuyerSellerRegistrationDto>.Ok(result));
    }
}
