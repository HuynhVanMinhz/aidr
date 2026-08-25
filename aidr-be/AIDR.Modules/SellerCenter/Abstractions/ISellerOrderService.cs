using AIDR.Shared.Dtos.Seller;

namespace AIDR.Modules.SellerCenter.Abstractions;

public interface ISellerOrderService
{
    Task<SellerOrderListResultDto> ListAsync(
        Guid ownerUserId,
        SellerOrderQueryRequest request,
        CancellationToken cancellationToken = default);

    Task<SellerOrderDetailDto> GetByIdAsync(
        Guid ownerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default);

    Task<SellerOrderDetailDto> UpdateStatusAsync(
        Guid ownerUserId,
        Guid orderId,
        UpdateSellerOrderRequest request,
        CancellationToken cancellationToken = default);
}
