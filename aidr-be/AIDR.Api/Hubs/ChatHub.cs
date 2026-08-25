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

    public async Task JoinThread(Guid threadId)
    {
        if (Context.User is null || !Context.User.TryGetUserId(out var userId))
            throw new HubException("Unauthorized.");

        try
        {
            await _chats.EnsureThreadParticipantAsync(userId, threadId, Context.ConnectionAborted);
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

        await Groups.AddToGroupAsync(
            Context.ConnectionId,
            ChatConstants.ThreadGroupName(threadId));
    }

    public Task LeaveThread(Guid threadId)
        => Groups.RemoveFromGroupAsync(
            Context.ConnectionId,
            ChatConstants.ThreadGroupName(threadId));

    public async Task<ChatMessageDto> SendMessage(Guid threadId, SendChatMessageRequest request)
    {
        if (Context.User is null || !Context.User.TryGetUserId(out var userId))
            throw new HubException("Unauthorized.");

        try
        {
            return await _chats.SendMessageAsync(
                userId,
                threadId,
                request ?? new SendChatMessageRequest(),
                Context.ConnectionAborted);
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
}
