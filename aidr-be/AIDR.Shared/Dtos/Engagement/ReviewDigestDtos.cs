namespace AIDR.Shared.Dtos.Engagement;

public sealed class ReviewDigestDto
{
    public bool Available { get; init; }
    public int ReviewCount { get; init; }
    public DateTime? GeneratedAt { get; init; }
    public string? Source { get; init; }
    public string? SummaryLine { get; init; }
    public IReadOnlyList<string> Pros { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Cons { get; init; } = Array.Empty<string>();
    public ReviewDigestSentimentDto? Sentiment { get; init; }
}

public sealed class ReviewDigestSentimentDto
{
    public int Positive { get; init; }
    public int Neutral { get; init; }
    public int Negative { get; init; }
}

public sealed class ReviewDigestReviewRecord
{
    public byte Rating { get; init; }
    public string? Title { get; init; }
    public string Content { get; init; } = null!;
    public string? SentimentLabel { get; init; }
}

public sealed class ReviewDigestSnapshotRecord
{
    public Guid ProductId { get; init; }
    public int ReviewCount { get; init; }
    public string DigestJson { get; init; } = null!;
    public string Source { get; init; } = null!;
    public DateTime GeneratedAt { get; init; }
}
