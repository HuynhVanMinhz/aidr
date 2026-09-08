using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;

namespace AIDR.Modules.Engagement.Abstractions;

public sealed class PriceAlertProductSnapshot
{
    public Guid ProductId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? PrimaryImageUrl { get; init; }
    public string Status { get; init; } = null!;
    public string ShopStatus { get; init; } = null!;
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public int StockQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public decimal EffectivePrice => SalePrice ?? BasePrice;
    public int AvailableQuantity => Math.Max(0, StockQuantity - ReservedQuantity);
}

public interface IPriceAlertRepository
{
    Task<PagedResult<PriceAlertDto>> ListAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<ProductPriceAlertStatusDto> GetStatusAsync(
        Guid userId,
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<PriceAlertProductSnapshot?> GetAlertableProductAsync(
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<PriceAlertDto> UpsertAsync(
        Guid userId,
        CreatePriceAlertRequest request,
        CancellationToken cancellationToken = default);

    Task<RemovePriceAlertResponse?> RemoveAsync(
        Guid userId,
        Guid priceAlertId,
        CancellationToken cancellationToken = default);

    Task<RemovePriceAlertResponse?> RemoveByProductAsync(
        Guid userId,
        Guid productId,
        string alertType,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PriceAlertSweepRow>> ListActiveForSweepAsync(
        CancellationToken cancellationToken = default);

    Task MarkTriggeredAsync(
        Guid priceAlertId,
        DateTime triggeredAt,
        decimal? newBaselinePrice,
        CancellationToken cancellationToken = default);

    Task DeactivateExpiredAsync(DateTime now, CancellationToken cancellationToken = default);
}

public sealed class PriceAlertSweepRow
{
    public Guid PriceAlertId { get; init; }
    public Guid UserId { get; init; }
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public string AlertType { get; init; } = null!;
    public decimal? BaselinePrice { get; init; }
    public decimal ThresholdPct { get; init; }
    public decimal ThresholdAmount { get; init; }
    public DateTime? LastTriggeredAt { get; init; }
    public decimal CurrentPrice { get; init; }
    public int AvailableQuantity { get; init; }
}

public interface IPriceAlertService
{
    Task<PagedResult<PriceAlertDto>> ListAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<ProductPriceAlertStatusDto> GetStatusAsync(
        Guid userId,
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<PriceAlertDto> CreateOrUpdateAsync(
        Guid userId,
        CreatePriceAlertRequest request,
        CancellationToken cancellationToken = default);

    Task<RemovePriceAlertResponse> RemoveAsync(
        Guid userId,
        Guid priceAlertId,
        CancellationToken cancellationToken = default);

    Task<RemovePriceAlertResponse> RemoveByProductAsync(
        Guid userId,
        Guid productId,
        string alertType,
        CancellationToken cancellationToken = default);

    Task<int> RunSweepAsync(CancellationToken cancellationToken = default);
}

public interface IProductPriceHistoryService
{
    Task<ProductPriceHistoryDto> GetHistoryAsync(
        Guid productId,
        int days,
        CancellationToken cancellationToken = default);
}
