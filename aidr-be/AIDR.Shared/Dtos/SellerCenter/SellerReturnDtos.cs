namespace AIDR.Shared.Dtos.SellerCenter;

public sealed class SellerReturnListItemDto
{
    public Guid ReturnRequestId { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public Guid BuyerUserId { get; init; }
    public string BuyerEmail { get; init; } = null!;
    public string BuyerFullName { get; init; } = null!;
    public string Reason { get; init; } = null!;
    public string Status { get; init; } = null!;
    public string ResolutionType { get; init; } = null!;
    public decimal? RefundAmount { get; init; }
    public decimal OrderTotalAmount { get; init; }
    public int EvidenceCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public sealed class SellerReturnListResultDto
{
    public IReadOnlyList<SellerReturnListItemDto> Items { get; init; } =
        Array.Empty<SellerReturnListItemDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
    public int ApprovedCount { get; init; }
    public int SellerConfirmedCount { get; init; }
    public int ReceivingCount { get; init; }
    public int AcceptedCount { get; init; }
}

public sealed class SellerReturnDetailDto
{
    public Guid ReturnRequestId { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public string OrderStatus { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public Guid BuyerUserId { get; init; }
    public string BuyerEmail { get; init; } = null!;
    public string BuyerFullName { get; init; } = null!;
    public string Reason { get; init; } = null!;
    public string? Description { get; init; }
    public string ResolutionType { get; init; } = null!;
    public string Status { get; init; } = null!;
    public decimal? RefundAmount { get; init; }
    public decimal OrderTotalAmount { get; init; }
    public string? AdminNote { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public IReadOnlyList<SellerReturnItemDto> Items { get; init; } = Array.Empty<SellerReturnItemDto>();
    public IReadOnlyList<SellerReturnEvidenceDto> Evidences { get; init; } =
        Array.Empty<SellerReturnEvidenceDto>();
    public IReadOnlyList<SellerReturnStatusHistoryDto> StatusHistories { get; init; } =
        Array.Empty<SellerReturnStatusHistoryDto>();
}

public sealed class SellerReturnItemDto
{
    public Guid ReturnItemId { get; init; }
    public Guid OrderItemId { get; init; }
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public string? Sku { get; init; }
    public int Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal LineTotal { get; init; }
}

public sealed class SellerReturnEvidenceDto
{
    public Guid EvidenceId { get; init; }
    public string EvidenceType { get; init; } = null!;
    public string MediaUrl { get; init; } = null!;
    public string? PublicId { get; init; }
    public int SortOrder { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class SellerReturnStatusHistoryDto
{
    public string? FromStatus { get; init; }
    public string ToStatus { get; init; } = null!;
    public Guid? ChangedBy { get; init; }
    public string? ChangedByFullName { get; init; }
    public string? Note { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class ConfirmSellerReturnRequest
{
    /// <summary>Optional override of buyer resolution (ReturnRefund or Exchange).</summary>
    public string? ResolutionType { get; set; }
    public string? Note { get; set; }
}

public sealed class RejectSellerReturnRequest
{
    public string Note { get; set; } = null!;
}

public sealed class SellerReturnActionRequest
{
    public string? Note { get; set; }
}
