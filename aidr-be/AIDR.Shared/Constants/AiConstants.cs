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

    public const string ChannelShoppingAssistant = "ShoppingAssistant";
    public const string RoleUser = "user";
    public const string RoleAssistant = "assistant";
    public const string RoleSystem = "system";

    public const int MinChatMessageLength = 1;
    public const int MaxChatMessageLength = 2000;
    public const int MaxChatTitleLength = 200;
    public const int MaxChatHistoryMessages = 20;
    public const int MaxSuggestedProducts = 5;
    public const int CatalogContextProductLimit = 8;

    public const int DefaultConversationPage = 1;
    public const int DefaultConversationPageSize = 20;
    public const int MaxConversationPageSize = 50;
    public const int DefaultMessagePageSize = 50;
    public const int MaxMessagePageSize = 100;

    public static readonly HashSet<string> AllowedSorts = new(StringComparer.OrdinalIgnoreCase)
    {
        DiscoveryConstants.SortNewest,
        DiscoveryConstants.SortPriceAsc,
        DiscoveryConstants.SortPriceDesc,
        DiscoveryConstants.SortPopular,
        DiscoveryConstants.SortRating
    };

    public static (int Page, int PageSize) NormalizeConversationPaging(int page, int pageSize)
    {
        var normalizedPage = page < 1 ? DefaultConversationPage : page;
        var normalizedSize = pageSize < 1
            ? DefaultConversationPageSize
            : Math.Min(pageSize, MaxConversationPageSize);
        return (normalizedPage, normalizedSize);
    }

    public static (int Page, int PageSize) NormalizeMessagePaging(int page, int pageSize)
    {
        var normalizedPage = page < 1 ? DefaultConversationPage : page;
        var normalizedSize = pageSize < 1
            ? DefaultMessagePageSize
            : Math.Min(pageSize, MaxMessagePageSize);
        return (normalizedPage, normalizedSize);
    }
}
