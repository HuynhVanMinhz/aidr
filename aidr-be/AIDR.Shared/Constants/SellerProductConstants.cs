namespace AIDR.Shared.Constants;

public static class SellerProductConstants
{
    public const int MaxNameLength = 256;
    public const int MaxSlugLength = 280;
    public const int MaxShortDescriptionLength = 500;
    public const int MaxBrandLength = 100;
    public const int MaxModelNumberLength = 100;
    public const int MaxOriginCountryLength = 80;
    public const int MaxImageUrlLength = 512;
    public const int MaxPublicIdLength = 256;
    public const int MaxImagesPerProduct = 20;
    public const int MaxTagsJsonLength = 4000;
    public const int MaxSpecsJsonLength = 8000;
    public const int DefaultPage = 1;
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public const string StatusDraft = "Draft";
    public const string StatusPending = "Pending";
    public const string StatusApproved = "Approved";
    public const string StatusRejected = "Rejected";
    public const string StatusInactive = "Inactive";
    public const string StatusDeleted = "Deleted";

    public const string ConditionNew = "New";
    public const string ConditionLikeNew = "LikeNew";
    public const string ConditionRefurbished = "Refurbished";
    public const string ConditionUsed = "Used";

    public const string CurrencyVnd = "VND";

    public static readonly HashSet<string> AllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        StatusDraft,
        StatusPending,
        StatusApproved,
        StatusRejected,
        StatusInactive,
        StatusDeleted
    };

    public static readonly HashSet<string> AllowedConditions = new(StringComparer.OrdinalIgnoreCase)
    {
        ConditionNew,
        ConditionLikeNew,
        ConditionRefurbished,
        ConditionUsed
    };

    public static string ProductDetailCacheKey(Guid productId) => $"product:{productId:D}";
}
