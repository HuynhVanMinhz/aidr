using AIDR.Shared.Dtos.Order;

namespace AIDR.Modules.Order.Abstractions;

public interface IOrderRepository
{
    Task<CreateOrderResponse> CreateOrdersFromCartAsync(
        Guid buyerUserId,
        Guid shippingAddressId,
        IReadOnlyCollection<Guid>? cartItemIds,
        string? buyerNote,
        IReadOnlyDictionary<Guid, Guid>? vouchersByShopId,
        CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<BuyerOrderListItemDto> Items, int TotalCount, int EffectivePage)> ListBuyerOrdersAsync(
        Guid buyerUserId,
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<BuyerOrderDetailDto?> GetBuyerOrderAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default);

    Task<BuyerOrderDetailDto> CancelBuyerOrderAsync(
        Guid buyerUserId,
        Guid orderId,
        string? reason,
        CancellationToken cancellationToken = default);

    Task<BuyerOrderDetailDto> ConfirmReceivedAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default);
}
