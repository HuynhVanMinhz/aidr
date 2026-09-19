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

        var variant = ResolveVariant(product, request.VariantId);

        // With a variant it is that configuration's price and stock that apply, not the
        // product's - the product's figures only describe its cheapest variant.
        var unitPrice = variant?.EffectivePrice ?? product.EffectivePrice;
        var available = variant?.AvailableQuantity ?? product.AvailableQuantity;

        if (available < 1)
        {
            throw new AppException(variant is null
                ? "Product is out of stock."
                : $"'{variant.VariantName}' is out of stock.");
        }

        if (quantity > available)
            throw new AppException($"Only {available} unit(s) available.");

        return await _carts.AddOrMergeItemAsync(
            userId,
            product.ProductId,
            variant?.VariantId,
            quantity,
            unitPrice,
            available,
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

        var variant = ResolveVariant(product, item.VariantId);
        var available = variant?.AvailableQuantity ?? product.AvailableQuantity;

        if (request.Quantity > available)
            throw new AppException($"Only {available} unit(s) available.");

        return await _carts.UpdateItemQuantityAsync(
            userId,
            cartItemId,
            request.Quantity,
            available,
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

    /// <summary>
    /// Pairs the requested configuration with the product. A product sold in variants has no
    /// price of its own, so buying it without naming one has to be refused rather than quietly
    /// falling back to the cheapest.
    /// </summary>
    private static CartVariantSnapshot? ResolveVariant(CartProductSnapshot product, Guid? variantId)
    {
        if (!product.HasVariants)
        {
            if (variantId is not null && variantId != Guid.Empty)
                throw new AppException("This product is not sold in variants.");

            return null;
        }

        if (variantId is null || variantId == Guid.Empty)
            throw new AppException("Pick a variant before adding this product to the cart.");

        var variant = product.Variants.FirstOrDefault(v => v.VariantId == variantId.Value)
            ?? throw new NotFoundException("Variant is not available.");

        if (!variant.IsActive)
            throw new AppException($"'{variant.VariantName}' is no longer for sale.");

        return variant;
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
