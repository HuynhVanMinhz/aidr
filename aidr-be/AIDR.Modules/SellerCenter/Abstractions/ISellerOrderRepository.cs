using AIDR.Shared.Dtos.Seller;

namespace AIDR.Modules.SellerCenter.Abstractions;

public interface ISellerOrderRepository
{
    Task<(IReadOnlyList<SellerOrderListItemDto> Items, int TotalCount, int EffectivePage)> ListByShopAsync(
        Guid shopId,
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<SellerOrderDetailDto?> GetByIdForShopAsync(
        Guid shopId,
        Guid orderId,
        CancellationToken cancellationToken = default);

    Task<SellerOrderDetailDto> UpdateStatusAsync(
        Guid shopId,
        Guid orderId,
        Guid sellerUserId,
        string toStatus,
        string? trackingCode,
        string? sellerNote,
        string? historyNote,
        CancellationToken cancellationToken = default);
}
