using AIDR.Shared.Dtos.Seller;

namespace AIDR.Modules.SellerCenter.Abstractions;

public sealed class ImportLotWriteModel
{
    /// <summary>Required once the product has variants: stock belongs to a configuration, not a name.</summary>
    public Guid? VariantId { get; init; }
    public string? LotCode { get; init; }
    public int Quantity { get; init; }
    public decimal UnitCost { get; init; }
    public string? SupplierName { get; init; }
    public string? InvoiceNumber { get; init; }
    public DateTime ReceivedAt { get; init; }
    public DateTime? ExpiresAt { get; init; }
    public string? Note { get; init; }
    public Guid CreatedBy { get; init; }
}

public sealed class AdjustInventoryWriteModel
{
    /// <summary>Required once the product has variants; ignored when a specific lot is named.</summary>
    public Guid? VariantId { get; init; }
    public int ChangeQty { get; init; }
    public Guid? LotId { get; init; }
    public string? Note { get; init; }
    public Guid CreatedBy { get; init; }
}

public sealed class UpdateSellingPriceWriteModel
{
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public string? Reason { get; init; }
    public Guid ChangedBy { get; init; }
}

public interface ISellerInventoryRepository
{
    Task<(IReadOnlyList<SellerInventoryListItemDto> Items, int TotalCount, SellerInventorySummaryDto Summary)>
        ListByShopAsync(
            Guid shopId,
            string? keyword,
            bool? lowStockOnly,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<SellerStockImportListItemDto> Items, int TotalCount, SellerStockImportSummaryDto Summary)>
        ListImportsByShopAsync(
            Guid shopId,
            string? keyword,
            string? status,
            DateTime? fromUtc,
            DateTime? toUtcExclusive,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default);

    Task<SellerInventoryDetailDto?> GetDetailAsync(
        Guid shopId,
        Guid productId,
        int transactionLimit,
        CancellationToken cancellationToken = default);

    Task<string?> GetProductStatusAsync(
        Guid shopId,
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<SellerInventoryDetailDto> ImportLotAsync(
        Guid shopId,
        Guid productId,
        ImportLotWriteModel model,
        CancellationToken cancellationToken = default);

    Task<SellerInventoryDetailDto> AdjustAsync(
        Guid shopId,
        Guid productId,
        AdjustInventoryWriteModel model,
        CancellationToken cancellationToken = default);

    Task<SellerInventoryDetailDto> UpdateLowStockThresholdAsync(
        Guid shopId,
        Guid productId,
        int lowStockThreshold,
        CancellationToken cancellationToken = default);

    Task<SellerPriceUpdateDto> UpdateSellingPriceAsync(
        Guid shopId,
        Guid productId,
        UpdateSellingPriceWriteModel model,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RestockAdviceItemDto>> GetRestockAdviceAsync(
        Guid shopId,
        int salesWindowDays,
        CancellationToken cancellationToken = default);
}
