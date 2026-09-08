using AIDR.Shared.Dtos.Order;

namespace AIDR.Modules.Order.Abstractions;

public interface IOrderService
{
    Task<CreateOrderResponse> CreateOrderAsync(
        Guid buyerUserId,
        CreateOrderRequest request,
        CancellationToken cancellationToken = default);

    Task<BuyerOrderListResultDto> ListBuyerOrdersAsync(
        Guid buyerUserId,
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<BuyerOrderDetailDto> GetBuyerOrderAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default);

    Task<BuyerOrderDetailDto> CancelBuyerOrderAsync(
        Guid buyerUserId,
        Guid orderId,
        CancelOrderRequest request,
        CancellationToken cancellationToken = default);

    Task<BuyerOrderDetailDto> ConfirmReceivedAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default);

    Task<ReorderOrderResponse> ReorderAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default);
}
