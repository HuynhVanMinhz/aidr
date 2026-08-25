namespace AIDR.Shared.Dtos.Engagement;

public sealed class AddWishlistItemRequest
{
    public Guid ProductId { get; set; }
}

public sealed class WishlistItemDto
{
    public Guid WishlistItemId { get; init; }
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public string ProductSlug { get; init; } = null!;
    public string? PrimaryImageUrl { get; init; }
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string ShopSlug { get; init; } = null!;
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public decimal EffectivePrice { get; init; }
    public string Currency { get; init; } = "VND";
    public int AvailableQuantity { get; init; }
    public bool IsAvailable { get; init; }
    public decimal AvgRating { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class RemoveWishlistItemResponse
{
    public Guid WishlistItemId { get; init; }
    public Guid ProductId { get; init; }
}
