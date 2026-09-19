using AIDR.Modules.Shipping.Abstractions;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

/// <summary>
/// The carrier's province / district / ward list, for address forms.
///
/// Proxied rather than called from the browser so the carrier token never leaves
/// the server, and so every address in the system is spelled the way the carrier
/// expects - a typed address is what makes a booking fail at dispatch time.
/// </summary>
[ApiController]
[Route("api/shipping/locations")]
[Authorize]
public sealed class ShippingLocationsController : ControllerBase
{
    private readonly IShippingLocationDirectory _locations;

    public ShippingLocationsController(IShippingLocationDirectory locations) => _locations = locations;

    [HttpGet("provinces")]
    public async Task<ActionResult<ApiResult<IReadOnlyList<ShippingLocationDto>>>> Provinces(
        CancellationToken cancellationToken)
    {
        var items = await _locations.GetProvincesAsync(cancellationToken);
        return Ok(ApiResult<IReadOnlyList<ShippingLocationDto>>.Ok(items, "Provinces loaded."));
    }

    [HttpGet("provinces/{provinceId}/districts")]
    public async Task<ActionResult<ApiResult<IReadOnlyList<ShippingLocationDto>>>> Districts(
        string provinceId,
        CancellationToken cancellationToken)
    {
        var items = await _locations.GetDistrictsAsync(provinceId, cancellationToken);
        return Ok(ApiResult<IReadOnlyList<ShippingLocationDto>>.Ok(items, "Districts loaded."));
    }

    [HttpGet("districts/{districtId}/wards")]
    public async Task<ActionResult<ApiResult<IReadOnlyList<ShippingLocationDto>>>> Wards(
        string districtId,
        CancellationToken cancellationToken)
    {
        var items = await _locations.GetWardsAsync(districtId, cancellationToken);
        return Ok(ApiResult<IReadOnlyList<ShippingLocationDto>>.Ok(items, "Wards loaded."));
    }
}
