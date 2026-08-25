namespace AIDR.Shared.Dtos.Admin;

public sealed class AdminCustomerInsightsQueryRequest
{
    /// <summary>Inclusive start (UTC date). Defaults to 30 days before <see cref="To"/>.</summary>
    public DateTime? From { get; set; }

    /// <summary>Inclusive end (UTC date). Defaults to today (UTC).</summary>
    public DateTime? To { get; set; }

    /// <summary>day | week | month</summary>
    public string? Granularity { get; set; }
}

public sealed class AdminCustomerInsightsDto
{
    public string Currency { get; init; } = "VND";
    public string Granularity { get; init; } = null!;
    public DateTime From { get; init; }
    public DateTime To { get; init; }
    public AdminCustomerInsightSummaryDto Summary { get; init; } = new();
    public AdminCustomerInsightCohortDto Cohort { get; init; } = new();
    public IReadOnlyList<AdminCustomerInsightPeriodDto> RegistrationSeries { get; init; } =
        Array.Empty<AdminCustomerInsightPeriodDto>();
    public IReadOnlyList<AdminCustomerInsightPeriodDto> OrderSeries { get; init; } =
        Array.Empty<AdminCustomerInsightPeriodDto>();
    public IReadOnlyList<AdminCustomerInsightTopProductDto> TopProducts { get; init; } =
        Array.Empty<AdminCustomerInsightTopProductDto>();
    public DateTime GeneratedAt { get; init; }
}

public sealed class AdminCustomerInsightSummaryDto
{
    public int TotalUsers { get; init; }
    public int ActiveUsers { get; init; }
    public int LockedUsers { get; init; }
    public int NewUsersInPeriod { get; init; }
    public int BuyersWithOrdersInPeriod { get; init; }
    public int OrderCountInPeriod { get; init; }
    public int UnitsSoldInPeriod { get; init; }
    public decimal GmvInPeriod { get; init; }
}

public sealed class AdminCustomerInsightCohortDto
{
    /// <summary>Buyers whose first paid order falls in the selected period.</summary>
    public int NewBuyersInPeriod { get; init; }

    /// <summary>Buyers with a paid order in the period who already had an earlier paid order.</summary>
    public int ReturningBuyersInPeriod { get; init; }
}

public sealed class AdminCustomerInsightPeriodDto
{
    public string PeriodKey { get; init; } = null!;
    public DateTime PeriodStart { get; init; }
    public DateTime PeriodEnd { get; init; }
    public int NewUserCount { get; init; }
    public int OrderCount { get; init; }
    public int UnitsSold { get; init; }
    public decimal Gmv { get; init; }
}

public sealed class AdminCustomerInsightTopProductDto
{
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public int UnitsSold { get; init; }
    public decimal Revenue { get; init; }
    public int OrderCount { get; init; }
}
