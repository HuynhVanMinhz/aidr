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

public sealed class CancelOrderRequest
{
    public string? Reason { get; set; }
}

public sealed class BuyerOrderListResultDto
{
    public IReadOnlyList<BuyerOrderListItemDto> Items { get; init; } =
        Array.Empty<BuyerOrderListItemDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public sealed class BuyerOrderListItemDto
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
    public int ItemCount { get; init; }
    public string? ThumbnailUrl { get; init; }
    public string? TrackingCode { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? PaidAt { get; init; }
    public DateTime? CancelledAt { get; init; }
    public DateTime? DeliveredAt { get; init; }
    public DateTime? CompletedAt { get; init; }
}

public sealed class BuyerOrderDetailDto
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
    public string? BuyerNote { get; init; }
    public string? SellerNote { get; init; }
    public string? TrackingCode { get; init; }
    public BuyerOrderShippingDto Shipping { get; init; } = null!;
    public IReadOnlyList<BuyerOrderItemDto> Items { get; init; } = Array.Empty<BuyerOrderItemDto>();
    public BuyerOrderPaymentDto? Payment { get; init; }
    public IReadOnlyList<BuyerOrderStatusHistoryDto> StatusHistory { get; init; } =
        Array.Empty<BuyerOrderStatusHistoryDto>();
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public DateTime? PaidAt { get; init; }
    public DateTime? CancelledAt { get; init; }
    public DateTime? DeliveredAt { get; init; }
    public DateTime? CompletedAt { get; init; }
    public bool CanCancel { get; init; }
    public bool CanConfirmReceived { get; init; }
}

public sealed class BuyerOrderShippingDto
{
    public Guid? AddressId { get; init; }
    public string ReceiverName { get; init; } = null!;
    public string Phone { get; init; } = null!;
    public string Province { get; init; } = null!;
    public string District { get; init; } = null!;
    public string Ward { get; init; } = null!;
    public string StreetAddress { get; init; } = null!;
}

public sealed class BuyerOrderItemDto
{
    public Guid OrderItemId { get; init; }
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public string? Sku { get; init; }
    public string? ImageUrl { get; init; }
    public int Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal LineTotal { get; init; }
}

public sealed class BuyerOrderPaymentDto
{
    public Guid PaymentId { get; init; }
    public string Provider { get; init; } = null!;
    public string Status { get; init; } = null!;
    public decimal Amount { get; init; }
    public string Currency { get; init; } = "VND";
    public string? CheckoutUrl { get; init; }
    public DateTime? PaidAt { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class BuyerOrderStatusHistoryDto
{
    public string? FromStatus { get; init; }
    public string ToStatus { get; init; } = null!;
    public string? Note { get; init; }
    public DateTime CreatedAt { get; init; }
}
