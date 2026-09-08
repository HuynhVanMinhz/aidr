namespace AIDR.Shared.Dtos.Engagement;

public sealed class CreatePriceAlertRequest
{
    public Guid ProductId { get; set; }
    public string AlertType { get; set; } = null!;
    public decimal? ThresholdPct { get; set; }
    public decimal? ThresholdAmount { get; set; }
}

public sealed class PriceAlertDto
{
    public Guid PriceAlertId { get; init; }
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public string ProductSlug { get; init; } = null!;
    public string? PrimaryImageUrl { get; init; }
    public string AlertType { get; init; } = null!;
    public decimal? BaselinePrice { get; init; }
    public decimal ThresholdPct { get; init; }
    public decimal ThresholdAmount { get; init; }
    public decimal CurrentPrice { get; init; }
    public bool IsActive { get; init; }
    public DateTime? LastTriggeredAt { get; init; }
    public DateTime? ExpiresAt { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class ProductPriceAlertStatusDto
{
    public bool PriceDrop { get; init; }
    public bool BackInStock { get; init; }
}

public sealed class RemovePriceAlertResponse
{
    public Guid PriceAlertId { get; init; }
    public Guid ProductId { get; init; }
    public string AlertType { get; init; } = null!;
}
