namespace AIDR.Shared.Dtos.Seller;

public sealed class RestockAdviceQueryRequest
{
    public int Days { get; set; } = 14;
}

public sealed class RestockAdviceItemDto
{
    public Guid ProductId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public int AvailableQuantity { get; init; }
    public int LowStockThreshold { get; init; }
    public decimal AvgDailySales { get; init; }
    public decimal? DaysUntilStockout { get; init; }
    public int SuggestedQty { get; init; }
    public string Note { get; init; } = null!;
}

public sealed class RestockAdviceResultDto
{
    public int SalesWindowDays { get; init; }
    public IReadOnlyList<RestockAdviceItemDto> Items { get; init; } = Array.Empty<RestockAdviceItemDto>();
}
