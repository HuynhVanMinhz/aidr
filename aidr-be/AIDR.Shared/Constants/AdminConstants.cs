namespace AIDR.Shared.Constants;

public static class AdminConstants
{
    public const int MaxCategoryNameLength = 120;
    public const int MaxCategorySlugLength = 140;
    public const int MaxCategoryDescriptionLength = 500;
    public const int MaxCategoryImageUrlLength = 512;

    public const int MaxShopNameLength = 150;
    public const int MaxShopSlugLength = 160;
    public const int MaxShopShortDescriptionLength = 500;
    public const int MaxSellerAdminNoteLength = 500;
    public const int MaxSellerBusinessInfoLength = 1000;

    public const string SellerRegistrationStatusPending = "Pending";
    public const string SellerRegistrationStatusApproved = "Approved";
    public const string SellerRegistrationStatusRejected = "Rejected";

    public const string ShopStatusActive = "Active";
    public const string ShopCostingMethodFifo = "FIFO";
    public const string WalletCurrencyVnd = "VND";
}
