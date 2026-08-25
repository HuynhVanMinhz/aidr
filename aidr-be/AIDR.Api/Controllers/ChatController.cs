using AIDR.Api.Extensions;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/chat")]
[Authorize]
public sealed class ChatController : ControllerBase
{
    private readonly IChatService _chats;

    public ChatController(IChatService chats) => _chats = chats;

    /// <summary>List chat threads for the current user (buyer or shop owner), newest activity first.</summary>
    [HttpGet("threads")]
    public async Task<ActionResult<ApiResult<PagedResult<ChatThreadDto>>>> ListThreads(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _chats.ListThreadsAsync(
            User.GetUserId(),
            page,
            pageSize,
            cancellationToken);
        return Ok(ApiResult<PagedResult<ChatThreadDto>>.Ok(result));
    }

    /// <summary>Get a single chat thread the current user participates in.</summary>
    [HttpGet("threads/{threadId:guid}")]
    public async Task<ActionResult<ApiResult<ChatThreadDto>>> GetThread(
        Guid threadId,
        CancellationToken cancellationToken)
    {
        var result = await _chats.GetThreadAsync(User.GetUserId(), threadId, cancellationToken);
        return Ok(ApiResult<ChatThreadDto>.Ok(result));
    }

    /// <summary>Open or reuse a buyer↔shop chat thread. Optional product context.</summary>
    [HttpPost("threads")]
    public async Task<ActionResult<ApiResult<ChatThreadDto>>> OpenThread(
        [FromBody] OpenChatThreadRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _chats.OpenThreadAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<ChatThreadDto>.Ok(result, "Chat thread ready."));
    }

    /// <summary>List messages in a thread. Page 1 is the newest chunk, items chronological within the page.</summary>
    [HttpGet("threads/{threadId:guid}/messages")]
    public async Task<ActionResult<ApiResult<PagedResult<ChatMessageDto>>>> ListMessages(
        Guid threadId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30,
        CancellationToken cancellationToken = default)
    {
        var result = await _chats.ListMessagesAsync(
            User.GetUserId(),
            threadId,
            page,
            pageSize,
            cancellationToken);
        return Ok(ApiResult<PagedResult<ChatMessageDto>>.Ok(result));
    }

    /// <summary>Send a message in a thread and push it over SignalR.</summary>
    [HttpPost("threads/{threadId:guid}/messages")]
    public async Task<ActionResult<ApiResult<ChatMessageDto>>> SendMessage(
        Guid threadId,
        [FromBody] SendChatMessageRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _chats.SendMessageAsync(
            User.GetUserId(),
            threadId,
            request,
            cancellationToken);
        return Ok(ApiResult<ChatMessageDto>.Ok(result, "Message sent."));
    }

    /// <summary>Mark messages from the other party as read.</summary>
    [HttpPost("threads/{threadId:guid}/read")]
    public async Task<ActionResult<ApiResult<MarkChatThreadReadResponse>>> MarkRead(
        Guid threadId,
        CancellationToken cancellationToken)
    {
        var result = await _chats.MarkReadAsync(User.GetUserId(), threadId, cancellationToken);
        return Ok(ApiResult<MarkChatThreadReadResponse>.Ok(result, "Thread marked as read."));
    }
}
