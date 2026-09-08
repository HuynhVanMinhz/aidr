namespace AIDR.Shared.Constants;

public static class ShopTrustBadgeConstants
{
    public const string VerifiedIdentity = "verified_identity";
    public const string TopRated = "top_rated";
    public const string FastShipping = "fast_shipping";

    public const decimal TopRatedMinAvg = 4.5m;
    public const int TopRatedMinCount = 20;

    public const int FastShippingWindowDays = 30;
    public const int FastShippingMaxDays = 3;
    public const double FastShippingMinRate = 0.90;

    public const int RestockMinSalesWindowDays = 7;
    public const int RestockMaxSalesWindowDays = 90;
    public const int RestockDefaultSalesWindowDays = 14;
    public const int RestockSuggestedCoverDays = 14;
}
