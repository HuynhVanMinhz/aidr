using AIDR.Api.Extensions;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace AIDR.Api.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly IChatService _chats;

    public ChatHub(IChatService chats) => _chats = chats;

    /// <summary>
    /// Every connection joins its own user group, so a participant receives thread activity even
    /// while a different conversation (or no conversation) is open.
    /// </summary>
    public override async Task OnConnectedAsync()
    {
        if (TryGetUserId(out var userId))
        {
            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                ChatConstants.UserGroupName(userId));
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (TryGetUserId(out var userId))
        {
            await Groups.RemoveFromGroupAsync(
                Context.ConnectionId,
                ChatConstants.UserGroupName(userId));
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task<ChatMessageDto> SendMessage(Guid threadId, SendChatMessageRequest request)
    {
        var userId = RequireUserId();

        return await GuardAsync(() => _chats.SendMessageAsync(
            userId,
            threadId,
            request ?? new SendChatMessageRequest(),
            Context.ConnectionAborted));
    }

    public async Task Typing(Guid threadId, bool isTyping)
    {
        var userId = RequireUserId();

        await GuardAsync(async () =>
        {
            await _chats.NotifyTypingAsync(userId, threadId, isTyping, Context.ConnectionAborted);
            return true;
        });
    }

    public async Task MarkRead(Guid threadId)
    {
        var userId = RequireUserId();
        await GuardAsync(() => _chats.MarkReadAsync(userId, threadId, Context.ConnectionAborted));
    }

    private static async Task<T> GuardAsync<T>(Func<Task<T>> action)
    {
        try
        {
            return await action();
        }
        catch (NotFoundException)
        {
            throw new HubException("Chat thread not found.");
        }
        catch (ForbiddenAppException)
        {
            throw new HubException("You are not a participant of this chat thread.");
        }
        catch (AppException ex)
        {
            throw new HubException(ex.Message);
        }
    }

    private bool TryGetUserId(out Guid userId)
    {
        userId = Guid.Empty;
        return Context.User is not null && Context.User.TryGetUserId(out userId);
    }

    private Guid RequireUserId()
        => TryGetUserId(out var userId) ? userId : throw new HubException("Unauthorized.");
}
