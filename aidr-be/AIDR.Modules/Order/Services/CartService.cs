using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Order.Services;

public sealed class CartService : ICartService
{
    private readonly ICartRepository _carts;

    public CartService(ICartRepository carts) => _carts = carts;

    public Task<CartResponse> GetCartAsync(Guid userId, CancellationToken cancellationToken = default)
        => _carts.GetOrCreateCartAsync(userId, cancellationToken);

    public async Task<CartResponse> AddItemAsync(
        Guid userId,
        AddCartItemRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.ProductId == Guid.Empty)
            throw new AppException("Product id is required.");

        if (request.Quantity < 1)
            throw new AppException("Quantity must be at least 1.");

        if (request.Quantity > CartConstants.MaxQuantityPerItem)
            throw new AppException($"Quantity must not exceed {CartConstants.MaxQuantityPerItem}.");

        var quantity = request.Quantity;

        var product = await _carts.GetPurchasableProductAsync(request.ProductId, cancellationToken)
            ?? throw new NotFoundException("Product is not available.");

        EnsurePurchasable(product);

        if (product.AvailableQuantity < 1)
            throw new AppException("Product is out of stock.");

        if (quantity > product.AvailableQuantity)
            throw new AppException($"Only {product.AvailableQuantity} unit(s) available.");

        return await _carts.AddOrMergeItemAsync(
            userId,
            product.ProductId,
            quantity,
            product.EffectivePrice,
            product.AvailableQuantity,
            cancellationToken);
    }

    public async Task<CartResponse> UpdateItemQuantityAsync(
        Guid userId,
        Guid cartItemId,
        UpdateCartItemRequest request,
        CancellationToken cancellationToken = default)
    {
        if (cartItemId == Guid.Empty)
            throw new AppException("Cart item id is required.");

        if (request.Quantity < 1)
            throw new AppException("Quantity must be at least 1. Use remove to delete the item.");

        if (request.Quantity > CartConstants.MaxQuantityPerItem)
            throw new AppException($"Quantity must not exceed {CartConstants.MaxQuantityPerItem}.");

        var cart = await _carts.GetOrCreateCartAsync(userId, cancellationToken);
        var item = cart.Items.FirstOrDefault(i => i.CartItemId == cartItemId)
            ?? throw new NotFoundException("Cart item not found.");

        var product = await _carts.GetPurchasableProductAsync(item.ProductId, cancellationToken)
            ?? throw new AppException("Product is no longer available.");

        EnsurePurchasable(product);

        if (request.Quantity > product.AvailableQuantity)
            throw new AppException($"Only {product.AvailableQuantity} unit(s) available.");

        return await _carts.UpdateItemQuantityAsync(
            userId,
            cartItemId,
            request.Quantity,
            product.AvailableQuantity,
            cancellationToken);
    }

    public async Task<CartResponse> RemoveItemAsync(
        Guid userId,
        Guid cartItemId,
        CancellationToken cancellationToken = default)
    {
        if (cartItemId == Guid.Empty)
            throw new AppException("Cart item id is required.");

        return await _carts.RemoveItemAsync(userId, cartItemId, cancellationToken);
    }

    private static void EnsurePurchasable(CartProductSnapshot product)
    {
        if (!string.Equals(product.Status, CartConstants.ApprovedStatus, StringComparison.OrdinalIgnoreCase))
            throw new AppException("Only approved products can be added to the cart.");

        if (!product.CategoryIsActive)
            throw new AppException("Product category is not active.");

        if (!string.Equals(product.ShopStatus, CartConstants.ActiveShopStatus, StringComparison.OrdinalIgnoreCase))
            throw new AppException("Shop is not available.");
    }
}
