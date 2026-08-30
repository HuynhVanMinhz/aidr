namespace AIDR.Shared.Constants;

public static class AdminConstants
{
    public const int MaxCategoryNameLength = 120;
    public const int MaxCategorySlugLength = 140;
    public const int MaxCategoryDescriptionLength = 500;
    public const int MaxCategoryImageUrlLength = 512;

    public const int MaxShopNameLength = 150;
    public const int MaxShopSlugLength = 160;
    public const int MaxShopTaglineLength = 200;
    public const int MaxShopShortDescriptionLength = 500;
    public const int MaxShopEmailLength = 256;
    public const int MaxShopPhoneLength = 20;
    public const int MaxShopProvinceLength = 100;
    public const int MaxShopDistrictLength = 100;
    public const int MaxShopWardLength = 100;
    public const int MaxShopStreetAddressLength = 256;
    public const int MaxShopPolicyLength = 2000;
    public const int MaxShopOpeningHoursJsonLength = 1000;
    public const int MaxShopUrlLength = 512;
    public const int MaxSellerAdminNoteLength = 500;
    public const int MaxSellerBusinessInfoLength = 1000;
    public const int MaxSellerDocumentUrls = 10;
    public const int MaxSellerDocumentUrlLength = 512;

    public const int DefaultListPage = 1;
    public const int DefaultListPageSize = 10;
    public const int MaxListPageSize = 100;
    public const int MaxListSearchLength = 100;

    public const string SellerRegistrationStatusPending = "Pending";
    public const string SellerRegistrationStatusApproved = "Approved";
    public const string SellerRegistrationStatusRejected = "Rejected";

    public const string ProductStatusDraft = "Draft";
    public const string ProductStatusPending = "Pending";
    public const string ProductStatusApproved = "Approved";
    public const string ProductStatusRejected = "Rejected";
    public const string ProductStatusInactive = "Inactive";
    public const string ProductStatusDeleted = "Deleted";

    public const string ModerationActionApprove = "Approve";
    public const string ModerationActionReject = "Reject";

    public const int MaxProductModerationReasonLength = 500;

    public const string ShopStatusActive = "Active";
    public const string ShopCostingMethodFifo = "FIFO";
    public const string WalletCurrencyVnd = "VND";

    public const string UserStatusActive = AuthConstants.UserStatusActive;
    public const string UserStatusLocked = AuthConstants.UserStatusLocked;
    public const string UserStatusPendingDeletion = AuthConstants.UserStatusPendingDeletion;

    public const string InsightGranularityDay = "day";
    public const string InsightGranularityWeek = "week";
    public const string InsightGranularityMonth = "month";
    public const int DefaultInsightDays = 30;
    public const int MaxInsightDays = 366;
    public const int TopProductLimit = 10;

    public static readonly HashSet<string> AllowedUserStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        UserStatusActive,
        UserStatusLocked,
        UserStatusPendingDeletion
    };

    public static readonly HashSet<string> AllowedInsightGranularities = new(StringComparer.OrdinalIgnoreCase)
    {
        InsightGranularityDay,
        InsightGranularityWeek,
        InsightGranularityMonth
    };

    /// <summary>Paid shop orders that count toward platform GMV / top products.</summary>
    public static readonly HashSet<string> InsightSalesOrderStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        OrderConstants.StatusPaid,
        OrderConstants.StatusConfirmed,
        OrderConstants.StatusShipping,
        OrderConstants.StatusDelivered,
        OrderConstants.StatusCompleted
    };

    public static (int Page, int PageSize) NormalizePaging(int page, int pageSize)
    {
        var normalizedPage = page < 1 ? DefaultListPage : page;
        var normalizedSize = pageSize < 1
            ? DefaultListPageSize
            : Math.Min(pageSize, MaxListPageSize);
        return (normalizedPage, normalizedSize);
    }
}
