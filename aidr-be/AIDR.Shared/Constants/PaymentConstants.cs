namespace AIDR.Shared.Constants;

public static class PaymentConstants
{
    public const string ProviderPayOs = "payOS";

    public const string StatusPending = "Pending";
    public const string StatusSucceeded = "Succeeded";
    public const string StatusFailed = "Failed";
    public const string StatusCancelled = "Cancelled";
    public const string StatusRefunded = "Refunded";

    public const string OrderStatusPendingPayment = "PendingPayment";
    public const string OrderStatusPaid = "Paid";

    public const string PayOsSuccessCode = "00";

    /// <summary>payOS payment-link state that means the money has arrived.</summary>
    public const string PayOsLinkStatusPaid = "PAID";

    public const string PayOsLinkStatusPending = "PENDING";
    public const string PayOsLinkStatusProcessing = "PROCESSING";
    public const string PayOsLinkStatusCancelled = "CANCELLED";
    public const string PayOsLinkStatusExpired = "EXPIRED";
    public const string PayOsLinkStatusFailed = "FAILED";

    /// <summary>payOS VietQR description limit.</summary>
    public const int MaxDescriptionLength = 25;

    public const string OptionsSectionName = "PayOS";
}
