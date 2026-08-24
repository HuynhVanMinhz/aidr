namespace AIDR.Shared.Constants;

public static class SellerInventoryConstants
{
    public const int DefaultPage = 1;
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;
    public const int DefaultTransactionLimit = 30;
    public const int MaxTransactionLimit = 100;

    public const int MaxLotCodeLength = 40;
    public const int MaxSupplierNameLength = 150;
    public const int MaxInvoiceNumberLength = 80;
    public const int MaxLotNoteLength = 500;
    public const int MaxTransactionNoteLength = 300;
    public const int MaxPriceReasonLength = 300;
    public const int MaxQuantity = 1_000_000;
    public const int MaxLowStockThreshold = 100_000;
    public const decimal MaxMoney = 999_999_999_999.99m;

    public const string LotStatusOpen = "Open";
    public const string LotStatusDepleted = "Depleted";
    public const string LotStatusVoid = "Void";

    public const string ReasonStockIn = "StockIn";
    public const string ReasonManualAdjust = "ManualAdjust";

    public const string ReferenceTypeLot = "Lot";

    public const string CurrencyVnd = "VND";
}
