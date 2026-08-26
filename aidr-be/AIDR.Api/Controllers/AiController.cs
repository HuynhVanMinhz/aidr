using AIDR.Api.Extensions;
using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Dtos.Discovery;
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
    private readonly IAiShoppingAssistantService _assistant;

    public AiController(
        IAiNlFilterService nlFilter,
        IAiCompareService compare,
        IAiShoppingAssistantService assistant)
    {
        _nlFilter = nlFilter;
        _compare = compare;
        _assistant = assistant;
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

    /// <summary>Send a shopping-assistant message; creates or continues an AiConversation.</summary>
    [HttpPost("chat")]
    [Authorize(Policy = "Buyer")]
    public async Task<ActionResult<ApiResult<AiChatResultDto>>> Chat(
        [FromBody] AiChatRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _assistant.ChatAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<AiChatResultDto>.Ok(result));
    }

    /// <summary>List shopping-assistant conversations for the current buyer (newest first).</summary>
    [HttpGet("conversations")]
    [Authorize(Policy = "Buyer")]
    public async Task<ActionResult<ApiResult<PagedResult<AiConversationSummaryDto>>>> ListConversations(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _assistant.ListConversationsAsync(
            User.GetUserId(),
            page,
            pageSize,
            cancellationToken);
        return Ok(ApiResult<PagedResult<AiConversationSummaryDto>>.Ok(result));
    }

    /// <summary>Get a shopping-assistant conversation with full message history.</summary>
    [HttpGet("conversations/{conversationId:guid}")]
    [Authorize(Policy = "Buyer")]
    public async Task<ActionResult<ApiResult<AiConversationDetailDto>>> GetConversation(
        Guid conversationId,
        CancellationToken cancellationToken)
    {
        var result = await _assistant.GetConversationAsync(
            User.GetUserId(),
            conversationId,
            cancellationToken);
        return Ok(ApiResult<AiConversationDetailDto>.Ok(result));
    }
}
