namespace AIDR.Shared.Dtos.Settlement;

/* -------------------------------------------------------------------------- */
/* Shop bank account                                                          */
/* -------------------------------------------------------------------------- */

public sealed class ShopBankAccountDto
{
    public Guid ShopBankAccountId { get; init; }
    public Guid ShopId { get; init; }
    public string? BankBin { get; init; }
    public string BankName { get; init; } = null!;
    /// <summary>Masked for display: only the last 4 digits are returned.</summary>
    public string AccountNumberMasked { get; init; } = null!;
    public string AccountName { get; init; } = null!;
    public string Status { get; init; } = null!;
    public string? RejectReason { get; init; }
    public DateTime? VerifiedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public sealed class AdminShopBankAccountDto
{
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public Guid ShopBankAccountId { get; init; }
    public string? BankBin { get; init; }
    public string BankName { get; init; } = null!;
    public string AccountNumberMasked { get; init; } = null!;
    public string AccountName { get; init; } = null!;
    public string Status { get; init; } = null!;
    public string? RejectReason { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public sealed class UpsertShopBankAccountRequest
{
    public string? BankBin { get; set; }
    public string BankName { get; set; } = null!;
    public string AccountNumber { get; set; } = null!;
    public string AccountName { get; set; } = null!;
}

public sealed class VerifyShopBankAccountRequest
{
    /// <summary>true = approve, false = reject (reason required).</summary>
    public bool Approve { get; set; }
    public string? Reason { get; set; }
}

/* -------------------------------------------------------------------------- */
/* Settlement entries                                                         */
/* -------------------------------------------------------------------------- */

public sealed class SettlementEntryDto
{
    public Guid SettlementEntryId { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string? ShopName { get; init; }
    public decimal GrossAmount { get; init; }
    /// <summary>Platform voucher discount absorbed by the platform; 0 for shop vouchers.</summary>
    public decimal SubsidyAmount { get; init; }
    public decimal CommissionRate { get; init; }
    public decimal CommissionAmount { get; init; }
    public decimal NetAmount { get; init; }
    public string Currency { get; init; } = null!;
    public string Status { get; init; } = null!;
    public DateTime HoldUntil { get; init; }
    /// <summary>Days left before the entry can be released; 0 once it is due.</summary>
    public int DaysUntilRelease { get; init; }
    public DateTime? EligibleAt { get; init; }
    public Guid? PayoutBatchId { get; init; }
    public string? BatchCode { get; init; }
    public string? HoldReason { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class SettlementEntryListDto
{
    public IReadOnlyList<SettlementEntryDto> Items { get; init; } = Array.Empty<SettlementEntryDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages { get; init; }
}

public sealed class SettlementSummaryDto
{
    public string Currency { get; init; } = "VND";
    public decimal HoldingAmount { get; init; }
    public int HoldingCount { get; init; }
    public decimal OnHoldAmount { get; init; }
    public int OnHoldCount { get; init; }
    public decimal EligibleAmount { get; init; }
    public int EligibleCount { get; init; }
    public decimal ApprovedAmount { get; init; }
    public int ApprovedCount { get; init; }
    public decimal PaidAmount { get; init; }
    public int PaidCount { get; init; }
    public decimal CommissionPaid { get; init; }
    /// <summary>Earliest hold expiry among entries still holding.</summary>
    public DateTime? NextReleaseAt { get; init; }
    public bool HasVerifiedBankAccount { get; init; }
}

public sealed class SettlementQueryRequest
{
    public string? Status { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

/* -------------------------------------------------------------------------- */
/* Payout batches                                                             */
/* -------------------------------------------------------------------------- */

public sealed class PayoutBatchDto
{
    public Guid PayoutBatchId { get; init; }
    public string BatchCode { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string? ShopName { get; init; }
    public string? AccountNumberMasked { get; init; }
    public string? AccountName { get; init; }
    public string? BankName { get; init; }
    public DateTime PeriodTo { get; init; }
    public int EntryCount { get; init; }
    public decimal GrossAmount { get; init; }
    public decimal CommissionAmount { get; init; }
    public decimal NetAmount { get; init; }
    public string Currency { get; init; } = null!;
    public string Status { get; init; } = null!;
    public DateTime? ApprovedAt { get; init; }
    public string? ProviderPayoutId { get; init; }
    public string? ProviderState { get; init; }
    public DateTime? PaidAt { get; init; }
    public string? FailureReason { get; init; }
    public int AttemptCount { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class PayoutBatchListDto
{
    public IReadOnlyList<PayoutBatchDto> Items { get; init; } = Array.Empty<PayoutBatchDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages { get; init; }
}

public sealed class PayoutBatchQueryRequest
{
    public string? Status { get; set; }
    public Guid? ShopId { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

/// <summary>One shop's payable position, for the admin settlement screen.</summary>
public sealed class SettlementEligibleShopDto
{
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public int EntryCount { get; init; }
    public decimal GrossAmount { get; init; }
    public decimal CommissionAmount { get; init; }
    public decimal NetAmount { get; init; }
    public string Currency { get; init; } = "VND";
    public string? AccountNumberMasked { get; init; }
    public string? AccountName { get; init; }
    public string? BankName { get; init; }
    public string BankStatus { get; init; } = SettlementBankStatus.Missing;
    public bool HasOpenBatch { get; init; }
    /// <summary>Empty when the shop can be paid right now.</summary>
    public IReadOnlyList<string> Blockers { get; init; } = Array.Empty<string>();
    public bool CanPayout { get; init; }
}

public static class SettlementBankStatus
{
    public const string Missing = "Missing";
}

public sealed class CreatePayoutBatchRequest
{
    public Guid ShopId { get; set; }
    /// <summary>Cut-off; defaults to now. Only entries eligible at or before it are included.</summary>
    public DateTime? PeriodTo { get; set; }
}

public sealed class MarkPayoutPaidRequest
{
    /// <summary>Bank reference for a payout transferred outside payOS.</summary>
    public string? Reference { get; set; }
}

public sealed class HoldSettlementEntryRequest
{
    public string Reason { get; set; } = null!;
}

/* -------------------------------------------------------------------------- */
/* Platform commission report                                                 */
/* -------------------------------------------------------------------------- */

public sealed class PlatformCommissionPointDto
{
    public DateTime Date { get; init; }
    public int OrderCount { get; init; }
    public decimal Gmv { get; init; }
    public decimal Commission { get; init; }
    public decimal PlatformSubsidy { get; init; }
    /// <summary>Net platform earning = Commission − PlatformSubsidy.</summary>
    public decimal NetPlatformEarning { get; init; }
    public decimal PaidToSeller { get; init; }
}

public sealed class PlatformCommissionReportDto
{
    public DateTime FromUtc { get; init; }
    public DateTime ToUtc { get; init; }
    public string Currency { get; init; } = "VND";
    public decimal CommissionRate { get; init; }
    public int OrderCount { get; init; }
    public decimal Gmv { get; init; }
    /// <summary>Commission recognised when payout batches were approved in the period.</summary>
    public decimal Commission { get; init; }
    /// <summary>
    /// Platform fee already snapshotted on Holding / OnHold / Eligible entries
    /// (orders completed but not yet paid out). Visible so admins see fee from
    /// successful payments before the hold window ends.
    /// </summary>
    public decimal AccruedCommission { get; init; }
    /// <summary>Total platform voucher subsidies paid out to sellers in this period.</summary>
    public decimal PlatformSubsidy { get; init; }
    /// <summary>Net platform earning = Commission − PlatformSubsidy.</summary>
    public decimal NetPlatformEarning { get; init; }
    public decimal PaidToSeller { get; init; }
    /// <summary>Net still held in escrow across every shop.</summary>
    public decimal EscrowHeld { get; init; }
    public decimal AwaitingPayout { get; init; }
    public IReadOnlyList<PlatformCommissionPointDto> Series { get; init; } =
        Array.Empty<PlatformCommissionPointDto>();
    public IReadOnlyList<PlatformCommissionShopDto> TopShops { get; init; } =
        Array.Empty<PlatformCommissionShopDto>();
}

public sealed class PlatformCommissionShopDto
{
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public int OrderCount { get; init; }
    public decimal Gmv { get; init; }
    public decimal Commission { get; init; }
}

public sealed class PlatformCommissionQueryRequest
{
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
}
