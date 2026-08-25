using AIDR.Shared.Dtos.Order;

namespace AIDR.Modules.Order.Abstractions;

public interface ICartService
{
    Task<CartResponse> GetCartAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<CartResponse> AddItemAsync(
        Guid userId,
        AddCartItemRequest request,
        CancellationToken cancellationToken = default);

    Task<CartResponse> UpdateItemQuantityAsync(
        Guid userId,
        Guid cartItemId,
        UpdateCartItemRequest request,
        CancellationToken cancellationToken = default);

    Task<CartResponse> RemoveItemAsync(
        Guid userId,
        Guid cartItemId,
        CancellationToken cancellationToken = default);
}
