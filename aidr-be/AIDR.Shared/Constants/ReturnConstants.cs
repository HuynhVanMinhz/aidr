namespace AIDR.Shared.Constants;

public static class ReturnConstants
{
    public const string ResolutionReturnRefund = "ReturnRefund";
    public const string ResolutionExchange = "Exchange";

    public const string StatusPending = "Pending";
    public const string StatusApproved = "Approved";
    public const string StatusRejected = "Rejected";
    public const string StatusSellerConfirmed = "SellerConfirmed";
    public const string StatusReceiving = "Receiving";
    public const string StatusAccepted = "Accepted";
    public const string StatusRefunded = "Refunded";
    public const string StatusRefundPending = "RefundPending";
    public const string StatusRefundFailed = "RefundFailed";
    public const string StatusExchanged = "Exchanged";
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

    public static readonly HashSet<string> ResolutionTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ResolutionReturnRefund,
        ResolutionExchange
    };

    public static readonly HashSet<string> AllStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        StatusPending,
        StatusApproved,
        StatusRejected,
        StatusSellerConfirmed,
        StatusReceiving,
        StatusAccepted,
        StatusRefunded,
        StatusExchanged,
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
        StatusSellerConfirmed,
        StatusReceiving,
        StatusAccepted,
        StatusRefunded,
        StatusExchanged
    };

    /// <summary>
    /// Admin pipeline after seller accepts goods: Accepted→Refunded|Exchanged→Closed.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string[]> AdminStatusTransitions =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            [StatusAccepted] = [StatusRefunded, StatusExchanged],
            [StatusRefunded] = [StatusClosed],
            [StatusExchanged] = [StatusClosed]
        };

    /// <summary>Seller pipeline after admin forwards the request.</summary>
    public static readonly IReadOnlyDictionary<string, string> SellerStatusTransitions =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [StatusApproved] = StatusSellerConfirmed,
            [StatusSellerConfirmed] = StatusReceiving,
            [StatusReceiving] = StatusAccepted
        };

    /// <summary>Statuses from which seller may reject the request.</summary>
    public static readonly HashSet<string> SellerRejectableStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        StatusApproved,
        StatusReceiving
    };

    public static string CanonicalResolutionType(string resolutionType)
    {
        var match = ResolutionTypes.FirstOrDefault(r =>
            string.Equals(r, resolutionType, StringComparison.OrdinalIgnoreCase));
        if (match is null)
            throw new Exceptions.AppException("Resolution type must be ReturnRefund or Exchange.");
        return match;
    }

    public static string ExpectedResolutionOutcome(string resolutionType) =>
        string.Equals(resolutionType, ResolutionExchange, StringComparison.OrdinalIgnoreCase)
            ? StatusExchanged
            : StatusRefunded;

    public static (int Page, int PageSize) NormalizePaging(int page, int pageSize)
    {
        var normalizedPage = page < 1 ? DefaultListPage : page;
        var normalizedSize = pageSize < 1
            ? DefaultListPageSize
            : Math.Min(pageSize, MaxListPageSize);
        return (normalizedPage, normalizedSize);
    }
}
