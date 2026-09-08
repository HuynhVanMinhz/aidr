namespace AIDR.Shared.Dtos.Order;

public sealed class BuyerProtectionTimelineStepDto
{
    public string Key { get; init; } = null!;
    public string Label { get; init; } = null!;
    public string State { get; init; } = null!;
    public DateTime? At { get; init; }
    public DateTime? DueAt { get; init; }
    public string? Detail { get; init; }
}

public sealed class BuyerProtectionReturnSummaryDto
{
    public string? Status { get; init; }
    public bool CanOpen { get; init; }
    public DateTime? ReturnDeadline { get; init; }
}

public sealed class BuyerProtectionTimelineDto
{
    public Guid OrderId { get; init; }
    public string OrderStatus { get; init; } = null!;
    public string Currency { get; init; } = "VND";
    public IReadOnlyList<BuyerProtectionTimelineStepDto> Steps { get; init; } = Array.Empty<BuyerProtectionTimelineStepDto>();
    public BuyerProtectionReturnSummaryDto ReturnRequest { get; init; } = new();
    public string? ShipmentTrackingUrl { get; init; }
}
