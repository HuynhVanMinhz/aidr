using AIDR.Shared.Dtos.Order;

namespace AIDR.Modules.Order.Abstractions;

/// <summary>One purchasable configuration, carrying the price and stock the cart must use.</summary>
public sealed class CartVariantSnapshot
{
    public Guid VariantId { get; init; }
    public string VariantName { get; init; } = null!;
    public decimal Price { get; init; }
    public decimal? SalePrice { get; init; }
    public int StockQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public bool IsActive { get; init; }

    public decimal EffectivePrice => SalePrice ?? Price;
    public int AvailableQuantity => Math.Max(0, StockQuantity - ReservedQuantity);
}

public sealed class CartProductSnapshot
{
    public Guid ProductId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string Status { get; init; } = null!;
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public string Currency { get; init; } = "VND";
    public int StockQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public bool CategoryIsActive { get; init; }
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string ShopSlug { get; init; } = null!;
    public string ShopStatus { get; init; } = null!;
    public string? PrimaryImageUrl { get; init; }
    /// <summary>Empty when the product is sold as a single configuration.</summary>
    public IReadOnlyList<CartVariantSnapshot> Variants { get; init; } = Array.Empty<CartVariantSnapshot>();

    public bool HasVariants => Variants.Count > 0;

    // With variants these two describe the cheapest one, which is right for a listing but
    // never for a cart line - that always goes through the resolved CartVariantSnapshot.
    public decimal EffectivePrice => SalePrice ?? BasePrice;
    public int AvailableQuantity => Math.Max(0, StockQuantity - ReservedQuantity);
}

public interface ICartRepository
{
    Task<CartResponse> GetOrCreateCartAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<CartProductSnapshot?> GetPurchasableProductAsync(
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<CartResponse> AddOrMergeItemAsync(
        Guid userId,
        Guid productId,
        Guid? variantId,
        int quantityToAdd,
        decimal unitPriceSnapshot,
        int availableQuantity,
        CancellationToken cancellationToken = default);

    Task<CartResponse> UpdateItemQuantityAsync(
        Guid userId,
        Guid cartItemId,
        int quantity,
        int availableQuantity,
        CancellationToken cancellationToken = default);

    Task<CartResponse> RemoveItemAsync(
        Guid userId,
        Guid cartItemId,
        CancellationToken cancellationToken = default);
}
