namespace AIDR.Shared.Constants;

/// <summary>
/// Escrow / settlement vocabulary. See docs/solution-escrow-settlement.md.
/// </summary>
public static class SettlementConstants
{
    /* Settlement entry lifecycle */
    public const string EntryStatusHolding = "Holding";
    public const string EntryStatusOnHold = "OnHold";
    public const string EntryStatusEligible = "Eligible";
    public const string EntryStatusApproved = "Approved";
    public const string EntryStatusPaid = "Paid";
    public const string EntryStatusReversed = "Reversed";

    /* Payout batch lifecycle */
    public const string BatchStatusDraft = "Draft";
    public const string BatchStatusApproved = "Approved";
    public const string BatchStatusProcessing = "Processing";
    public const string BatchStatusPaid = "Paid";
    public const string BatchStatusFailed = "Failed";
    public const string BatchStatusCancelled = "Cancelled";

    /* Shop bank account */
    public const string BankStatusUnverified = "Unverified";
    public const string BankStatusVerified = "Verified";
    public const string BankStatusRejected = "Rejected";

    /* Wallet transaction types added by this flow */
    public const string TxSettlementHold = "SettlementHold";
    public const string TxCommissionFee = "CommissionFee";
    public const string TxSettlementRelease = "SettlementRelease";
    public const string TxPayout = "Payout";
    public const string TxSettlementReversal = "SettlementReversal";
    public const string TxPlatformSubsidy = "PlatformSubsidy";

    public const string WalletReferenceTypeOrder = "Order";
    public const string WalletReferenceTypePayoutBatch = "PayoutBatch";

    /* Payout execution mode */
    public const string PayoutModePayOs = "PayOs";
    public const string PayoutModeManual = "Manual";

    public const int MaxBatchCodeLength = 30;
    public const int MaxHoldReasonLength = 300;
    public const int MaxFailureReasonLength = 500;
    public const int MaxAttemptCount = 3;

    public const int DefaultListPage = 1;
    public const int DefaultListPageSize = 20;
    public const int MaxListPageSize = 100;

    /// <summary>Entries whose net is sitting in the shop's pending balance.</summary>
    public static readonly HashSet<string> PendingBalanceStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        EntryStatusHolding,
        EntryStatusOnHold,
        EntryStatusEligible
    };

    /// <summary>Entries locked into a batch - no longer freely reversible.</summary>
    public static readonly HashSet<string> ReleasedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        EntryStatusApproved,
        EntryStatusPaid
    };

    public static readonly HashSet<string> EntryStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        EntryStatusHolding,
        EntryStatusOnHold,
        EntryStatusEligible,
        EntryStatusApproved,
        EntryStatusPaid,
        EntryStatusReversed
    };

    public static readonly HashSet<string> OpenBatchStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        BatchStatusDraft,
        BatchStatusApproved,
        BatchStatusProcessing
    };

    public static (int Page, int PageSize) NormalizePaging(int page, int pageSize)
    {
        var normalizedPage = page < 1 ? DefaultListPage : page;
        var normalizedSize = pageSize < 1
            ? DefaultListPageSize
            : Math.Min(pageSize, MaxListPageSize);
        return (normalizedPage, normalizedSize);
    }

    /// <summary>
    /// Commission base excludes shipping - charging the platform fee on the
    /// courier fee would be wrong once shipping is no longer free.
    /// </summary>
    public static decimal CommissionableAmount(decimal subtotal, decimal discount) =>
        Math.Max(0m, subtotal - discount);

    /// <summary>VND has no minor unit and payOS takes integer amounts.</summary>
    public static decimal RoundVnd(decimal amount) =>
        decimal.Round(amount, 0, MidpointRounding.AwayFromZero);
}
