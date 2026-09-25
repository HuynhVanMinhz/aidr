using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Engagement;

public sealed class NotificationRepository : INotificationRepository
{
    private readonly AidrDbContext _db;

    public NotificationRepository(AidrDbContext db) => _db = db;

    public async Task<PagedResult<NotificationDto>> ListAsync(
        Guid userId,
        int page,
        int pageSize,
        bool? unreadOnly,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == userId);

        if (unreadOnly == true)
            query = query.Where(n => !n.IsRead);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new NotificationDto
            {
                NotificationId = n.NotificationId,
                Title = n.Title,
                Body = n.Body,
                Type = n.Type,
                ReferenceType = n.ReferenceType,
                ReferenceId = n.ReferenceId,
                ImageUrl = n.ImageUrl,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return new PagedResult<NotificationDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public Task<int> CountUnreadAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
        => _db.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead, cancellationToken);

    public Task<NotificationDto?> GetOwnedAsync(
        Guid userId,
        Guid notificationId,
        CancellationToken cancellationToken = default)
        => _db.Notifications
            .AsNoTracking()
            .Where(n => n.NotificationId == notificationId && n.UserId == userId)
            .Select(n => new NotificationDto
            {
                NotificationId = n.NotificationId,
                Title = n.Title,
                Body = n.Body,
                Type = n.Type,
                ReferenceType = n.ReferenceType,
                ReferenceId = n.ReferenceId,
                ImageUrl = n.ImageUrl,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            })
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<NotificationDto> CreateAsync(
        CreateNotificationRequest request,
        CancellationToken cancellationToken = default)
    {
        var entity = new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = request.UserId,
            Title = request.Title,
            Body = request.Body,
            Type = request.Type,
            ReferenceType = request.ReferenceType,
            ReferenceId = request.ReferenceId,
            ImageUrl = request.ImageUrl,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _db.Notifications.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        return Map(entity);
    }

    public Task<bool> HasRecentUnreadAsync(
        Guid userId,
        string type,
        string referenceType,
        Guid referenceId,
        DateTime createdAfterUtc,
        CancellationToken cancellationToken = default)
        => _db.Notifications.AsNoTracking().AnyAsync(
            n => n.UserId == userId
                 && !n.IsRead
                 && n.Type == type
                 && n.ReferenceType == referenceType
                 && n.ReferenceId == referenceId
                 && n.CreatedAt >= createdAfterUtc,
            cancellationToken);

    public async Task<NotificationDto?> TryUpdateUnreadAsync(
        Guid userId,
        string type,
        string referenceType,
        Guid referenceId,
        string title,
        string body,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.Notifications
            .Where(n => n.UserId == userId
                        && !n.IsRead
                        && n.Type == type
                        && n.ReferenceType == referenceType
                        && n.ReferenceId == referenceId)
            .OrderByDescending(n => n.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (entity is null)
            return null;

        entity.Title = title;
        entity.Body = body;
        entity.CreatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return Map(entity);
    }

    public async Task<NotificationDto?> MarkReadAsync(
        Guid userId,
        Guid notificationId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.Notifications
            .FirstOrDefaultAsync(
                n => n.NotificationId == notificationId && n.UserId == userId,
                cancellationToken);

        if (entity is null)
            return null;

        if (!entity.IsRead)
        {
            entity.IsRead = true;
            await _db.SaveChangesAsync(cancellationToken);
        }

        return Map(entity);
    }

    public async Task<int> MarkAllReadAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var unread = await _db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync(cancellationToken);

        if (unread.Count == 0)
            return 0;

        foreach (var item in unread)
            item.IsRead = true;

        await _db.SaveChangesAsync(cancellationToken);
        return unread.Count;
    }

    public async Task<bool> DeleteAsync(
        Guid userId,
        Guid notificationId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.Notifications
            .FirstOrDefaultAsync(
                n => n.NotificationId == notificationId && n.UserId == userId,
                cancellationToken);

        if (entity is null)
            return false;

        _db.Notifications.Remove(entity);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static NotificationDto Map(Notification n) => new()
    {
        NotificationId = n.NotificationId,
        Title = n.Title,
        Body = n.Body,
        Type = n.Type,
        ReferenceType = n.ReferenceType,
        ReferenceId = n.ReferenceId,
        ImageUrl = n.ImageUrl,
        IsRead = n.IsRead,
        CreatedAt = n.CreatedAt
    };
}
