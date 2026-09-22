namespace AIDR.Shared.Dtos.Admin;

public sealed class AdminReviewModerationListQuery
{
    /// <summary>PendingTrust | Reported | all (default Reported).</summary>
    public string? Status { get; set; }
    public string? Q { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}

public sealed class AdminReviewModerationListSummary
{
    public int PendingTrustCount { get; init; }
    public int ReportedCount { get; init; }
}

public sealed class AdminReviewModerationItemDto
{
    public Guid ReviewId { get; init; }
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public Guid BuyerUserId { get; init; }
    public string BuyerName { get; init; } = null!;
    public string? BuyerEmail { get; init; }
    public byte Rating { get; init; }
    public string? Title { get; init; }
    public string? Content { get; init; }
    public string ModerationStatus { get; init; } = null!;
    public bool CountsTowardRating { get; init; }
    public bool IsVisible { get; init; }
    public int OpenReportCount { get; init; }
    public string? LatestReportReason { get; init; }
    public string? LatestReportDetails { get; init; }
    public Guid? LatestReporterUserId { get; init; }
    public string? LatestReporterName { get; init; }
    public string? LatestReporterEmail { get; init; }
    public bool LatestReporterIsShopOwner { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? TrustReleaseAt { get; init; }
}

public sealed class AdminReviewModerationListResult
{
    public AdminReviewModerationListSummary Summary { get; init; } = new();
    public IReadOnlyList<AdminReviewModerationItemDto> Items { get; init; } =
        Array.Empty<AdminReviewModerationItemDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}
