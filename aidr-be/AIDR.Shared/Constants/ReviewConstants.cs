namespace AIDR.Shared.Constants;

public static class ReviewConstants
{
    public const int MinRating = 1;
    public const int MaxRating = 5;
    public const int MaxTitleLength = 150;
    public const int MaxContentLength = 2000;
    public const int MaxSellerCommentLength = 1000;
    public const int MaxReportDetailsLength = 500;

    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;
    public const int AdminDefaultPageSize = 10;

    /// <summary>Buyers may edit their review within this many days after creation.</summary>
    public const int EditWindowDays = 30;

    /// <summary>Max product reviews a buyer may create in a rolling 24h window.</summary>
    public const int MaxReviewsPerBuyerPerDay = 5;

    /// <summary>Max low ratings (≤ LowRatingThreshold) a buyer may post for the same shop in LowRatingWindowDays.</summary>
    public const int MaxLowRatingsPerShopPerWindow = 3;
    public const int LowRatingThreshold = 2;
    public const int LowRatingWindowDays = 7;

    /// <summary>Account younger than this (days) starts reviews in PendingTrust.</summary>
    public const int TrustMinAccountAgeDays = 7;

    /// <summary>Fewer completed orders than this starts reviews in PendingTrust.</summary>
    public const int TrustMinCompletedOrders = 2;

    /// <summary>Orders below this paid total (VND) do not count toward AvgRating until trust release / admin approve.</summary>
    public const decimal MinOrderTotalForFullWeight = 50_000m;

    /// <summary>PendingTrust reviews auto-promote after this many hours if no open reports.</summary>
    public const int TrustHoldHours = 72;

    public const string StatusApproved = "Approved";
    public const string StatusPendingTrust = "PendingTrust";
    public const string StatusReported = "Reported";
    public const string StatusHiddenByAdmin = "HiddenByAdmin";
    public const string StatusHiddenByOwner = "HiddenByOwner";

    public const string ReportStatusOpen = "Open";
    public const string ReportStatusDismissed = "Dismissed";
    public const string ReportStatusUpheld = "Upheld";

    public const string ReasonSpam = "Spam";
    public const string ReasonOffensive = "Offensive";
    public const string ReasonIrrelevant = "Irrelevant";
    public const string ReasonFake = "Fake";
    public const string ReasonOther = "Other";

    public static readonly HashSet<string> AllowedReportReasons = new(StringComparer.OrdinalIgnoreCase)
    {
        ReasonSpam, ReasonOffensive, ReasonIrrelevant, ReasonFake, ReasonOther
    };

    public static readonly HashSet<string> AdminQueueStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        StatusPendingTrust, StatusReported
    };

    public static (int Page, int PageSize) NormalizePaging(int page, int pageSize)
    {
        var normalizedPage = page < 1 ? 1 : page;
        var normalizedSize = pageSize < 1
            ? DefaultPageSize
            : Math.Min(pageSize, MaxPageSize);
        return (normalizedPage, normalizedSize);
    }

    public static (int Page, int PageSize) NormalizeAdminPaging(int page, int pageSize)
    {
        var normalizedPage = page < 1 ? 1 : page;
        var normalizedSize = pageSize < 1
            ? AdminDefaultPageSize
            : Math.Min(pageSize, MaxPageSize);
        return (normalizedPage, normalizedSize);
    }
}
