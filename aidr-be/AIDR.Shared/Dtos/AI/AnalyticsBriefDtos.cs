namespace AIDR.Shared.Dtos.AI;

public sealed class AiAnalyticsBriefQueryRequest
{
    /// <summary>Inclusive start (UTC date). Defaults to 30 days before <see cref="To"/>.</summary>
    public DateTime? From { get; set; }

    /// <summary>Inclusive end (UTC date). Defaults to today (UTC).</summary>
    public DateTime? To { get; set; }

    /// <summary>Optional natural-language question answered from the same metrics snapshot.</summary>
    public string? Question { get; set; }
}

public sealed class AiAnalyticsPeriodDto
{
    public DateTime From { get; init; }
    public DateTime To { get; init; }
}

public sealed class AiAnalyticsAlertDto
{
    /// <summary>info | warning | danger</summary>
    public string Severity { get; init; } = "info";
    public string Message { get; init; } = null!;
}

public sealed class AiAnalyticsKpiDto
{
    public string Label { get; init; } = null!;
    public string Value { get; init; } = null!;
    public decimal? ChangePercent { get; init; }
    public string? Subtext { get; init; }
}

public sealed class AiAnalyticsInsightMetricDto
{
    public string Label { get; init; } = null!;
    public string Value { get; init; } = null!;
    public decimal? ChangePercent { get; init; }
}

public sealed class AiAnalyticsRecommendationDto
{
    public string Text { get; init; } = null!;
    public string? ActionLabel { get; init; }
    public string? ActionHref { get; init; }
}

public sealed class AiAnalyticsBriefDto
{
    /// <summary>admin | seller</summary>
    public string Audience { get; init; } = null!;
    public AiAnalyticsPeriodDto Period { get; init; } = new();
    public string Headline { get; init; } = null!;
    public string Summary { get; init; } = null!;
    public IReadOnlyList<AiAnalyticsKpiDto> Kpis { get; init; } = Array.Empty<AiAnalyticsKpiDto>();
    public IReadOnlyList<AiAnalyticsInsightMetricDto> InsightMetrics { get; init; } =
        Array.Empty<AiAnalyticsInsightMetricDto>();
    public IReadOnlyList<string> Insights { get; init; } = Array.Empty<string>();
    public IReadOnlyList<AiAnalyticsRecommendationDto> ActionRecommendations { get; init; } =
        Array.Empty<AiAnalyticsRecommendationDto>();
    public IReadOnlyList<AiAnalyticsAlertDto> Alerts { get; init; } = Array.Empty<AiAnalyticsAlertDto>();
    public string? Answer { get; init; }
    public string Source { get; init; } = null!;
    public DateTime GeneratedAt { get; init; }
}
