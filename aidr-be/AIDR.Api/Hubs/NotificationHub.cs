using AIDR.Api.Extensions;
using AIDR.Shared.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace AIDR.Api.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        if (Context.User is not null && Context.User.TryGetUserId(out var userId))
        {
            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                NotificationConstants.UserGroupName(userId));
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (Context.User is not null && Context.User.TryGetUserId(out var userId))
        {
            await Groups.RemoveFromGroupAsync(
                Context.ConnectionId,
                NotificationConstants.UserGroupName(userId));
        }

        await base.OnDisconnectedAsync(exception);
    }
}
