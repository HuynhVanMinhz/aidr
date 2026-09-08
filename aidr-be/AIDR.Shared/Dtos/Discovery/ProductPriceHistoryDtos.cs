namespace AIDR.Shared.Dtos.Discovery;

public sealed class ProductPriceHistoryPointDto
{
    public DateTime At { get; init; }
    public decimal Price { get; init; }
}

public sealed class ProductPriceHistoryDto
{
    public Guid ProductId { get; init; }
    public int Days { get; init; }
    public decimal CurrentPrice { get; init; }
    public decimal? LowestInPeriod { get; init; }
    public decimal? HighestInPeriod { get; init; }
    public IReadOnlyList<ProductPriceHistoryPointDto> Points { get; init; } = Array.Empty<ProductPriceHistoryPointDto>();
}
