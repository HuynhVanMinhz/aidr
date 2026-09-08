using AIDR.Api.Extensions;
using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize(Policy = "Buyer")]
public sealed class OrderProtectionController : ControllerBase
{
    private readonly IBuyerProtectionTimelineService _timeline;

    public OrderProtectionController(IBuyerProtectionTimelineService timeline) => _timeline = timeline;

    [HttpGet("{orderId:guid}/protection-timeline")]
    public async Task<ActionResult<ApiResult<BuyerProtectionTimelineDto>>> GetProtectionTimeline(
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var result = await _timeline.GetTimelineAsync(User.GetUserId(), orderId, cancellationToken);
        return Ok(ApiResult<BuyerProtectionTimelineDto>.Ok(result));
    }
}
