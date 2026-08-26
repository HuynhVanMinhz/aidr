namespace AIDR.Shared.Dtos.AI;

public sealed class NlFilterRequest
{
    /// <summary>Natural-language shopping intent (Vietnamese or English).</summary>
    public string Query { get; set; } = string.Empty;
}

/// <summary>
/// Filter DSL aligned with catalog <c>ProductQueryRequest</c> so the FE can bind the panel directly.
/// </summary>
public sealed class NlFilterResultDto
{
    public string? Q { get; init; }
    public Guid? ShopId { get; init; }
    public int? CategoryId { get; init; }
    public string? CategoryName { get; init; }
    public string? Brand { get; init; }
    public decimal? MinPrice { get; init; }
    public decimal? MaxPrice { get; init; }
    public decimal? MinRating { get; init; }

    /// <summary>newest | price_asc | price_desc | popular | rating</summary>
    public string? Sort { get; init; }

    /// <summary>Echo of the user query after trimming.</summary>
    public string InterpretedQuery { get; init; } = string.Empty;

    /// <summary>0–1 confidence of the parse (heuristic or model).</summary>
    public decimal Confidence { get; init; }

    /// <summary>groq | heuristic</summary>
    public string Source { get; init; } = null!;
}
