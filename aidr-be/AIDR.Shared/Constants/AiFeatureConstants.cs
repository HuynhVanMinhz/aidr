namespace AIDR.Shared.Constants;

public static class ReviewDigestConstants
{
    public const string SourceGroq = "Groq";
    public const string SourceHeuristic = "Heuristic";

    public const int DefaultMinReviews = 5;
    public const int DefaultMaxReviewsInPrompt = 50;
    public const int DefaultCacheTtlMinutes = 60;
    public const int MaxRegenerationsPerHour = 10;
    public const int MaxReviewContentChars = 500;

    public static string CacheKey(Guid productId) => $"product:{productId:D}:review-digest";
    public static string RegenerationCounterKey(Guid productId) => $"product:{productId:D}:review-digest:regen";

    public static readonly string[] PositiveKeywords =
    [
        "excellent", "great", "good", "fast", "smooth", "reliable", "comfortable",
        "battery", "value", "sharp", "vibrant", "clean", "polished", "recommend"
    ];

    public static readonly string[] NegativeKeywords =
    [
        "warm", "heat", "hot", "expensive", "pricey", "average", "mixed",
        "disappoint", "slow", "noisy", "packaging", "heavy", "issue", "problem"
    ];
}

public static class BundleConstants
{
    public const string SourceRule = "Rule";
    public const int MinBundleItems = 2;
    public const int MaxBundleItems = 4;
    public const int CacheTtlMinutes = 30;

    public static string CacheKey(Guid productId) => $"product:{productId:D}:bundle";
}

public static class CompatibilityConstants
{
    public const string VerdictCompatible = "Compatible";
    public const string VerdictIncompatible = "Incompatible";
    public const string VerdictUnknown = "Unknown";
    public const string VerdictWarning = "Warning";

    public const string SourceRule = "Rule";
    public const string SourceGroq = "Groq";
    public const string SourceHeuristic = "Heuristic";

    public const int MaxFreeTextLength = 500;
}
