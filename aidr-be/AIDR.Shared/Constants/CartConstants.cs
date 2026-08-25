namespace AIDR.Shared.Constants;

public static class CartConstants
{
    public const string ApprovedStatus = "Approved";
    public const string ActiveShopStatus = "Active";

    public const int MaxQuantityPerItem = 99;

    public static string CacheKey(Guid userId) => $"user:{userId:D}:cart";
}
