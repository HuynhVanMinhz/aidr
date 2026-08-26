namespace AIDR.Shared.Constants;

public static class AiConstants
{
    public const string OptionsSectionName = "Groq";

    public const int MinCompareProducts = 2;
    public const int MaxCompareProducts = 5;
    public const int MaxNlQueryLength = 500;
    public const int MinNlQueryLength = 2;

    public const string SourceGroq = "groq";
    public const string SourceHeuristic = "heuristic";

    public static readonly HashSet<string> AllowedSorts = new(StringComparer.OrdinalIgnoreCase)
    {
        DiscoveryConstants.SortNewest,
        DiscoveryConstants.SortPriceAsc,
        DiscoveryConstants.SortPriceDesc,
        DiscoveryConstants.SortPopular,
        DiscoveryConstants.SortRating
    };
}
