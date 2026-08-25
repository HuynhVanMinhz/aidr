namespace AIDR.Shared.Dtos.Engagement;

public sealed class NotificationDto
{
    public Guid NotificationId { get; init; }
    public string Title { get; init; } = null!;
    public string Body { get; init; } = null!;
    public string Type { get; init; } = null!;
    public string? ReferenceType { get; init; }
    public Guid? ReferenceId { get; init; }
    public bool IsRead { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class NotificationUnreadCountDto
{
    public int UnreadCount { get; init; }
}

public sealed class MarkAllNotificationsReadResponse
{
    public int UpdatedCount { get; init; }
}

public sealed class DeleteNotificationResponse
{
    public Guid NotificationId { get; init; }
}

public sealed class CreateNotificationRequest
{
    public Guid UserId { get; init; }
    public string Title { get; init; } = null!;
    public string Body { get; init; } = null!;
    public string Type { get; init; } = null!;
    public string? ReferenceType { get; init; }
    public Guid? ReferenceId { get; init; }
}
