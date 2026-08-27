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

    public const string IntentRecommend = "recommend";
    public const string IntentRefine = "refine";
    public const string IntentProductQa = "product_qa";
    public const string IntentCompare = "compare";
    public const string IntentFaq = "faq";
    public const string IntentBrowse = "browse";
    public const string IntentClarify = "clarify";
    public const string IntentSmalltalk = "smalltalk";
    public const string IntentExplain = "explain";

    /// <summary>Max consultation questions asked before the assistant must recommend.</summary>
    public const int MaxConsultQuestions = 3;

    /// <summary>Stop asking once the hard filters already narrow the catalog this far.</summary>
    public const int EarlyPresentThreshold = 12;

    /// <summary>With this few candidates left, another question cannot help.</summary>
    public const int MinCandidatesToStopAsking = 3;

    /// <summary>Below this pool size a budget question is pointless.</summary>
    public const int BudgetQuestionMinPool = 8;

    /// <summary>Prices sampled when building budget chips.</summary>
    public const int PriceBandSampleSize = 500;

    /// <summary>Products shown at the end of a guided consultation.</summary>
    public const int ConsultPresentCount = 3;

    public const string ConsultStageCollecting = "collecting";
    public const string ConsultStageReady = "ready";
    public const string ConsultStagePresented = "presented";

    public const string ConsultQuestionCategory = "category";
    public const string ConsultQuestionBudget = "budget";
    public const string ConsultQuestionUseCase = "useCase";
    public const string ConsultQuestionPriority = "priority";

    public const string ConsultBadgeBestMatch = "Best match";
    public const string ConsultBadgeCheaper = "Cheaper option";
    public const string ConsultBadgeStepUp = "Step up";

    public const string ActionOpenCatalog = "open_catalog";
    public const string ActionOpenCompare = "open_compare";
    public const string ActionOpenProduct = "open_product";
    public const string ActionNone = "none";

    public const string FaqTopicReturn = "return";
    public const string FaqTopicShipping = "shipping";
    public const string FaqTopicPayment = "payment";
    public const string FaqTopicVoucher = "voucher";
    public const string FaqTopicWarranty = "warranty";

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
