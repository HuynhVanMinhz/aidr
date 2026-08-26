using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;

namespace AIDR.Modules.Engagement.Abstractions;

public interface INotificationRepository
{
    Task<PagedResult<NotificationDto>> ListAsync(
        Guid userId,
        int page,
        int pageSize,
        bool? unreadOnly,
        CancellationToken cancellationToken = default);

    Task<int> CountUnreadAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<NotificationDto?> GetOwnedAsync(
        Guid userId,
        Guid notificationId,
        CancellationToken cancellationToken = default);

    Task<NotificationDto> CreateAsync(
        CreateNotificationRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// True if an unread System notification for this product exists within the lookback window.
    /// </summary>
    Task<bool> HasRecentUnreadAsync(
        Guid userId,
        string type,
        string referenceType,
        Guid referenceId,
        DateTime createdAfterUtc,
        CancellationToken cancellationToken = default);

    Task<NotificationDto?> MarkReadAsync(
        Guid userId,
        Guid notificationId,
        CancellationToken cancellationToken = default);

    Task<int> MarkAllReadAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteAsync(
        Guid userId,
        Guid notificationId,
        CancellationToken cancellationToken = default);
}
