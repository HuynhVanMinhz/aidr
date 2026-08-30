namespace AIDR.Shared.Dtos.AI;

public sealed class CompareProductsRequest
{
    /// <summary>2–5 approved product ids to compare.</summary>
    public List<Guid> ProductIds { get; set; } = new();
}

public sealed class CompareProductCardDto
{
    public Guid ProductId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? Brand { get; init; }
    public string? ModelNumber { get; init; }
    public string ConditionType { get; init; } = "New";
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public decimal EffectivePrice { get; init; }
    public string Currency { get; init; } = "VND";
    public decimal AvgRating { get; init; }
    public int ReviewCount { get; init; }
    public int? WarrantyMonths { get; init; }
    public string? OriginCountry { get; init; }
    public int AvailableQuantity { get; init; }
    public int SoldCount { get; init; }
    public string? PrimaryImageUrl { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public IReadOnlyList<string> Tags { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> Specs { get; init; } =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
}

public sealed class CompareDimensionDto
{
    public string Key { get; init; } = null!;
    public string Label { get; init; } = null!;

    /// <summary>Values keyed by productId (string GUID).</summary>
    public IReadOnlyDictionary<string, string> Values { get; init; } =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
}

public sealed class CompareProductsResultDto
{
    public IReadOnlyList<CompareProductCardDto> Products { get; init; } = Array.Empty<CompareProductCardDto>();
    public IReadOnlyList<CompareDimensionDto> Dimensions { get; init; } = Array.Empty<CompareDimensionDto>();
    public string Summary { get; init; } = string.Empty;
    public IReadOnlyList<string> Highlights { get; init; } = Array.Empty<string>();

    /// <summary>groq | heuristic</summary>
    public string Source { get; init; } = null!;
}
