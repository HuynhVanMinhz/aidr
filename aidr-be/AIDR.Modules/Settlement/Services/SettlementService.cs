using AIDR.Modules.Engagement.Abstractions;
using AIDR.Modules.Order.Abstractions;
using AIDR.Modules.Payment.Abstractions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Modules.Settlement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Dtos.Settlement;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AIDR.Modules.Settlement.Services;

public sealed class SettlementService : ISettlementService
{
    private const int AutoCompleteBatchSize = 200;

    private readonly ISettlementRepository _settlements;
    private readonly ISellerProductRepository _sellerShops;
    private readonly IOrderRepository _orders;
    private readonly IPayOsClient _payOs;
    private readonly INotificationService _notifications;
    private readonly SettlementOptions _options;
    private readonly ILogger<SettlementService> _logger;

    public SettlementService(
        ISettlementRepository settlements,
        ISellerProductRepository sellerShops,
        IOrderRepository orders,
        IPayOsClient payOs,
        INotificationService notifications,
        IOptions<SettlementOptions> options,
        ILogger<SettlementService> logger)
    {
        _settlements = settlements;
        _sellerShops = sellerShops;
        _orders = orders;
        _payOs = payOs;
        _notifications = notifications;
        _options = options.Value;
        _logger = logger;
    }

    /* -------------------------------------------------------------- seller */

    public async Task<ShopBankAccountDto?> GetSellerBankAccountAsync(
        Guid ownerUserId,
        CancellationToken ct = default)
    {
        var shop = await RequireShopAsync(ownerUserId, ct);
        return await _settlements.GetBankAccountAsync(shop.ShopId, ct);
    }

    public async Task<ShopBankAccountDto> UpsertSellerBankAccountAsync(
        Guid ownerUserId,
        UpsertShopBankAccountRequest request,
        CancellationToken ct = default)
    {
        if (request is null)
            throw new AppException("Bank account details are required.");

        var shop = await RequireShopAsync(ownerUserId, ct);
        return await _settlements.UpsertBankAccountAsync(shop.ShopId, request, ct);
    }

    public async Task<SettlementEntryListDto> GetSellerEntriesAsync(
        Guid ownerUserId,
        SettlementQueryRequest request,
        CancellationToken ct = default)
    {
        var shop = await RequireShopAsync(ownerUserId, ct);
        return await _settlements.ListEntriesAsync(
            shop.ShopId,
            NormalizeEntryStatus(request?.Status),
            request?.Page ?? SettlementConstants.DefaultListPage,
            request?.PageSize ?? SettlementConstants.DefaultListPageSize,
            ct);
    }

    public async Task<SettlementSummaryDto> GetSellerSummaryAsync(
        Guid ownerUserId,
        CancellationToken ct = default)
    {
        var shop = await RequireShopAsync(ownerUserId, ct);
        return await _settlements.GetSummaryAsync(shop.ShopId, ct);
    }

    public async Task<PayoutBatchListDto> GetSellerBatchesAsync(
        Guid ownerUserId,
        PayoutBatchQueryRequest request,
        CancellationToken ct = default)
    {
        var shop = await RequireShopAsync(ownerUserId, ct);
        return await _settlements.ListBatchesAsync(
            new PayoutBatchQueryRequest
            {
                ShopId = shop.ShopId,
                Status = NormalizeBatchStatus(request?.Status),
                Page = request?.Page ?? SettlementConstants.DefaultListPage,
                PageSize = request?.PageSize ?? SettlementConstants.DefaultListPageSize
            },
            ct);
    }

    /* --------------------------------------------------------------- admin */

    public Task<ShopBankAccountDto> VerifyBankAccountAsync(
        Guid shopId,
        Guid adminUserId,
        VerifyShopBankAccountRequest request,
        CancellationToken ct = default)
    {
        if (shopId == Guid.Empty)
            throw new AppException("Shop id is required.");
        if (request is null)
            throw new AppException("Verification decision is required.");

        return _settlements.VerifyBankAccountAsync(shopId, adminUserId, request, ct);
    }

