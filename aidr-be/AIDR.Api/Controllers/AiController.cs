using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/ai")]
public sealed class AiController : ControllerBase
{
    private readonly IAiNlFilterService _nlFilter;
    private readonly IAiCompareService _compare;

    public AiController(IAiNlFilterService nlFilter, IAiCompareService compare)
    {
        _nlFilter = nlFilter;
        _compare = compare;
    }

    /// <summary>Convert a natural-language shopping query into a validated catalog filter DSL.</summary>
    [HttpPost("nl-filter")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<NlFilterResultDto>>> NlFilter(
        [FromBody] NlFilterRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _nlFilter.ParseAsync(request, cancellationToken);
        return Ok(ApiResult<NlFilterResultDto>.Ok(result));
    }

    /// <summary>Compare 2–5 approved products (table dimensions + AI/heuristic summary).</summary>
    [HttpPost("compare")]
    [Authorize(Policy = "Buyer")]
    public async Task<ActionResult<ApiResult<CompareProductsResultDto>>> Compare(
        [FromBody] CompareProductsRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _compare.CompareAsync(request, cancellationToken);
        return Ok(ApiResult<CompareProductsResultDto>.Ok(result));
    }
}
