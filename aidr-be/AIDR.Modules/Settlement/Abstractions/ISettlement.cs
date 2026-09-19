using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Settlement;

namespace AIDR.Modules.Settlement.Abstractions;

public sealed class SettlementOptions
{
    public const string SectionName = "Settlement";

    /// <summary>Platform fee taken from each settled order. 0.03 = 3%.</summary>
    public decimal CommissionRate { get; set; } = 0.03m;

    /// <summary>Days the shop's net is held after the order is Completed.</summary>
    public int HoldDays { get; set; } = 30;

    /// <summary>Delivered orders auto-complete after this many days if the buyer never confirms.</summary>
    public int AutoCompleteDays { get; set; } = 7;

    /// <summary>Batches below this net amount roll over to the next run.</summary>
    public decimal MinPayoutAmount { get; set; } = 50_000m;

    /// <summary>`PayOs` transfers via payOS Chi hộ; `Manual` waits for an admin to mark it paid.</summary>
    public string PayoutMode { get; set; } = SettlementConstants.PayoutModePayOs;

    public int JobIntervalMinutes { get; set; } = 60;

    /// <summary>Turn the background job off entirely (tests, local runs).</summary>
    public bool EnableBackgroundJob { get; set; } = true;

    public bool IsManualPayout =>
        string.Equals(PayoutMode, SettlementConstants.PayoutModeManual, StringComparison.OrdinalIgnoreCase);
}

/// <summary>Result of one background sweep, surfaced for logging and the admin screen.</summary>
public sealed class SettlementSweepResult
{
    public int AutoCompletedOrders { get; init; }
    public int EntriesMadeEligible { get; init; }
    public int BatchesDispatched { get; init; }
    public int BatchesPolled { get; init; }
    public IReadOnlyList<string> Errors { get; init; } = Array.Empty<string>();
}

public interface ISettlementRepository
{
    /* ---- seller ---- */

    Task<ShopBankAccountDto?> GetBankAccountAsync(Guid shopId, CancellationToken ct = default);

    Task<ShopBankAccountDto> UpsertBankAccountAsync(
        Guid shopId,
        UpsertShopBankAccountRequest request,
        CancellationToken ct = default);

    Task<ShopBankAccountDto> VerifyBankAccountAsync(
        Guid shopId,
        Guid adminUserId,
        VerifyShopBankAccountRequest request,
        CancellationToken ct = default);

    Task<SettlementEntryListDto> ListEntriesAsync(
        Guid? shopId,
        string? status,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<SettlementSummaryDto> GetSummaryAsync(Guid shopId, CancellationToken ct = default);

    Task<PayoutBatchListDto> ListBatchesAsync(
        PayoutBatchQueryRequest request,
        CancellationToken ct = default);

    /* ---- admin ---- */

    Task<IReadOnlyList<SettlementEligibleShopDto>> GetEligibleShopsAsync(
        DateTime asOfUtc,
        CancellationToken ct = default);

    Task<PayoutBatchDto> CreateBatchAsync(
        Guid shopId,
        DateTime periodToUtc,
        CancellationToken ct = default);

    Task<PayoutBatchDto> ApproveBatchAsync(
        Guid payoutBatchId,
        Guid adminUserId,
        CancellationToken ct = default);

    Task<PayoutBatchDto> CancelBatchAsync(
        Guid payoutBatchId,
        Guid adminUserId,
        CancellationToken ct = default);

    Task<PayoutBatchDto> GetBatchAsync(Guid payoutBatchId, CancellationToken ct = default);

    Task<PayoutBatchDto> MarkBatchPaidAsync(
        Guid payoutBatchId,
        Guid adminUserId,
        string? reference,
        CancellationToken ct = default);

    Task<PayoutBatchDto> MarkBatchFailedAsync(
        Guid payoutBatchId,
        string failureReason,
        CancellationToken ct = default);

    /// <summary>Flip Approved -> Processing and hand back what payOS needs. Written before the call.</summary>
    Task<PayoutExecutionContext> BeginBatchExecutionAsync(
        Guid payoutBatchId,
        CancellationToken ct = default);

    Task<PayoutBatchDto> CompleteBatchPayoutAsync(
        Guid payoutBatchId,
        string providerPayoutId,
        string providerState,
        string? rawJson,
        CancellationToken ct = default);

    Task<PayoutBatchDto> HoldEntryAsync(
        Guid settlementEntryId,
        string reason,
        CancellationToken ct = default);

    Task ReleaseEntryHoldAsync(Guid settlementEntryId, CancellationToken ct = default);

    Task<PlatformCommissionReportDto> GetCommissionReportAsync(
        DateTime fromUtc,
        DateTime toExclusiveUtc,
        CancellationToken ct = default);

    /* ---- background job ---- */

    Task<IReadOnlyList<Guid>> GetOrdersDueForAutoCompleteAsync(
        DateTime cutoffUtc,
        int limit,
        CancellationToken ct = default);

    Task<IReadOnlyList<AdminShopBankAccountDto>> ListAllBankAccountsAsync(
        string? status,
        CancellationToken ct = default);

    Task<int> PromoteDueEntriesAsync(DateTime nowUtc, CancellationToken ct = default);

    Task<IReadOnlyList<(Guid PayoutBatchId, string ProviderPayoutId)>> GetBatchesAwaitingProviderAsync(
        CancellationToken ct = default);

    Task<Guid?> GetShopOwnerUserIdAsync(Guid shopId, CancellationToken ct = default);
}

public sealed class PayoutExecutionContext
{
    public required Guid PayoutBatchId { get; init; }
    public required string BatchCode { get; init; }
    public required decimal NetAmount { get; init; }
    public string? ToBin { get; init; }
    public required string ToAccountNumber { get; init; }
    public required string ShopName { get; init; }
}

public interface ISettlementService
{
    Task<ShopBankAccountDto?> GetSellerBankAccountAsync(Guid ownerUserId, CancellationToken ct = default);

