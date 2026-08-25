using AIDR.Shared.Dtos.Order;

namespace AIDR.Modules.Order.Abstractions;

public interface IOrderService
{
    Task<CreateOrderResponse> CreateOrderAsync(
        Guid buyerUserId,
        CreateOrderRequest request,
        CancellationToken cancellationToken = default);
}