    public Task<IReadOnlyList<SettlementEligibleShopDto>> GetEligibleShopsAsync(
        CancellationToken ct = default) =>
        _settlements.GetEligibleShopsAsync(DateTime.UtcNow, ct);

    public Task<PayoutBatchDto> CreateBatchAsync(
        CreatePayoutBatchRequest request,
        CancellationToken ct = default)
    {
        if (request is null || request.ShopId == Guid.Empty)
            throw new AppException("Shop id is required.");

        var periodTo = request.PeriodTo ?? DateTime.UtcNow;
        if (periodTo > DateTime.UtcNow)
            periodTo = DateTime.UtcNow;

        return _settlements.CreateBatchAsync(request.ShopId, periodTo, ct);
    }

    public async Task<PayoutBatchDto> ApproveBatchAsync(
        Guid payoutBatchId,
        Guid adminUserId,
        CancellationToken ct = default)
    {
        var batch = await _settlements.ApproveBatchAsync(payoutBatchId, adminUserId, ct);
        await NotifySellerAsync(
            batch.ShopId,
            "Payout approved",
            $"Your settlement {batch.BatchCode} for {batch.NetAmount:0} {batch.Currency} has been approved.",
            batch.PayoutBatchId,
            ct);

        // Manual mode stops here: an admin transfers the money and marks it paid.
        if (_options.IsManualPayout)
            return batch;

        try
        {
            return await ExecuteBatchAsync(payoutBatchId, ct);
        }
        catch (Exception ex)
        {
            // The release already happened and is correct; only the transfer failed.
            _logger.LogError(ex, "Auto-execute failed for batch {BatchCode}", batch.BatchCode);
            return await _settlements.GetBatchAsync(payoutBatchId, ct);
        }
    }

