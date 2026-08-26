namespace AIDR.Shared.Constants;

public static class RecommendationConstants
{
    public const string ApprovedStatus = "Approved";
    public const string ActiveShopStatus = "Active";

    public const string StrategyCollaborative = "Collaborative";
    public const string StrategyContent = "Content";
    public const string StrategyHybrid = "Hybrid";
    public const string StrategyPopular = "Popular";

    public const int DefaultPage = 1;
    public const int DefaultPageSize = 12;
    public const int MaxPageSize = 48;
    public const int DefaultSimilarLimit = 12;
    public const int MaxSimilarLimit = 48;

    /// <summary>How many recent product views to use for affinity / collaborative signals.</summary>
    public const int RecentViewLookback = 40;

    /// <summary>Candidate pool size before paging (covers hybrid merge).</summary>
    public const int CandidatePoolSize = 60;

    public static readonly TimeSpan RecommendationsCacheTtl = TimeSpan.FromMinutes(2);
    public static readonly TimeSpan SimilarCacheTtl = TimeSpan.FromMinutes(5);

    public static (int Page, int PageSize) NormalizePaging(int page, int pageSize)
    {
        var normalizedPage = page < 1 ? DefaultPage : page;
        var normalizedSize = pageSize < 1
            ? DefaultPageSize
            : Math.Min(pageSize, MaxPageSize);
        return (normalizedPage, normalizedSize);
    }

    public static int NormalizeSimilarLimit(int? limit)
    {
        if (limit is null or < 1)
            return DefaultSimilarLimit;
        return Math.Min(limit.Value, MaxSimilarLimit);
    }
}
