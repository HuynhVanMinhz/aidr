using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Engagement.Services;

public sealed class PriceAlertService : IPriceAlertService
{
    private readonly IPriceAlertRepository _alerts;
    private readonly INotificationService _notifications;
    private readonly INotificationRepository _notificationRepository;

    public PriceAlertService(
        IPriceAlertRepository alerts,
        INotificationService notifications,
        INotificationRepository notificationRepository)
    {
        _alerts = alerts;
        _notifications = notifications;
        _notificationRepository = notificationRepository;
    }

    public Task<PagedResult<PriceAlertDto>> ListAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var (normalizedPage, normalizedSize) = PriceAlertConstants.NormalizePaging(page, pageSize);
        return _alerts.ListAsync(userId, normalizedPage, normalizedSize, cancellationToken);
    }

    public Task<ProductPriceAlertStatusDto> GetStatusAsync(
        Guid userId,
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        if (productId == Guid.Empty)
            throw new AppException("Product id is required.");

        return _alerts.GetStatusAsync(userId, productId, cancellationToken);
    }

    public async Task<PriceAlertDto> CreateOrUpdateAsync(
        Guid userId,
        CreatePriceAlertRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.ProductId == Guid.Empty)
            throw new AppException("Product id is required.");

        if (string.IsNullOrWhiteSpace(request.AlertType))
            throw new AppException("Alert type is required.");

        if (!PriceAlertConstants.AllowedAlertTypes.Contains(request.AlertType))
            throw new AppException("Alert type is invalid.");

        if (request.ThresholdPct is < 0 or > 100)
            throw new AppException("Threshold percent must be between 0 and 100.");

        if (request.ThresholdAmount is < 0)
            throw new AppException("Threshold amount must not be negative.");

        var product = await _alerts.GetAlertableProductAsync(request.ProductId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        EnsureAlertable(product);

        if (string.Equals(
                PriceAlertConstants.CanonicalAlertType(request.AlertType),
                PriceAlertConstants.AlertTypeBackInStock,
                StringComparison.OrdinalIgnoreCase)
            && product.AvailableQuantity > 0)
        {
            throw new ConflictException("Back-in-stock alerts can only be set when the product is out of stock.");
        }

        return await _alerts.UpsertAsync(userId, request, cancellationToken);
    }

    public async Task<RemovePriceAlertResponse> RemoveAsync(
        Guid userId,
        Guid priceAlertId,
        CancellationToken cancellationToken = default)
    {
        if (priceAlertId == Guid.Empty)
            throw new AppException("Price alert id is required.");

        return await _alerts.RemoveAsync(userId, priceAlertId, cancellationToken)
            ?? throw new NotFoundException("Price alert not found.");
    }

    public async Task<RemovePriceAlertResponse> RemoveByProductAsync(
        Guid userId,
        Guid productId,
        string alertType,
        CancellationToken cancellationToken = default)
    {
        if (productId == Guid.Empty)
            throw new AppException("Product id is required.");

        if (string.IsNullOrWhiteSpace(alertType))
            throw new AppException("Alert type is required.");

        return await _alerts.RemoveByProductAsync(userId, productId, alertType, cancellationToken)
            ?? throw new NotFoundException("Price alert not found.");
    }

    public async Task<int> RunSweepAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        await _alerts.DeactivateExpiredAsync(now, cancellationToken);

        var rows = await _alerts.ListActiveForSweepAsync(cancellationToken);
        var triggered = 0;
        var dedupeSince = now.AddHours(-PriceAlertConstants.NotificationDedupeHours);

        foreach (var row in rows)
        {
            if (ShouldTriggerPriceDrop(row) || ShouldTriggerBackInStock(row))
            {
                if (row.LastTriggeredAt.HasValue && row.LastTriggeredAt.Value >= dedupeSince)
                    continue;

                var recent = await _notificationRepository.HasRecentUnreadAsync(
                    row.UserId,
                    NotificationConstants.TypePromo,
                    NotificationConstants.RefProduct,
                    row.ProductId,
                    dedupeSince,
                    cancellationToken);

                if (recent)
                    continue;

                var (title, body) = BuildNotificationCopy(row);
                await _notifications.CreateAsync(
                    new CreateNotificationRequest
                    {
                        UserId = row.UserId,
                        Title = title,
                        Body = body,
                        Type = NotificationConstants.TypePromo,
                        ReferenceType = NotificationConstants.RefProduct,
                        ReferenceId = row.ProductId
                    },
                    cancellationToken);

                decimal? newBaseline = string.Equals(
                    row.AlertType,
                    PriceAlertConstants.AlertTypePriceDrop,
                    StringComparison.OrdinalIgnoreCase)
                    ? row.CurrentPrice
                    : null;

                await _alerts.MarkTriggeredAsync(row.PriceAlertId, now, newBaseline, cancellationToken);
                triggered++;
            }
        }

        return triggered;
    }

    private static void EnsureAlertable(PriceAlertProductSnapshot product)
    {
        if (!string.Equals(product.Status, WishlistConstants.ApprovedStatus, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Only approved products can have price alerts.");

        if (!string.Equals(product.ShopStatus, WishlistConstants.ActiveShopStatus, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("This shop is not active.");
    }

    private static bool ShouldTriggerPriceDrop(PriceAlertSweepRow row)
    {
        if (!string.Equals(row.AlertType, PriceAlertConstants.AlertTypePriceDrop, StringComparison.OrdinalIgnoreCase))
            return false;

        if (row.BaselinePrice is null or <= 0)
            return false;

        var drop = row.BaselinePrice.Value - row.CurrentPrice;
        if (drop <= 0)
            return false;

        var pctThreshold = row.BaselinePrice.Value * (row.ThresholdPct / 100m);
        var amountThreshold = row.ThresholdAmount;
        return drop >= Math.Max(pctThreshold, amountThreshold);
    }

    private static bool ShouldTriggerBackInStock(PriceAlertSweepRow row)
    {
        if (!string.Equals(row.AlertType, PriceAlertConstants.AlertTypeBackInStock, StringComparison.OrdinalIgnoreCase))
            return false;

        return row.AvailableQuantity > 0 && row.LastTriggeredAt is null;
    }

    private static (string Title, string Body) BuildNotificationCopy(PriceAlertSweepRow row)
    {
        var name = Truncate(row.ProductName, 120);

        if (string.Equals(row.AlertType, PriceAlertConstants.AlertTypeBackInStock, StringComparison.OrdinalIgnoreCase))
        {
            return (
                "Back in stock",
                $"{Truncate(row.ProductName, 200)} is available again.");
        }

        var oldPrice = row.BaselinePrice ?? row.CurrentPrice;
        return (
            "Price drop alert",
            $"{Truncate(row.ProductName, 160)} is now {FormatVnd(row.CurrentPrice)} (was {FormatVnd(oldPrice)}).");
    }

    private static string FormatVnd(decimal amount) =>
        $"{amount:N0} VND";

    private static string Truncate(string value, int max)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= max)
            return value;
        return value[..(max - 1)] + "…";
    }
}