    Task<ShopBankAccountDto> UpsertSellerBankAccountAsync(
        Guid ownerUserId,
        UpsertShopBankAccountRequest request,
        CancellationToken ct = default);

    Task<SettlementEntryListDto> GetSellerEntriesAsync(
        Guid ownerUserId,
        SettlementQueryRequest request,
        CancellationToken ct = default);

    Task<SettlementSummaryDto> GetSellerSummaryAsync(Guid ownerUserId, CancellationToken ct = default);

    Task<PayoutBatchListDto> GetSellerBatchesAsync(
        Guid ownerUserId,
        PayoutBatchQueryRequest request,
        CancellationToken ct = default);

    /* admin */

    Task<ShopBankAccountDto> VerifyBankAccountAsync(
        Guid shopId,
        Guid adminUserId,
        VerifyShopBankAccountRequest request,
        CancellationToken ct = default);

    Task<IReadOnlyList<SettlementEligibleShopDto>> GetEligibleShopsAsync(CancellationToken ct = default);

    Task<IReadOnlyList<AdminShopBankAccountDto>> ListAllBankAccountsAsync(
        string? status,
        CancellationToken ct = default);

    Task<PayoutBatchDto> CreateBatchAsync(
        CreatePayoutBatchRequest request,
        CancellationToken ct = default);

    /// <summary>Approve the batch (release the money) and, unless payouts are manual, send it.</summary>
    Task<PayoutBatchDto> ApproveBatchAsync(
        Guid payoutBatchId,
        Guid adminUserId,
        CancellationToken ct = default);

    Task<PayoutBatchDto> ExecuteBatchAsync(Guid payoutBatchId, CancellationToken ct = default);

    Task<PayoutBatchDto> CancelBatchAsync(
        Guid payoutBatchId,
        Guid adminUserId,
        CancellationToken ct = default);

    Task<PayoutBatchDto> MarkBatchPaidAsync(
        Guid payoutBatchId,
        Guid adminUserId,
        MarkPayoutPaidRequest request,
        CancellationToken ct = default);

    Task<PayoutBatchListDto> ListBatchesAsync(
        PayoutBatchQueryRequest request,
        CancellationToken ct = default);

    Task<SettlementEntryListDto> ListEntriesAsync(
        SettlementQueryRequest request,
        Guid? shopId,
        CancellationToken ct = default);

    Task<PayoutBatchDto> HoldEntryAsync(
        Guid settlementEntryId,
        HoldSettlementEntryRequest request,
        CancellationToken ct = default);

    Task<PlatformCommissionReportDto> GetCommissionReportAsync(
        PlatformCommissionQueryRequest request,
        CancellationToken ct = default);

    Task<decimal> GetPayoutBalanceAsync(CancellationToken ct = default);

    /// <summary>One pass of the background sweep; also callable from an admin endpoint.</summary>
    Task<SettlementSweepResult> RunSweepAsync(CancellationToken ct = default);
}
