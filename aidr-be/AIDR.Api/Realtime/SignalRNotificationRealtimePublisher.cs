using AIDR.Api.Hubs;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Engagement;
using Microsoft.AspNetCore.SignalR;

namespace AIDR.Api.Realtime;

public sealed class SignalRNotificationRealtimePublisher : INotificationRealtimePublisher
{
    private readonly IHubContext<NotificationHub> _hub;

    public SignalRNotificationRealtimePublisher(IHubContext<NotificationHub> hub) => _hub = hub;

    public Task PublishCreatedAsync(
        Guid userId,
        NotificationDto notification,
        CancellationToken cancellationToken = default)
        => _hub.Clients
            .Group(NotificationConstants.UserGroupName(userId))
            .SendAsync(NotificationConstants.HubReceiveMethod, notification, cancellationToken);
}