    public async Task<PayoutBatchDto> ExecuteBatchAsync(
        Guid payoutBatchId,
        CancellationToken ct = default)
    {
        if (_options.IsManualPayout)
            throw new ConflictException("Payouts are in manual mode. Transfer the money then mark the batch as paid.");

        // Preflight before anything is written: an underfunded payout account is
        // the most common operational failure and must not look like a payOS bug.
        var context = await _settlements.GetBatchAsync(payoutBatchId, ct);
        await EnsurePayoutFundsAsync(context.NetAmount, ct);

        var execution = await _settlements.BeginBatchExecutionAsync(payoutBatchId, ct);

        try
        {
            var result = await _payOs.CreatePayoutAsync(
                new PayOsPayoutCommand
                {
                    ReferenceId = execution.BatchCode,
                    AmountVnd = ToVndInteger(execution.NetAmount),
                    Description = execution.BatchCode,
                    ToBin = execution.ToBin,
                    ToAccountNumber = execution.ToAccountNumber,
                    Category = "settlement"
                },
                ct);

            var batch = await _settlements.CompleteBatchPayoutAsync(
                payoutBatchId,
                result.PayoutId,
                result.ApprovalState ?? "PROCESSING",
                result.RawJson,
                ct);

            if (string.Equals(batch.Status, SettlementConstants.BatchStatusPaid, StringComparison.OrdinalIgnoreCase))
            {
                await NotifySellerAsync(
                    batch.ShopId,
                    "Payout sent",
                    $"{batch.NetAmount:0} {batch.Currency} has been transferred to your bank account ({batch.BatchCode}).",
                    batch.PayoutBatchId,
                    ct);
            }

            return batch;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "payOS payout failed for batch {BatchCode}", execution.BatchCode);
            return await _settlements.MarkBatchFailedAsync(payoutBatchId, ex.Message, ct);
        }
    }

    public Task<PayoutBatchDto> CancelBatchAsync(
        Guid payoutBatchId,
        Guid adminUserId,
        CancellationToken ct = default) =>
        _settlements.CancelBatchAsync(payoutBatchId, adminUserId, ct);

    public async Task<PayoutBatchDto> MarkBatchPaidAsync(
        Guid payoutBatchId,
        Guid adminUserId,
        MarkPayoutPaidRequest request,
        CancellationToken ct = default)
    {
        var batch = await _settlements.MarkBatchPaidAsync(
            payoutBatchId,
            adminUserId,
            request?.Reference?.Trim(),
            ct);

        await NotifySellerAsync(
            batch.ShopId,
            "Payout sent",
            $"{batch.NetAmount:0} {batch.Currency} has been transferred to your bank account ({batch.BatchCode}).",
            batch.PayoutBatchId,
            ct);

        return batch;
    }

    public Task<PayoutBatchListDto> ListBatchesAsync(
        PayoutBatchQueryRequest request,
        CancellationToken ct = default) =>
        _settlements.ListBatchesAsync(
            new PayoutBatchQueryRequest
            {
                ShopId = request?.ShopId,
                Status = NormalizeBatchStatus(request?.Status),
                Page = request?.Page ?? SettlementConstants.DefaultListPage,
                PageSize = request?.PageSize ?? SettlementConstants.DefaultListPageSize
            },
            ct);

    public Task<SettlementEntryListDto> ListEntriesAsync(
        SettlementQueryRequest request,
        Guid? shopId,
        CancellationToken ct = default) =>
        _settlements.ListEntriesAsync(
            shopId,
            NormalizeEntryStatus(request?.Status),
            request?.Page ?? SettlementConstants.DefaultListPage,
            request?.PageSize ?? SettlementConstants.DefaultListPageSize,
            ct);

    public Task<PayoutBatchDto> HoldEntryAsync(
        Guid settlementEntryId,
        HoldSettlementEntryRequest request,
        CancellationToken ct = default)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Reason))
            throw new AppException("A reason is required to hold a settlement.");

        return _settlements.HoldEntryAsync(settlementEntryId, request.Reason.Trim(), ct);
    }

    public Task<PlatformCommissionReportDto> GetCommissionReportAsync(
        PlatformCommissionQueryRequest request,
        CancellationToken ct = default)
    {
        var to = (request?.To ?? DateTime.UtcNow).Date.AddDays(1);
        var from = (request?.From ?? to.AddDays(-30)).Date;
        if (from >= to)
            from = to.AddDays(-1);

        return _settlements.GetCommissionReportAsync(from, to, ct);
    }

    public async Task<decimal> GetPayoutBalanceAsync(CancellationToken ct = default)
    {
        var balance = await _payOs.GetPayoutBalanceAsync(ct);
        return balance.Balance;
    }

    /* ----------------------------------------------------------------- job */

    public async Task<SettlementSweepResult> RunSweepAsync(CancellationToken ct = default)
    {
        var errors = new List<string>();
        var now = DateTime.UtcNow;

        var autoCompleted = 0;
        try
        {
            autoCompleted = await AutoCompleteDeliveredOrdersAsync(now, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Settlement sweep: auto-complete step failed");
            errors.Add($"auto-complete: {ex.Message}");
        }

        var promoted = 0;
        try
        {
            promoted = await _settlements.PromoteDueEntriesAsync(now, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Settlement sweep: eligibility step failed");
            errors.Add($"eligibility: {ex.Message}");
        }

        var polled = 0;
        try
        {
            polled = await PollProcessingBatchesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Settlement sweep: payout polling step failed");
            errors.Add($"payout polling: {ex.Message}");
        }

        return new SettlementSweepResult
        {
            AutoCompletedOrders = autoCompleted,
            EntriesMadeEligible = promoted,
            BatchesPolled = polled,
            Errors = errors
        };
    }

    /// <summary>
    /// Without this, an order the buyer never confirms stays Delivered forever and
    /// its money never enters the settlement pipeline at all.
    /// </summary>
    private async Task<int> AutoCompleteDeliveredOrdersAsync(DateTime now, CancellationToken ct)
    {
        var cutoff = now.AddDays(-_options.AutoCompleteDays);
        var orderIds = await _settlements.GetOrdersDueForAutoCompleteAsync(
            cutoff,
            AutoCompleteBatchSize,
            ct);

        var completed = 0;
        foreach (var orderId in orderIds)
        {
            try
            {
                // Goes through the normal path so the settlement entry is created too.
                await _orders.AutoCompleteDeliveredOrderAsync(orderId, ct);
                completed++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Auto-complete failed for order {OrderId}", orderId);
            }
        }

        return completed;
    }

    private async Task<int> PollProcessingBatchesAsync(CancellationToken ct)
    {
        if (_options.IsManualPayout)
            return 0;

        var pending = await _settlements.GetBatchesAwaitingProviderAsync(ct);
        var polled = 0;

        foreach (var (batchId, providerPayoutId) in pending)
        {
            try
            {
                var result = await _payOs.GetPayoutAsync(providerPayoutId, ct);
                await _settlements.CompleteBatchPayoutAsync(
                    batchId,
                    result.PayoutId,
                    result.ApprovalState ?? "PROCESSING",
                    result.RawJson,
                    ct);
                polled++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not poll payout {PayoutId}", providerPayoutId);
            }
        }

        return polled;
    }

    /* ------------------------------------------------------------- helpers */

    private async Task EnsurePayoutFundsAsync(decimal netAmount, CancellationToken ct)
    {
        PayOsPayoutBalance balance;
        try
        {
            balance = await _payOs.GetPayoutBalanceAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not read the payOS payout balance; continuing anyway");
            return;
        }

        if (balance.IsMock)
            return;

        if (balance.Balance < netAmount)
        {
            throw new ConflictException(
                $"The payOS payout account holds {balance.Balance:0} {balance.Currency} but this batch needs " +
                $"{netAmount:0}. Top up the payout account before running the transfer.");
        }
    }

    private async Task NotifySellerAsync(
        Guid shopId,
        string title,
        string body,
        Guid referenceId,
        CancellationToken ct)
    {
        try
        {
            var ownerUserId = await _settlements.GetShopOwnerUserIdAsync(shopId, ct);
            if (ownerUserId is not { } userId || userId == Guid.Empty)
                return;

            await _notifications.CreateAsync(
                new CreateNotificationRequest
                {
                    UserId = userId,
                    Title = title,
                    Body = body,
                    Type = NotificationConstants.TypePayment,
                    ReferenceType = SettlementConstants.WalletReferenceTypePayoutBatch,
                    ReferenceId = referenceId
                },
                ct);
        }
        catch (Exception ex)
        {
            // Never let a notification failure roll back money that already moved.
            _logger.LogWarning(ex, "Could not notify shop {ShopId} about {Title}", shopId, title);
        }
    }

    private async Task<SellerShopRecord> RequireShopAsync(Guid ownerUserId, CancellationToken ct)
    {
        if (ownerUserId == Guid.Empty)
            throw new AppException("Seller user id is required.");

        return await _sellerShops.GetActiveShopByOwnerAsync(ownerUserId, ct)
            ?? throw new AppException("Active shop not found for this seller.");
    }

    private static int ToVndInteger(decimal amount)
    {
        if (amount != Math.Floor(amount))
            throw new AppException("Payout amount must be a whole VND amount.");
        if (amount > int.MaxValue)
            throw new AppException("Payout amount exceeds the payOS limit.");
        return (int)amount;
    }

    private static string? NormalizeEntryStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
            return null;

        var match = SettlementConstants.EntryStatuses
            .FirstOrDefault(s => string.Equals(s, status.Trim(), StringComparison.OrdinalIgnoreCase));

        return match ?? throw new AppException($"Unknown settlement status '{status}'.");
    }

    private static string? NormalizeBatchStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
            return null;

        string[] all =
        [
            SettlementConstants.BatchStatusDraft,
            SettlementConstants.BatchStatusApproved,
            SettlementConstants.BatchStatusProcessing,
            SettlementConstants.BatchStatusPaid,
            SettlementConstants.BatchStatusFailed,
            SettlementConstants.BatchStatusCancelled
        ];

        var match = all.FirstOrDefault(s => string.Equals(s, status.Trim(), StringComparison.OrdinalIgnoreCase));
        return match ?? throw new AppException($"Unknown payout batch status '{status}'.");
    }
}
