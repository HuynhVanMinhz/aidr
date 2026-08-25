namespace AIDR.Shared.Constants;

public static class SellerFinanceConstants
{
    public const string GranularityDay = "day";
    public const string GranularityWeek = "week";
    public const string GranularityMonth = "month";

    public const string WalletTxTypeOrderCredit = OrderConstants.WalletTxTypeOrderCredit;
    public const string WalletTxTypeRefundDebit = ReturnConstants.WalletTxTypeRefundDebit;
    public const string WalletTxTypeWithdrawal = "Withdrawal";
    public const string WalletTxTypeAdjustment = "Adjustment";

    public const string CurrencyVnd = "VND";

    public const int DefaultReportDays = 30;
    public const int MaxReportDays = 366;
    public const int TopProductLimit = 10;
    public const int RecentOrderLimit = 5;
    public const int LowStockPreviewLimit = 5;

    public const int DefaultListPage = 1;
    public const int DefaultListPageSize = 20;
    public const int MaxListPageSize = 100;

    public static readonly HashSet<string> AllowedGranularities = new(StringComparer.OrdinalIgnoreCase)
    {
        GranularityDay,
        GranularityWeek,
        GranularityMonth
    };

    public static readonly HashSet<string> WalletTxTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        WalletTxTypeOrderCredit,
        WalletTxTypeRefundDebit,
        WalletTxTypeWithdrawal,
        WalletTxTypeAdjustment
    };

    /// <summary>Paid shop orders that count as sales (excludes unpaid, cancelled, returned).</summary>
    public static readonly HashSet<string> SalesOrderStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        OrderConstants.StatusPaid,
        OrderConstants.StatusConfirmed,
        OrderConstants.StatusShipping,
        OrderConstants.StatusDelivered,
        OrderConstants.StatusCompleted
    };

    /// <summary>Buyer paid but seller wallet not credited yet (credit happens on Completed).</summary>
    public static readonly HashSet<string> PendingSettlementStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        OrderConstants.StatusPaid,
        OrderConstants.StatusConfirmed,
        OrderConstants.StatusShipping,
        OrderConstants.StatusDelivered
    };

    /// <summary>Orders waiting on seller fulfillment action.</summary>
    public static readonly HashSet<string> AwaitingFulfillmentStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        OrderConstants.StatusPaid,
        OrderConstants.StatusConfirmed
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
