namespace AIDR.Shared.Dtos.Order;

public sealed class AddCartItemRequest
{
    public Guid ProductId { get; set; }
    public int Quantity { get; set; } = 1;
}

public sealed class UpdateCartItemRequest
{
    public int Quantity { get; set; }
}

public sealed class CartResponse
{
    public Guid CartId { get; init; }
    public IReadOnlyList<CartItemDto> Items { get; init; } = Array.Empty<CartItemDto>();
    public int ItemCount { get; init; }
    public int TotalQuantity { get; init; }
    public decimal Subtotal { get; init; }
    public string Currency { get; init; } = "VND";
    public DateTime UpdatedAt { get; init; }
}

public sealed class CartItemDto
{
    public Guid CartItemId { get; init; }
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public string ProductSlug { get; init; } = null!;
    public string? PrimaryImageUrl { get; init; }
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string ShopSlug { get; init; } = null!;
    public int Quantity { get; init; }
    public decimal UnitPriceSnapshot { get; init; }
    public decimal CurrentPrice { get; init; }
    public decimal LineTotal { get; init; }
    public string Currency { get; init; } = "VND";
    public int AvailableQuantity { get; init; }
    public bool IsAvailable { get; init; }
    public DateTime UpdatedAt { get; init; }
}
