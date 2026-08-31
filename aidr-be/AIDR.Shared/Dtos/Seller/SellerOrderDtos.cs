using AIDR.Shared.Dtos.Shipping;

namespace AIDR.Shared.Dtos.Seller;

public sealed class SellerOrderQueryRequest
{
    public string? Status { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}

public sealed class SellerOrderListResultDto
{
    public IReadOnlyList<SellerOrderListItemDto> Items { get; init; } =
        Array.Empty<SellerOrderListItemDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public sealed class SellerOrderListItemDto
{
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public Guid BuyerUserId { get; init; }
    public string BuyerName { get; init; } = null!;
    public string? BuyerPhone { get; init; }
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
    public bool CanUpdateStatus { get; init; }
    public string? NextStatus { get; init; }

    /// <summary>A carrier is driving this order; the seller only watches.</summary>
    public bool AutoFulfillment { get; init; }

    /// <summary>Carrier shipment status, null until the shipment is booked.</summary>
    public string? ShipmentStatus { get; init; }
}

public sealed class SellerOrderDetailDto
{
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public Guid ShopId { get; init; }
    public Guid BuyerUserId { get; init; }
    public string BuyerName { get; init; } = null!;
    public string? BuyerEmail { get; init; }
    public string? BuyerPhone { get; init; }
    public string Status { get; init; } = null!;
    public decimal SubtotalAmount { get; init; }
    public decimal DiscountAmount { get; init; }
    public decimal ShippingFee { get; init; }
    public decimal TotalAmount { get; init; }
    public string Currency { get; init; } = "VND";
    public string? BuyerNote { get; init; }
    public string? SellerNote { get; init; }
    public string? TrackingCode { get; init; }
    public SellerOrderShippingDto Shipping { get; init; } = null!;
    public IReadOnlyList<SellerOrderItemDto> Items { get; init; } = Array.Empty<SellerOrderItemDto>();
    public SellerOrderPaymentDto? Payment { get; init; }
    public IReadOnlyList<SellerOrderStatusHistoryDto> StatusHistory { get; init; } =
        Array.Empty<SellerOrderStatusHistoryDto>();
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public DateTime? PaidAt { get; init; }
    public DateTime? CancelledAt { get; init; }
    public DateTime? DeliveredAt { get; init; }
    public DateTime? CompletedAt { get; init; }
    public bool CanUpdateStatus { get; init; }
    public string? NextStatus { get; init; }

    /// <summary>Who is moving this order forward, and the shipment behind it.</summary>
    public OrderFulfillmentDto Fulfillment { get; init; } = null!;
}

public sealed class SellerOrderShippingDto
{
    public Guid? AddressId { get; init; }
    public string ReceiverName { get; init; } = null!;
    public string Phone { get; init; } = null!;
    public string Province { get; init; } = null!;
    public string District { get; init; } = null!;
    public string Ward { get; init; } = null!;
    public string StreetAddress { get; init; } = null!;

    /// <summary>Delivery point as pinned when the order was placed; null on older orders.</summary>
    public double? Latitude { get; init; }
    public double? Longitude { get; init; }
}

public sealed class SellerOrderItemDto
{
    public Guid? VariantId { get; init; }
    /// <summary>The configuration as it read at checkout; null for a single-configuration product.</summary>
    public string? VariantName { get; init; }
    public Guid OrderItemId { get; init; }
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public string? Sku { get; init; }
    public string? ImageUrl { get; init; }
    public int Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal LineTotal { get; init; }
}

public sealed class SellerOrderPaymentDto
{
    public Guid PaymentId { get; init; }
    public string Provider { get; init; } = null!;
    public string Status { get; init; } = null!;
    public decimal Amount { get; init; }
    public string Currency { get; init; } = "VND";
    public DateTime? PaidAt { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class SellerOrderStatusHistoryDto
{
    public string? FromStatus { get; init; }
    public string ToStatus { get; init; } = null!;
    public string? Note { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class UpdateSellerOrderRequest
{
    /// <summary>Next fulfillment status: Confirmed, Shipping, or Delivered.</summary>
    public string Status { get; set; } = null!;

    /// <summary>Manual carrier tracking code. Required when moving to Shipping.</summary>
    public string? TrackingCode { get; set; }

    public string? SellerNote { get; set; }

    /// <summary>Optional note recorded on the status history entry.</summary>
    public string? Note { get; set; }
}
