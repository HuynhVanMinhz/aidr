using AIDR.Api.Hubs;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Engagement;
using Microsoft.AspNetCore.SignalR;

namespace AIDR.Api.Realtime;

public sealed class SignalRChatRealtimePublisher : IChatRealtimePublisher
{
    private readonly IHubContext<ChatHub> _hub;

    public SignalRChatRealtimePublisher(IHubContext<ChatHub> hub) => _hub = hub;

    public Task PublishMessageAsync(
        ChatMessageDto message,
        IReadOnlyCollection<Guid> recipientUserIds,
        CancellationToken cancellationToken = default)
    {
        // IsMine is per-recipient, so each user group gets its own copy of the payload.
        var sends = Distinct(recipientUserIds).Select(userId => _hub.Clients
            .Group(ChatConstants.UserGroupName(userId))
            .SendAsync(
                ChatConstants.HubReceiveMethod,
                Personalize(message, userId),
                cancellationToken));

        return Task.WhenAll(sends);
    }

    public Task PublishThreadReadAsync(
        ChatThreadReadEvent readEvent,
        IReadOnlyCollection<Guid> recipientUserIds,
        CancellationToken cancellationToken = default)
        => SendToUsersAsync(
            ChatConstants.HubThreadReadMethod,
            readEvent,
            recipientUserIds,
            cancellationToken);

    public Task PublishTypingAsync(
        ChatTypingEvent typingEvent,
        IReadOnlyCollection<Guid> recipientUserIds,
        CancellationToken cancellationToken = default)
        => SendToUsersAsync(
            ChatConstants.HubTypingMethod,
            typingEvent,
            recipientUserIds,
            cancellationToken);

    private Task SendToUsersAsync(
        string method,
        object payload,
        IReadOnlyCollection<Guid> recipientUserIds,
        CancellationToken cancellationToken)
    {
        var sends = Distinct(recipientUserIds).Select(userId => _hub.Clients
            .Group(ChatConstants.UserGroupName(userId))
            .SendAsync(method, payload, cancellationToken));

        return Task.WhenAll(sends);
    }

    private static IEnumerable<Guid> Distinct(IReadOnlyCollection<Guid>? userIds)
        => (userIds ?? Array.Empty<Guid>()).Where(id => id != Guid.Empty).Distinct();

    private static ChatMessageDto Personalize(ChatMessageDto message, Guid userId)
        => new()
        {
            MessageId = message.MessageId,
            ThreadId = message.ThreadId,
            SenderUserId = message.SenderUserId,
            SenderFullName = message.SenderFullName,
            SenderAvatarUrl = message.SenderAvatarUrl,
            Content = message.Content,
            AttachmentUrl = message.AttachmentUrl,
            IsRead = message.IsRead,
            IsMine = message.SenderUserId == userId,
            CreatedAt = message.CreatedAt
        };
}
