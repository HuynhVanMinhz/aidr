namespace AIDR.Shared.Dtos.Order;

public sealed class CreateReturnRequest
{
    public string Reason { get; set; } = null!;
    public string? Description { get; set; }

    /// <summary>
    /// Optional. When omitted, all order items are returned at full quantity.
    /// </summary>
    public IReadOnlyList<CreateReturnItemRequest>? Items { get; set; }

    public IReadOnlyList<CreateReturnEvidenceRequest> Evidences { get; set; } =
        Array.Empty<CreateReturnEvidenceRequest>();
}

public sealed class CreateReturnItemRequest
{
    public Guid OrderItemId { get; set; }
    public int Quantity { get; set; }
}

public sealed class CreateReturnEvidenceRequest
{
    public string EvidenceType { get; set; } = null!;
    public string MediaUrl { get; set; } = null!;
    public string? PublicId { get; set; }
}

public sealed class BuyerReturnRequestDto
{
    public Guid ReturnRequestId { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public string Reason { get; init; } = null!;
    public string? Description { get; init; }
    public string ResolutionType { get; init; } = null!;
    public string Status { get; init; } = null!;
    public decimal? RefundAmount { get; init; }
    public string? AdminNote { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public IReadOnlyList<BuyerReturnItemDto> Items { get; init; } = Array.Empty<BuyerReturnItemDto>();
    public IReadOnlyList<BuyerReturnEvidenceDto> Evidences { get; init; } =
        Array.Empty<BuyerReturnEvidenceDto>();
    public IReadOnlyList<BuyerReturnStatusHistoryDto> StatusHistories { get; init; } =
        Array.Empty<BuyerReturnStatusHistoryDto>();
}

public sealed class BuyerReturnItemDto
{
    public Guid ReturnItemId { get; init; }
    public Guid OrderItemId { get; init; }
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public int Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal LineTotal { get; init; }
}

public sealed class BuyerReturnEvidenceDto
{
    public Guid EvidenceId { get; init; }
    public string EvidenceType { get; init; } = null!;
    public string MediaUrl { get; init; } = null!;
    public string? PublicId { get; init; }
    public int SortOrder { get; init; }
}

public sealed class BuyerReturnStatusHistoryDto
{
    public string? FromStatus { get; init; }
    public string ToStatus { get; init; } = null!;
    public string? Note { get; init; }
    public DateTime CreatedAt { get; init; }
}
