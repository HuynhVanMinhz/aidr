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
        Guid threadId,
        ChatMessageDto message,
        CancellationToken cancellationToken = default)
        => _hub.Clients
            .Group(ChatConstants.ThreadGroupName(threadId))
            .SendAsync(ChatConstants.HubReceiveMethod, message, cancellationToken);
}
