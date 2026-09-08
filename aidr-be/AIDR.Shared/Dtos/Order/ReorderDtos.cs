namespace AIDR.Shared.Dtos.Order;

public sealed class ReorderOrderResponse
{
    public int AddedCount { get; init; }
    public IReadOnlyList<ReorderSkippedItemDto> SkippedItems { get; init; } =
        Array.Empty<ReorderSkippedItemDto>();
}

public sealed class ReorderSkippedItemDto
{
    public Guid ProductId { get; init; }
    public Guid? VariantId { get; init; }
    public string ProductName { get; init; } = null!;
    public string Reason { get; init; } = null!;
}
