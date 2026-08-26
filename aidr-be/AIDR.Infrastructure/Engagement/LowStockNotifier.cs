using AIDR.Infrastructure.Persistence;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Engagement;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AIDR.Infrastructure.Engagement;

public sealed class LowStockNotifier : ILowStockNotifier
{
    private readonly AidrDbContext _db;
    private readonly INotificationService _notifications;
    private readonly INotificationRepository _notificationRepository;
    private readonly ILogger<LowStockNotifier> _logger;

    public LowStockNotifier(
        AidrDbContext db,
        INotificationService notifications,
        INotificationRepository notificationRepository,
        ILogger<LowStockNotifier> logger)
    {
        _db = db;
        _notifications = notifications;
        _notificationRepository = notificationRepository;
        _logger = logger;
    }

    public async Task TryNotifyIfBecameLowAsync(
        Guid productId,
        bool wasLowStock,
        CancellationToken cancellationToken = default)
    {
        if (wasLowStock || productId == Guid.Empty)
            return;

        try
        {
            var row = await _db.Products.AsNoTracking()
                .Where(p => p.ProductId == productId)
                .Select(p => new
                {
                    p.ProductId,
                    p.Name,
                    p.StockQuantity,
                    p.ReservedQuantity,
                    p.LowStockThreshold,
                    OwnerUserId = p.Shop.OwnerUserId
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (row is null || row.OwnerUserId == Guid.Empty)
                return;

            var available = Math.Max(0, row.StockQuantity - row.ReservedQuantity);
            if (available > row.LowStockThreshold)
                return;

            var since = DateTime.UtcNow.AddHours(-NotificationConstants.LowStockDedupeHours);
            var recent = await _notificationRepository.HasRecentUnreadAsync(
                row.OwnerUserId,
                NotificationConstants.TypeSystem,
                NotificationConstants.RefProduct,
                row.ProductId,
                since,
                cancellationToken);

            if (recent)
                return;

            var unitLabel = available == 1 ? "unit" : "units";
            await _notifications.CreateAsync(
                new CreateNotificationRequest
                {
                    UserId = row.OwnerUserId,
                    Title = $"Low stock: {Truncate(row.Name, 120)}",
                    Body =
                        $"{Truncate(row.Name, 200)} has {available} {unitLabel} left (threshold {row.LowStockThreshold}).",
                    Type = NotificationConstants.TypeSystem,
                    ReferenceType = NotificationConstants.RefProduct,
                    ReferenceId = row.ProductId
                },
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to notify seller about low stock for product {ProductId}", productId);
        }
    }

    private static string Truncate(string value, int max)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= max)
            return value;
        return value[..(max - 1)] + "…";
    }
}
