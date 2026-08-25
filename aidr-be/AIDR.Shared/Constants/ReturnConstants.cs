namespace AIDR.Shared.Constants;

public static class ReturnConstants
{
    public const string ResolutionReturnRefund = "ReturnRefund";

    public const string StatusPending = "Pending";
    public const string StatusApproved = "Approved";
    public const string StatusRejected = "Rejected";
    public const string StatusReceiving = "Receiving";
    public const string StatusRefunded = "Refunded";
    public const string StatusClosed = "Closed";

    public const string EvidenceTypeUnboxing = "Unboxing";
    public const string EvidenceTypeTesting = "Testing";
    public const string EvidenceTypeOther = "Other";

    public const string WalletTxTypeRefundDebit = "RefundDebit";
    public const string WalletReferenceTypeReturnRequest = "ReturnRequest";

    public const int MaxReasonLength = 500;
    public const int MaxDescriptionLength = 2000;
    public const int MaxAdminNoteLength = 500;
    public const int MaxStatusNoteLength = 300;
    public const int MaxMediaUrlLength = 512;
    public const int MaxPublicIdLength = 256;
    public const int MaxEvidences = 20;

    public const int DefaultListPage = 1;
    public const int DefaultListPageSize = 10;
    public const int MaxListPageSize = 100;
    public const int MaxListSearchLength = 100;

    public static readonly HashSet<string> AllStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        StatusPending,
        StatusApproved,
        StatusRejected,
        StatusReceiving,
        StatusRefunded,
        StatusClosed
    };

    public static readonly HashSet<string> EvidenceTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        EvidenceTypeUnboxing,
        EvidenceTypeTesting,
        EvidenceTypeOther
    };

    /// <summary>Order statuses from which a buyer may open a return request.</summary>
    public static readonly HashSet<string> EligibleOrderStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        OrderConstants.StatusShipping,
        OrderConstants.StatusDelivered,
        OrderConstants.StatusCompleted
    };

    /// <summary>Open return statuses that block a second request on the same order.</summary>
    public static readonly HashSet<string> ActiveReturnStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        StatusPending,
        StatusApproved,
        StatusReceiving,
        StatusRefunded
    };

    /// <summary>Admin pipeline transitions for UC-52.</summary>
    public static readonly IReadOnlyDictionary<string, string> StatusTransitions =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [StatusApproved] = StatusReceiving,
            [StatusReceiving] = StatusRefunded,
            [StatusRefunded] = StatusClosed
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
