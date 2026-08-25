using AIDR.Api.Extensions;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController : ControllerBase
{
    private readonly INotificationService _notifications;

    public NotificationsController(INotificationService notifications) => _notifications = notifications;

    /// <summary>List the current user's notifications, newest first (paged).</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<PagedResult<NotificationDto>>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool? unreadOnly = null,
        CancellationToken cancellationToken = default)
    {
        var result = await _notifications.ListAsync(
            User.GetUserId(),
            page,
            pageSize,
            unreadOnly,
            cancellationToken);
        return Ok(ApiResult<PagedResult<NotificationDto>>.Ok(result));
    }

    /// <summary>Get unread notification count for the current user.</summary>
    [HttpGet("unread-count")]
    public async Task<ActionResult<ApiResult<NotificationUnreadCountDto>>> UnreadCount(
        CancellationToken cancellationToken = default)
    {
        var result = await _notifications.GetUnreadCountAsync(User.GetUserId(), cancellationToken);
        return Ok(ApiResult<NotificationUnreadCountDto>.Ok(result));
    }

    /// <summary>Mark a single notification as read.</summary>
    [HttpPost("{notificationId:guid}/read")]
    public async Task<ActionResult<ApiResult<NotificationDto>>> MarkRead(
        Guid notificationId,
        CancellationToken cancellationToken)
    {
        var result = await _notifications.MarkReadAsync(
            User.GetUserId(),
            notificationId,
            cancellationToken);
        return Ok(ApiResult<NotificationDto>.Ok(result, "Notification marked as read."));
    }

    /// <summary>Mark all notifications as read for the current user.</summary>
    [HttpPost("read-all")]
    public async Task<ActionResult<ApiResult<MarkAllNotificationsReadResponse>>> MarkAllRead(
        CancellationToken cancellationToken)
    {
        var result = await _notifications.MarkAllReadAsync(User.GetUserId(), cancellationToken);
        return Ok(ApiResult<MarkAllNotificationsReadResponse>.Ok(result, "All notifications marked as read."));
    }

    /// <summary>Delete a notification owned by the current user.</summary>
    [HttpDelete("{notificationId:guid}")]
    public async Task<ActionResult<ApiResult<DeleteNotificationResponse>>> Delete(
        Guid notificationId,
        CancellationToken cancellationToken)
    {
        var result = await _notifications.DeleteAsync(
            User.GetUserId(),
            notificationId,
            cancellationToken);
        return Ok(ApiResult<DeleteNotificationResponse>.Ok(result, "Notification deleted."));
    }
}
