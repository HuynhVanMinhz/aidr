namespace AIDR.Shared.Constants;

public static class PriceAlertConstants
{
    public const string AlertTypePriceDrop = "PriceDrop";
    public const string AlertTypeBackInStock = "BackInStock";

    public const decimal DefaultThresholdPct = 5.00m;
    public const decimal DefaultThresholdAmount = 50_000m;
    public const int DefaultAlertTtlDays = 90;
    public const int NotificationDedupeHours = 24;

    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public const int MinHistoryDays = 7;
    public const int MaxHistoryDays = 365;
    public const int DefaultHistoryDays = 90;

    public static readonly HashSet<string> AllowedAlertTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        AlertTypePriceDrop,
        AlertTypeBackInStock
    };

    public static (int Page, int PageSize) NormalizePaging(int page, int pageSize)
    {
        var normalizedPage = page < 1 ? 1 : page;
        var normalizedSize = pageSize < 1
            ? DefaultPageSize
            : Math.Min(pageSize, MaxPageSize);
        return (normalizedPage, normalizedSize);
    }

    public static int NormalizeHistoryDays(int days) =>
        Math.Clamp(days, MinHistoryDays, MaxHistoryDays);

    public static string CanonicalAlertType(string alertType) =>
        AllowedAlertTypes.First(t => string.Equals(t, alertType, StringComparison.OrdinalIgnoreCase));

    public static string PriceHistoryCacheKey(Guid productId, int days) =>
        $"product:price-history:{productId:D}:{days}";

    /// <summary>
    /// Keys to drop after a selling-price change. Covers common <c>days</c> presets
    /// (ICacheService has no prefix delete).
    /// </summary>
    public static IReadOnlyList<string> PriceHistoryCacheKeysToInvalidate(Guid productId) =>
    [
        PriceHistoryCacheKey(productId, MinHistoryDays),
        PriceHistoryCacheKey(productId, 30),
        PriceHistoryCacheKey(productId, DefaultHistoryDays),
        PriceHistoryCacheKey(productId, MaxHistoryDays)
    ];
}
