using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;

namespace AIDR.Modules.Engagement.Services;

public sealed class NotificationService : INotificationService
{
    private readonly INotificationRepository _notifications;
    private readonly INotificationRealtimePublisher _realtime;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        INotificationRepository notifications,
        INotificationRealtimePublisher realtime,
        ILogger<NotificationService> logger)
    {
        _notifications = notifications;
        _realtime = realtime;
        _logger = logger;
    }

    public Task<PagedResult<NotificationDto>> ListAsync(
        Guid userId,
        int page,
        int pageSize,
        bool? unreadOnly,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId);
        var (normalizedPage, normalizedSize) = NotificationConstants.NormalizePaging(page, pageSize);
        return _notifications.ListAsync(userId, normalizedPage, normalizedSize, unreadOnly, cancellationToken);
    }

    public async Task<NotificationUnreadCountDto> GetUnreadCountAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId);
        var count = await _notifications.CountUnreadAsync(userId, cancellationToken);
        return new NotificationUnreadCountDto { UnreadCount = count };
    }

    public async Task<NotificationDto> MarkReadAsync(
        Guid userId,
        Guid notificationId,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId);
        EnsureNotificationId(notificationId);

        var updated = await _notifications.MarkReadAsync(userId, notificationId, cancellationToken)
            ?? throw new NotFoundException("Notification not found.");

        return updated;
    }

    public async Task<MarkAllNotificationsReadResponse> MarkAllReadAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId);
        var updatedCount = await _notifications.MarkAllReadAsync(userId, cancellationToken);
        return new MarkAllNotificationsReadResponse { UpdatedCount = updatedCount };
    }

    public async Task<DeleteNotificationResponse> DeleteAsync(
        Guid userId,
        Guid notificationId,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId);
        EnsureNotificationId(notificationId);

        var deleted = await _notifications.DeleteAsync(userId, notificationId, cancellationToken);
        if (!deleted)
            throw new NotFoundException("Notification not found.");

        return new DeleteNotificationResponse { NotificationId = notificationId };
    }

    public async Task<NotificationDto> CreateAsync(
        CreateNotificationRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request is null)
            throw new AppException("Notification body is required.");

        EnsureUserId(request.UserId);

        var title = RequireText(request.Title, "Title", NotificationConstants.MaxTitleLength);
        var body = RequireText(request.Body, "Body", NotificationConstants.MaxBodyLength);
        var type = RequireType(request.Type);

        string? referenceType = null;
        if (!string.IsNullOrWhiteSpace(request.ReferenceType))
        {
            referenceType = request.ReferenceType.Trim();
            if (referenceType.Length > NotificationConstants.MaxReferenceTypeLength)
            {
                throw new AppException(
                    $"Reference type must not exceed {NotificationConstants.MaxReferenceTypeLength} characters.");
            }
        }

        if (request.ReferenceId is { } refId && refId == Guid.Empty)
            throw new AppException("Reference id is invalid.");

        var imageUrl = NormalizeOptionalImageUrl(request.ImageUrl);

        var created = await _notifications.CreateAsync(
            new CreateNotificationRequest
            {
                UserId = request.UserId,
                Title = title,
                Body = body,
                Type = type,
                ReferenceType = referenceType,
                ReferenceId = request.ReferenceId,
                ImageUrl = imageUrl
            },
            cancellationToken);

        try
        {
            await _realtime.PublishCreatedAsync(request.UserId, created, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to push notification {NotificationId} to user {UserId} over SignalR",
                created.NotificationId,
                request.UserId);
        }

        return created;
    }

    public async Task<NotificationDto> CreateOrUpdateUnreadAsync(
        CreateNotificationRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request is null)
            throw new AppException("Notification body is required.");

        EnsureUserId(request.UserId);

        var title = RequireText(request.Title, "Title", NotificationConstants.MaxTitleLength);
        var body = RequireText(request.Body, "Body", NotificationConstants.MaxBodyLength);
        var type = RequireType(request.Type);

        string? referenceType = null;
        if (!string.IsNullOrWhiteSpace(request.ReferenceType))
        {
            referenceType = request.ReferenceType.Trim();
            if (referenceType.Length > NotificationConstants.MaxReferenceTypeLength)
            {
                throw new AppException(
                    $"Reference type must not exceed {NotificationConstants.MaxReferenceTypeLength} characters.");
            }
        }

        if (request.ReferenceId is not { } referenceId || referenceId == Guid.Empty)
            throw new AppException("Reference id is required.");

        var updated = await _notifications.TryUpdateUnreadAsync(
            request.UserId,
            type,
            referenceType ?? string.Empty,
            referenceId,
            title,
            body,
            cancellationToken);

        if (updated is not null)
        {
            try
            {
                await _realtime.PublishCreatedAsync(request.UserId, updated, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Failed to push updated notification {NotificationId} to user {UserId} over SignalR",
                    updated.NotificationId,
                    request.UserId);
            }

            return updated;
        }

        return await CreateAsync(
            new CreateNotificationRequest
            {
                UserId = request.UserId,
                Title = title,
                Body = body,
                Type = type,
                ReferenceType = referenceType,
                ReferenceId = referenceId,
                ImageUrl = NormalizeOptionalImageUrl(request.ImageUrl)
            },
            cancellationToken);
    }

    private static void EnsureUserId(Guid userId)
    {
        if (userId == Guid.Empty)
            throw new AppException("User id is required.");
    }

    private static void EnsureNotificationId(Guid notificationId)
    {
        if (notificationId == Guid.Empty)
            throw new AppException("Notification id is required.");
    }

    private static string? NormalizeOptionalImageUrl(string? imageUrl)
    {
        if (string.IsNullOrWhiteSpace(imageUrl))
            return null;

        var trimmed = imageUrl.Trim();
        if (trimmed.Length > NotificationConstants.MaxImageUrlLength)
        {
            throw new AppException(
                $"Image URL must not exceed {NotificationConstants.MaxImageUrlLength} characters.");
        }

        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new AppException("Image URL must be a valid http(s) link.");
        }

        return trimmed;
    }

    private static string RequireText(string? value, string fieldName, int maxLength)
    {
        var trimmed = value?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new AppException($"{fieldName} is required.");
        if (trimmed.Length > maxLength)
            throw new AppException($"{fieldName} must not exceed {maxLength} characters.");
        return trimmed;
    }

    private static string RequireType(string? type)
    {
        var trimmed = type?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new AppException("Notification type is required.");

        if (trimmed.Length > NotificationConstants.MaxTypeLength)
        {
            throw new AppException(
                $"Notification type must not exceed {NotificationConstants.MaxTypeLength} characters.");
        }

        if (!NotificationConstants.AllowedTypes.Contains(trimmed))
        {
            throw new AppException(
                "Notification type must be Order, Payment, Moderation, Return, Chat, System, or Promo.");
        }

        return NotificationConstants.CanonicalType(trimmed);
    }
}
