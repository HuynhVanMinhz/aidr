using AIDR.Shared.Dtos.Seller;

namespace AIDR.Modules.SellerCenter.Abstractions;

public interface ISellerInventoryService
{
    Task<SellerInventoryListResult> ListAsync(
        Guid ownerUserId,
        SellerInventoryQueryRequest request,
        CancellationToken cancellationToken = default);

    Task<SellerInventoryDetailDto> GetByProductIdAsync(
        Guid ownerUserId,
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<SellerInventoryDetailDto> UpdateLowStockThresholdAsync(
        Guid ownerUserId,
        Guid productId,
        UpdateSellerInventoryRequest request,
        CancellationToken cancellationToken = default);

    Task<SellerInventoryDetailDto> AdjustAsync(
        Guid ownerUserId,
        Guid productId,
        AdjustSellerInventoryRequest request,
        CancellationToken cancellationToken = default);

    Task<SellerInventoryDetailDto> ImportLotAsync(
        Guid ownerUserId,
        Guid productId,
        ImportStockLotRequest request,
        CancellationToken cancellationToken = default);

    Task<SellerPriceUpdateDto> UpdateSellingPriceAsync(
        Guid ownerUserId,
        Guid productId,
        UpdateSellingPriceRequest request,
        CancellationToken cancellationToken = default);

    Task<RestockAdviceResultDto> GetRestockAdviceAsync(
        Guid ownerUserId,
        int salesWindowDays,
        CancellationToken cancellationToken = default);
}
