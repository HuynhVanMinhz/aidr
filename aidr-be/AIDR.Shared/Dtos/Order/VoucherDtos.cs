namespace AIDR.Shared.Dtos.Order;

public sealed class VoucherListResultDto
{
    public IReadOnlyList<VoucherListItemDto> Items { get; init; } = Array.Empty<VoucherListItemDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
    public decimal CartSubtotal { get; init; }
    public string Currency { get; init; } = "VND";
}

public sealed class VoucherListItemDto
{
    public Guid VoucherId { get; init; }
    public string Code { get; init; } = null!;
    public string Name { get; init; } = null!;
    public string? Description { get; init; }
    public string Scope { get; init; } = null!;
    public Guid? ShopId { get; init; }
    public string? ShopName { get; init; }
    public string DiscountType { get; init; } = null!;
    public decimal DiscountValue { get; init; }
    public decimal? MaxDiscountAmount { get; init; }
    public decimal MinOrderAmount { get; init; }
    public DateTime StartsAt { get; init; }
    public DateTime EndsAt { get; init; }
    public decimal ApplicableSubtotal { get; init; }
    public decimal EstimatedDiscountAmount { get; init; }
    public bool IsEligible { get; init; }
    public string? IneligibilityReason { get; init; }
}

public sealed class ApplyVoucherPreviewRequest
{
    public Guid? VoucherId { get; set; }
    public string? Code { get; set; }

    /// <summary>
    /// Shop whose cart subtotal the voucher applies to.
    /// Required for Shop vouchers; recommended for System vouchers when the cart spans multiple shops.
    /// </summary>
    public Guid? ShopId { get; set; }

    /// <summary>Optional subset of cart item ids (same semantics as create order).</summary>
    public List<Guid>? CartItemIds { get; set; }
}

public sealed class ApplyVoucherPreviewResponse
{
    public Guid VoucherId { get; init; }
    public string Code { get; init; } = null!;
    public string Name { get; init; } = null!;
    public string Scope { get; init; } = null!;
    public Guid? ShopId { get; init; }
    public Guid ApplicableShopId { get; init; }
    public string? ShopName { get; init; }
    public string DiscountType { get; init; } = null!;
    public decimal DiscountValue { get; init; }
    public decimal SubtotalAmount { get; init; }
    public decimal DiscountAmount { get; init; }
    public decimal ShippingFee { get; init; }
    public decimal TotalAmount { get; init; }
    public string Currency { get; init; } = "VND";
    public bool IsValid { get; init; }
    public string? Message { get; init; }
}

public sealed class OrderVoucherSelection
{
    public Guid ShopId { get; set; }
    public Guid VoucherId { get; set; }
}
