namespace AIDR.Shared.Dtos.Order;

public sealed class CreateOrderRequest
{
    public Guid ShippingAddressId { get; set; }

    /// <summary>Optional subset of cart item ids. When empty, checkout the entire cart.</summary>
    public List<Guid>? CartItemIds { get; set; }

    public string? BuyerNote { get; set; }
}

public sealed class CreateOrderResponse
{
    public IReadOnlyList<CreatedOrderDto> Orders { get; init; } = Array.Empty<CreatedOrderDto>();
    public int OrderCount { get; init; }
    public decimal GrandTotal { get; init; }
    public string Currency { get; init; } = "VND";
}

public sealed class CreatedOrderDto
{
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string Status { get; init; } = null!;
    public decimal SubtotalAmount { get; init; }
    public decimal DiscountAmount { get; init; }
    public decimal ShippingFee { get; init; }
    public decimal TotalAmount { get; init; }
    public string Currency { get; init; } = "VND";
    public Guid PaymentId { get; init; }
    public string PaymentStatus { get; init; } = null!;
    public IReadOnlyList<CreatedOrderItemDto> Items { get; init; } = Array.Empty<CreatedOrderItemDto>();
    public DateTime CreatedAt { get; init; }
}

public sealed class CreatedOrderItemDto
{
    public Guid OrderItemId { get; init; }
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public int Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal? UnitCostAvg { get; init; }
    public decimal LineTotal { get; init; }
}
