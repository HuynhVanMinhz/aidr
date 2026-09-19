namespace AIDR.Shared.Dtos.Admin;

public sealed class AdminReturnRequestListItemDto
{
    public Guid ReturnRequestId { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
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

public sealed class AdminReturnRequestListResultDto
{
    public IReadOnlyList<AdminReturnRequestListItemDto> Items { get; init; } =
        Array.Empty<AdminReturnRequestListItemDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
    public int PendingCount { get; init; }
    public int ApprovedCount { get; init; }
    public int RejectedCount { get; init; }
    public int SellerConfirmedCount { get; init; }
    public int ReceivingCount { get; init; }
    public int AcceptedCount { get; init; }
    public int RefundedCount { get; init; }
    public int ExchangedCount { get; init; }
    public int ClosedCount { get; init; }
}

public sealed class AdminReturnRequestDetailDto
{
    public Guid ReturnRequestId { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public string OrderStatus { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public Guid ShopOwnerUserId { get; init; }
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
    public Guid? ReviewedBy { get; init; }
    public string? ReviewerFullName { get; init; }
    public DateTime? ReviewedAt { get; init; }
    /// <summary>Buyer-provided refund bank account (filled at return request creation).</summary>
    public string? RefundBankBin { get; init; }
    public string? RefundBankName { get; init; }
    public string? RefundAccountNumberMasked { get; init; }
    public string? RefundAccountName { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public IReadOnlyList<AdminReturnItemDto> Items { get; init; } = Array.Empty<AdminReturnItemDto>();
    public IReadOnlyList<AdminReturnEvidenceDto> Evidences { get; init; } =
        Array.Empty<AdminReturnEvidenceDto>();
    public IReadOnlyList<AdminReturnStatusHistoryDto> StatusHistories { get; init; } =
        Array.Empty<AdminReturnStatusHistoryDto>();
}

public sealed class AdminReturnItemDto
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

public sealed class AdminReturnEvidenceDto
{
    public Guid EvidenceId { get; init; }
    public string EvidenceType { get; init; } = null!;
    public string MediaUrl { get; init; } = null!;
    public string? PublicId { get; init; }
    public int SortOrder { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class AdminReturnStatusHistoryDto
{
    public string? FromStatus { get; init; }
    public string ToStatus { get; init; } = null!;
    public Guid? ChangedBy { get; init; }
    public string? ChangedByFullName { get; init; }
    public string? Note { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class RejectReturnRequestRequest
{
    public string AdminNote { get; set; } = null!;
}

public sealed class UpdateReturnStatusRequest
{
    public string Status { get; set; } = null!;
    public string? Note { get; set; }

    /// <summary>
    /// Optional Napas bank BIN for payOS refund payout when webhook counter account is missing.
    /// </summary>
    public string? RefundToBin { get; set; }

    /// <summary>
    /// Optional buyer bank account number for payOS refund payout when webhook counter account is missing.
    /// </summary>
    public string? RefundToAccountNumber { get; set; }
}
