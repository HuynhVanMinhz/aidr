using AIDR.Shared.Dtos.Order;

namespace AIDR.Modules.Order.Abstractions;

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
