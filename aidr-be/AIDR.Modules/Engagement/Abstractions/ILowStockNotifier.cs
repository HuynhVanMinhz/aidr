using AIDR.Shared.Dtos.Engagement;

namespace AIDR.Modules.Engagement.Abstractions;

/// <summary>
/// Edge-trigger low-stock alerts for sellers (System + Product reference).
/// </summary>
public interface ILowStockNotifier
{
    /// <summary>
    /// When <paramref name="wasLowStock"/> is false and the product is now at/below threshold,
    /// create a System notification for the shop owner (deduped ~24h). Never throws to callers.
    /// </summary>
    Task TryNotifyIfBecameLowAsync(
        Guid productId,
        bool wasLowStock,
        CancellationToken cancellationToken = default);
}
