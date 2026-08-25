namespace AIDR.Shared.Constants;

public static class DiscoveryConstants
{
    public const int DefaultPage = 1;
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;
    public const int MaxSearchQueryLength = 200;
    public const int MaxBrandLength = 100;
    public const int MaxSessionIdLength = 64;
    public const int MaxShopKeyLength = 160;
    public const int RecentReviewsLimit = 5;

    public const string SortNewest = "newest";
    public const string SortPriceAsc = "price_asc";
    public const string SortPriceDesc = "price_desc";
    public const string SortPopular = "popular";
    public const string SortRating = "rating";

    public const string ActiveShopStatus = "Active";

    public static readonly TimeSpan ProductListCacheTtl = TimeSpan.FromMinutes(3);
    public static readonly TimeSpan ProductDetailCacheTtl = TimeSpan.FromMinutes(3);
    public static readonly TimeSpan CategoryTreeCacheTtl = TimeSpan.FromMinutes(30);
    public static readonly TimeSpan ShopDetailCacheTtl = TimeSpan.FromMinutes(3);
    public static readonly TimeSpan ShopRatingCacheTtl = TimeSpan.FromMinutes(5);

    public const string CacheKeyCategoriesTree = "categories:tree";
}
