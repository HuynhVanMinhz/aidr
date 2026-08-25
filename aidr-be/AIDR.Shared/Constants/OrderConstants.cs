namespace AIDR.Shared.Constants;

public static class OrderConstants
{
    public const string StatusPendingPayment = "PendingPayment";

    public const string PaymentProviderPayOs = "payOS";
    public const string PaymentStatusPending = "Pending";

    public const string InventoryReasonOrderReserve = "OrderReserve";
    public const string InventoryReferenceTypeOrder = "Order";

    public const string CostingMethodFifo = "FIFO";
    public const string CostingMethodWeightedAverage = "WeightedAverage";

    public const string LotStatusOpen = "Open";
    public const string LotStatusDepleted = "Depleted";
    public const string LotStatusVoid = "Void";

    public const string ApprovedProductStatus = "Approved";
    public const string ActiveShopStatus = "Active";

    public const int MaxBuyerNoteLength = 500;
    public const int MaxOrderCodeLength = 30;

    public const decimal DefaultShippingFee = 0m;
    public const decimal DefaultDiscountAmount = 0m;
}
