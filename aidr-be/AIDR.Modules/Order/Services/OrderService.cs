using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Order.Services;

public sealed class OrderService : IOrderService
{
    private readonly IOrderRepository _orders;

    public OrderService(IOrderRepository orders) => _orders = orders;

    public async Task<CreateOrderResponse> CreateOrderAsync(
        Guid buyerUserId,
        CreateOrderRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.ShippingAddressId == Guid.Empty)
            throw new AppException("Shipping address is required.");

        var buyerNote = request.BuyerNote?.Trim();
        if (buyerNote is { Length: > OrderConstants.MaxBuyerNoteLength })
            throw new AppException($"Buyer note must not exceed {OrderConstants.MaxBuyerNoteLength} characters.");

        IReadOnlyCollection<Guid>? cartItemIds = null;
        if (request.CartItemIds is { Count: > 0 })
        {
            cartItemIds = request.CartItemIds
                .Where(id => id != Guid.Empty)
                .Distinct()
                .ToList();

            if (cartItemIds.Count == 0)
                throw new AppException("Cart item ids are invalid.");
        }

        return await _orders.CreateOrdersFromCartAsync(
            buyerUserId,
            request.ShippingAddressId,
            cartItemIds,
            string.IsNullOrWhiteSpace(buyerNote) ? null : buyerNote,
            cancellationToken);
    }
}
