namespace AIDR.Shared.Constants;

public static class OrderConstants
{
    public const string StatusPendingPayment = "PendingPayment";
    public const string StatusPaid = "Paid";
    public const string StatusConfirmed = "Confirmed";
    public const string StatusShipping = "Shipping";
    public const string StatusDelivered = "Delivered";
    public const string StatusCompleted = "Completed";
    public const string StatusCancelled = "Cancelled";
    public const string StatusReturnRequested = "ReturnRequested";
    public const string StatusReturned = "Returned";

    public const string PaymentProviderPayOs = "payOS";
    public const string PaymentStatusPending = "Pending";
    public const string PaymentStatusSucceeded = "Succeeded";
    public const string PaymentStatusCancelled = "Cancelled";

    public const string InventoryReasonOrderReserve = "OrderReserve";
    public const string InventoryReasonOrderRelease = "OrderRelease";
    public const string InventoryReferenceTypeOrder = "Order";

    public const string WalletTxTypeOrderCredit = "OrderCredit";
    public const string WalletReferenceTypeOrder = "Order";

    public const string CostingMethodFifo = "FIFO";
    public const string CostingMethodWeightedAverage = "WeightedAverage";

    public const string LotStatusOpen = "Open";
    public const string LotStatusDepleted = "Depleted";
    public const string LotStatusVoid = "Void";

    public const string ApprovedProductStatus = "Approved";
    public const string ActiveShopStatus = "Active";

    public const int MaxBuyerNoteLength = 500;
    public const int MaxSellerNoteLength = 500;
    public const int MaxCancelReasonLength = 300;
    public const int MaxStatusNoteLength = 300;
    public const int MaxTrackingCodeLength = 100;
    public const int MaxOrderCodeLength = 30;

    public const int DefaultListPage = 1;
    public const int DefaultListPageSize = 10;
    public const int MaxListPageSize = 100;

    public const decimal DefaultShippingFee = 0m;
    public const decimal DefaultDiscountAmount = 0m;

    public static readonly HashSet<string> BuyerListStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        StatusPendingPayment,
        StatusPaid,
        StatusConfirmed,
        StatusShipping,
        StatusDelivered,
        StatusCompleted,
        StatusCancelled,
        StatusReturnRequested,
        StatusReturned
    };

    /// <summary>Statuses sellers can filter on in the shop order list.</summary>
    public static readonly HashSet<string> SellerListStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        StatusPendingPayment,
        StatusPaid,
        StatusConfirmed,
        StatusShipping,
        StatusDelivered,
        StatusCompleted,
        StatusCancelled,
        StatusReturnRequested,
        StatusReturned
    };

    /// <summary>Allowed seller fulfillment transitions: Paid→Confirmed→Shipping→Delivered.</summary>
    public static readonly IReadOnlyDictionary<string, string> SellerStatusTransitions =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [StatusPaid] = StatusConfirmed,
            [StatusConfirmed] = StatusShipping,
            [StatusShipping] = StatusDelivered
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
