namespace AIDR.Shared.Dtos.Admin;

public sealed class AdminOrderListResultDto
{
    public IReadOnlyList<AdminOrderListItemDto> Items { get; init; } =
        Array.Empty<AdminOrderListItemDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public sealed class AdminOrderListItemDto
{
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public Guid BuyerUserId { get; init; }
    public string BuyerEmail { get; init; } = null!;
    public string BuyerName { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string Status { get; init; } = null!;
    public decimal TotalAmount { get; init; }
    public string Currency { get; init; } = "VND";
    public DateTime CreatedAt { get; init; }
}

public sealed class AdminOrderDetailDto
{
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public Guid BuyerUserId { get; init; }
    public string BuyerEmail { get; init; } = null!;
    public string BuyerName { get; init; } = null!;
    public string? BuyerPhone { get; init; }
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
    public int ItemCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public DateTime? PaidAt { get; init; }
    public DateTime? CancelledAt { get; init; }
    public DateTime? DeliveredAt { get; init; }
    public DateTime? CompletedAt { get; init; }
    public AdminOrderShippingDto Shipping { get; init; } = new();
    public IReadOnlyList<AdminOrderItemDto> Items { get; init; } = Array.Empty<AdminOrderItemDto>();
    public IReadOnlyList<AdminOrderStatusHistoryDto> StatusHistory { get; init; } =
        Array.Empty<AdminOrderStatusHistoryDto>();
}

public sealed class AdminOrderShippingDto
{
    public string ReceiverName { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string Province { get; init; } = string.Empty;
    public string District { get; init; } = string.Empty;
    public string Ward { get; init; } = string.Empty;
    public string StreetAddress { get; init; } = string.Empty;
}

public sealed class AdminOrderItemDto
{
    public Guid? VariantId { get; init; }
    /// <summary>The configuration as it read at checkout; null for a single-configuration product.</summary>
    public string? VariantName { get; init; }
    public Guid OrderItemId { get; init; }
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public string? Sku { get; init; }
    public int Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal LineTotal { get; init; }
}

public sealed class AdminOrderStatusHistoryDto
{
    public string? FromStatus { get; init; }
    public string ToStatus { get; init; } = null!;
    public string? Note { get; init; }
    public DateTime CreatedAt { get; init; }
}
