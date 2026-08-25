using AIDR.Shared.Dtos.Order;

namespace AIDR.Modules.Order.Abstractions;

public interface IOrderRepository
{
    Task<CreateOrderResponse> CreateOrdersFromCartAsync(
        Guid buyerUserId,
        Guid shippingAddressId,
        IReadOnlyCollection<Guid>? cartItemIds,
        string? buyerNote,
        CancellationToken cancellationToken = default);
}
