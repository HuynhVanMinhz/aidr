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
        WalletTxTypeAdjustment,
        SettlementConstants.TxSettlementHold,
        SettlementConstants.TxCommissionFee,
        SettlementConstants.TxSettlementRelease,
        SettlementConstants.TxPayout,
        SettlementConstants.TxSettlementReversal
    };

    /// <summary>
    /// Paid shop orders that count as sales / product revenue.
    /// Keeps open return disputes (<see cref="OrderConstants.StatusReturnRequested"/>);
    /// drops only after refund/exchange completes (<see cref="OrderConstants.StatusReturned"/>)
    /// or cancel - not when the buyer first requests a return.
    /// </summary>
    public static readonly HashSet<string> SalesOrderStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        OrderConstants.StatusPaid,
        OrderConstants.StatusConfirmed,
        OrderConstants.StatusShipping,
        OrderConstants.StatusDelivered,
        OrderConstants.StatusCompleted,
        OrderConstants.StatusReturnRequested
    };

    /// <summary>
    /// Statuses that reverse dashboard recognized revenue (orders with <c>CompletedAt</c>).
    /// </summary>
    public static readonly HashSet<string> RecognizedRevenueExcludedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        OrderConstants.StatusCancelled,
        OrderConstants.StatusReturned
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
