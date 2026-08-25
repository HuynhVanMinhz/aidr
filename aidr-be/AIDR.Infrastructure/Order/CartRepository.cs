using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Ordering;

public sealed class CartRepository : ICartRepository
{
    private readonly AidrDbContext _db;

    public CartRepository(AidrDbContext db) => _db = db;

    public async Task<CartResponse> GetOrCreateCartAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var cart = await FindCartWithItemsAsync(userId, cancellationToken);
        if (cart is null)
        {
            cart = await CreateCartAsync(userId, cancellationToken);
        }

        return MapCart(cart);
    }

    public async Task<CartProductSnapshot?> GetPurchasableProductAsync(
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        return await _db.Products
            .AsNoTracking()
            .Where(p => p.ProductId == productId)
            .Select(p => new CartProductSnapshot
            {
                ProductId = p.ProductId,
                Name = p.Name,
                Slug = p.Slug,
                Status = p.Status,
                BasePrice = p.BasePrice,
                SalePrice = p.SalePrice,
                Currency = p.Currency,
                StockQuantity = p.StockQuantity,
                ReservedQuantity = p.ReservedQuantity,
                CategoryIsActive = p.Category.IsActive,
                ShopId = p.ShopId,
                ShopName = p.Shop.ShopName,
                ShopSlug = p.Shop.Slug,
                ShopStatus = p.Shop.Status,
                PrimaryImageUrl = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault()
            })
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<CartResponse> AddOrMergeItemAsync(
        Guid userId,
        Guid productId,
        int quantityToAdd,
        decimal unitPriceSnapshot,
        int availableQuantity,
        CancellationToken cancellationToken = default)
    {
        var cart = await FindCartTrackedAsync(userId, cancellationToken)
            ?? await CreateCartAsync(userId, cancellationToken);

        var existing = cart.Items.FirstOrDefault(i =>
            i.ProductId == productId && i.VariantId == null);

        var now = DateTime.UtcNow;
        var price = decimal.Round(unitPriceSnapshot, 2, MidpointRounding.AwayFromZero);

        if (existing is null)
        {
            if (quantityToAdd > availableQuantity)
                throw new AppException($"Only {availableQuantity} unit(s) available.");

            cart.Items.Add(new CartItem
            {
                CartItemId = Guid.NewGuid(),
                CartId = cart.CartId,
                ProductId = productId,
                VariantId = null,
                Quantity = quantityToAdd,
                UnitPriceSnapshot = price,
                CreatedAt = now,
                UpdatedAt = now
            });
        }
        else
        {
            var merged = existing.Quantity + quantityToAdd;
            if (merged > CartConstants.MaxQuantityPerItem)
                throw new AppException($"Quantity must not exceed {CartConstants.MaxQuantityPerItem}.");

            if (merged > availableQuantity)
                throw new AppException($"Only {availableQuantity} unit(s) available.");

            existing.Quantity = merged;
            existing.UnitPriceSnapshot = price;
            existing.UpdatedAt = now;
        }

        cart.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);

        var refreshed = await FindCartWithItemsAsync(userId, cancellationToken)
            ?? throw new NotFoundException("Cart not found.");
        return MapCart(refreshed);
    }

    public async Task<CartResponse> UpdateItemQuantityAsync(
        Guid userId,
        Guid cartItemId,
        int quantity,
        int availableQuantity,
        CancellationToken cancellationToken = default)
    {
        var cart = await FindCartTrackedAsync(userId, cancellationToken)
            ?? throw new NotFoundException("Cart not found.");

        var item = cart.Items.FirstOrDefault(i => i.CartItemId == cartItemId)
            ?? throw new NotFoundException("Cart item not found.");

        if (quantity > availableQuantity)
            throw new AppException($"Only {availableQuantity} unit(s) available.");

        var now = DateTime.UtcNow;
        item.Quantity = quantity;
        item.UpdatedAt = now;
        cart.UpdatedAt = now;

        await _db.SaveChangesAsync(cancellationToken);

        var refreshed = await FindCartWithItemsAsync(userId, cancellationToken)
            ?? throw new NotFoundException("Cart not found.");
        return MapCart(refreshed);
    }

    public async Task<CartResponse> RemoveItemAsync(
        Guid userId,
        Guid cartItemId,
        CancellationToken cancellationToken = default)
    {
        var cart = await FindCartTrackedAsync(userId, cancellationToken)
            ?? throw new NotFoundException("Cart not found.");

        var item = cart.Items.FirstOrDefault(i => i.CartItemId == cartItemId)
            ?? throw new NotFoundException("Cart item not found.");

        _db.CartItems.Remove(item);
        cart.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        var refreshed = await FindCartWithItemsAsync(userId, cancellationToken)
            ?? throw new NotFoundException("Cart not found.");
        return MapCart(refreshed);
    }

    private async Task<Cart> CreateCartAsync(Guid userId, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var cart = new Cart
        {
            CartId = Guid.NewGuid(),
            UserId = userId,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.Carts.Add(cart);
        await _db.SaveChangesAsync(cancellationToken);
        return cart;
    }

    private Task<Cart?> FindCartTrackedAsync(Guid userId, CancellationToken cancellationToken)
        => _db.Carts
            .Include(c => c.Items)
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);

    private Task<Cart?> FindCartWithItemsAsync(Guid userId, CancellationToken cancellationToken)
        => _db.Carts
            .AsNoTracking()
            .Include(c => c.Items)
                .ThenInclude(i => i.Product)
                    .ThenInclude(p => p.Shop)
            .Include(c => c.Items)
                .ThenInclude(i => i.Product)
                    .ThenInclude(p => p.Category)
            .Include(c => c.Items)
                .ThenInclude(i => i.Product)
                    .ThenInclude(p => p.Images)
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);

    private static CartResponse MapCart(Cart cart)
    {
        var items = cart.Items
            .OrderByDescending(i => i.UpdatedAt)
            .ThenByDescending(i => i.CreatedAt)
            .Select(MapItem)
            .ToList();

        var currency = items.FirstOrDefault()?.Currency ?? "VND";

        return new CartResponse
        {
            CartId = cart.CartId,
            Items = items,
            ItemCount = items.Count,
            TotalQuantity = items.Sum(i => i.Quantity),
            Subtotal = items.Sum(i => i.LineTotal),
            Currency = currency,
            UpdatedAt = cart.UpdatedAt
        };
    }

    private static CartItemDto MapItem(CartItem item)
    {
        var product = item.Product;
        var currentPrice = product.SalePrice ?? product.BasePrice;
        var snapshot = item.UnitPriceSnapshot ?? currentPrice;
        var available = Math.Max(0, product.StockQuantity - product.ReservedQuantity);
        var isAvailable =
            string.Equals(product.Status, CartConstants.ApprovedStatus, StringComparison.OrdinalIgnoreCase)
            && product.Category.IsActive
            && string.Equals(product.Shop.Status, CartConstants.ActiveShopStatus, StringComparison.OrdinalIgnoreCase)
            && available > 0;

        var primaryImage = product.Images
            .OrderByDescending(i => i.IsPrimary)
            .ThenBy(i => i.SortOrder)
            .Select(i => i.ImageUrl)
            .FirstOrDefault();

        return new CartItemDto
        {
            CartItemId = item.CartItemId,
            ProductId = item.ProductId,
            ProductName = product.Name,
            ProductSlug = product.Slug,
            PrimaryImageUrl = primaryImage,
            ShopId = product.ShopId,
            ShopName = product.Shop.ShopName,
            ShopSlug = product.Shop.Slug,
            Quantity = item.Quantity,
            UnitPriceSnapshot = snapshot,
            CurrentPrice = currentPrice,
            LineTotal = decimal.Round(snapshot * item.Quantity, 2, MidpointRounding.AwayFromZero),
            Currency = product.Currency,
            AvailableQuantity = available,
            IsAvailable = isAvailable,
            UpdatedAt = item.UpdatedAt
        };
    }
}
