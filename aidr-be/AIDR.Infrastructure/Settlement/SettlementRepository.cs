using System.Linq.Expressions;
using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Settlement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Settlement;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AIDR.Infrastructure.Settlement;

/// <summary>
/// Every money movement in the escrow flow goes through here. Balances are only
/// ever changed together with an append-only <see cref="WalletTransaction"/> row,
/// inside one transaction, so the ledger and the balances can never disagree.
/// </summary>
public sealed class SettlementRepository : ISettlementRepository
{
    private readonly AidrDbContext _db;
    private readonly SettlementOptions _options;
    private readonly ILogger<SettlementRepository> _logger;

    public SettlementRepository(
        AidrDbContext db,
        IOptions<SettlementOptions> options,
        ILogger<SettlementRepository> logger)
    {
        _db = db;
        _options = options.Value;
        _logger = logger;
    }

    /* ---------------------------------------------------------------- bank */

    public async Task<ShopBankAccountDto?> GetBankAccountAsync(
        Guid shopId,
        CancellationToken ct = default)
    {
        var account = await _db.ShopBankAccounts.AsNoTracking()
            .Where(a => a.ShopId == shopId && a.IsDefault)
            .FirstOrDefaultAsync(ct);

        return account is null ? null : MapBank(account);
    }

    public async Task<ShopBankAccountDto> UpsertBankAccountAsync(
        Guid shopId,
        UpsertShopBankAccountRequest request,
        CancellationToken ct = default)
    {
        var bankBin = (request.BankBin ?? string.Empty).Trim();
        var accountNumber = (request.AccountNumber ?? string.Empty).Trim();
        var accountName = (request.AccountName ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(bankBin))
            throw new AppException("Bank BIN is required.");
        if (string.IsNullOrWhiteSpace(accountNumber))
            throw new AppException("Account number is required.");
        if (string.IsNullOrWhiteSpace(accountName))
            throw new AppException("Account holder name is required.");
        if (!accountNumber.All(char.IsDigit))
            throw new AppException("Account number must contain digits only.");

        var now = DateTime.UtcNow;
        var account = await _db.ShopBankAccounts
            .FirstOrDefaultAsync(a => a.ShopId == shopId && a.IsDefault, ct);

        if (account is null)
        {
            account = new ShopBankAccount
            {
                ShopBankAccountId = Guid.NewGuid(),
                ShopId = shopId,
                IsDefault = true,
                CreatedAt = now
            };
            _db.ShopBankAccounts.Add(account);
        }
        else if (HasOpenBatchOn(account.ShopBankAccountId))
        {
            throw new ConflictException(
                "A payout batch is still in progress on this account. Wait for it to finish before changing bank details.");
        }

        var changed =
            !string.Equals(account.BankBin, bankBin, StringComparison.Ordinal) ||
            !string.Equals(account.AccountNumber, accountNumber, StringComparison.Ordinal) ||
            !string.Equals(account.AccountName, accountName, StringComparison.OrdinalIgnoreCase);

        account.BankBin = bankBin;
        account.BankName = string.IsNullOrWhiteSpace(request.BankName) ? null : request.BankName.Trim();
        account.AccountNumber = accountNumber;
        account.AccountName = accountName;
        account.UpdatedAt = now;

        // Any change to the destination invalidates the previous approval.
        if (changed)
        {
            account.Status = SettlementConstants.BankStatusUnverified;
            account.VerifiedAt = null;
            account.VerifiedBy = null;
            account.RejectReason = null;
        }

        await _db.SaveChangesAsync(ct);
        return MapBank(account);
    }

    public async Task<ShopBankAccountDto> VerifyBankAccountAsync(
        Guid shopId,
        Guid adminUserId,
        VerifyShopBankAccountRequest request,
        CancellationToken ct = default)
    {
        var account = await _db.ShopBankAccounts
            .FirstOrDefaultAsync(a => a.ShopId == shopId && a.IsDefault, ct)
            ?? throw new NotFoundException("This shop has not registered a bank account yet.");

        if (!request.Approve && string.IsNullOrWhiteSpace(request.Reason))
            throw new AppException("A reason is required when rejecting a bank account.");

        var now = DateTime.UtcNow;
        account.Status = request.Approve
            ? SettlementConstants.BankStatusVerified
            : SettlementConstants.BankStatusRejected;
        account.RejectReason = request.Approve ? null : request.Reason!.Trim();
        account.VerifiedBy = adminUserId;
        account.VerifiedAt = now;
        account.UpdatedAt = now;

        await _db.SaveChangesAsync(ct);
        return MapBank(account);
    }

    /* -------------------------------------------------------------- queries */

    public async Task<SettlementEntryListDto> ListEntriesAsync(
        Guid? shopId,
        string? status,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var (normalizedPage, normalizedSize) = SettlementConstants.NormalizePaging(page, pageSize);

        var query = _db.SettlementEntries.AsNoTracking();
        if (shopId is { } id)
            query = query.Where(e => e.ShopId == id);
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(e => e.Status == status);

        var totalCount = await query.CountAsync(ct);

        var rows = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((normalizedPage - 1) * normalizedSize)
            .Take(normalizedSize)
            .Select(e => new
            {
                e.SettlementEntryId,
                e.OrderId,
                e.Order.OrderCode,
                e.ShopId,
                e.Shop.ShopName,
                e.GrossAmount,
                e.CommissionRate,
                e.CommissionAmount,
                e.NetAmount,
                e.Currency,
                e.Status,
                e.HoldUntil,
                e.EligibleAt,
                e.PayoutBatchId,
                BatchCode = e.PayoutBatch != null ? e.PayoutBatch.BatchCode : null,
                e.HoldReason,
                e.CreatedAt
            })
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var items = rows.Select(r => new SettlementEntryDto
        {
            SettlementEntryId = r.SettlementEntryId,
            OrderId = r.OrderId,
            OrderCode = r.OrderCode,
            ShopId = r.ShopId,
            ShopName = r.ShopName,
            GrossAmount = r.GrossAmount,
            CommissionRate = r.CommissionRate,
            CommissionAmount = r.CommissionAmount,
            NetAmount = r.NetAmount,
            Currency = r.Currency,
            Status = r.Status,
            HoldUntil = r.HoldUntil,
            DaysUntilRelease = DaysUntil(r.HoldUntil, now),
            EligibleAt = r.EligibleAt,
            PayoutBatchId = r.PayoutBatchId,
            BatchCode = r.BatchCode,
            HoldReason = r.HoldReason,
            CreatedAt = r.CreatedAt
        }).ToList();

        return new SettlementEntryListDto
        {
            Items = items,
            Page = normalizedPage,
            PageSize = normalizedSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)normalizedSize)
        };
    }

    public async Task<SettlementSummaryDto> GetSummaryAsync(Guid shopId, CancellationToken ct = default)
    {
        var buckets = await _db.SettlementEntries.AsNoTracking()
            .Where(e => e.ShopId == shopId)
            .GroupBy(e => e.Status)
            .Select(g => new
            {
                Status = g.Key,
                Count = g.Count(),
                Net = g.Sum(x => x.NetAmount),
                Commission = g.Sum(x => x.CommissionAmount)
            })
            .ToListAsync(ct);

        decimal Net(string status) =>
            buckets.FirstOrDefault(b => b.Status == status)?.Net ?? 0m;
        int Count(string status) =>
            buckets.FirstOrDefault(b => b.Status == status)?.Count ?? 0;

        var nextRelease = await _db.SettlementEntries.AsNoTracking()
            .Where(e => e.ShopId == shopId && e.Status == SettlementConstants.EntryStatusHolding)
            .OrderBy(e => e.HoldUntil)
            .Select(e => (DateTime?)e.HoldUntil)
            .FirstOrDefaultAsync(ct);

        var currency = await _db.Wallets.AsNoTracking()
            .Where(w => w.ShopId == shopId)
            .Select(w => w.Currency)
            .FirstOrDefaultAsync(ct) ?? "VND";

        var hasVerifiedBank = await _db.ShopBankAccounts.AsNoTracking()
            .AnyAsync(a => a.ShopId == shopId
                           && a.IsDefault
                           && a.Status == SettlementConstants.BankStatusVerified, ct);

        return new SettlementSummaryDto
        {
            Currency = string.IsNullOrWhiteSpace(currency) ? "VND" : currency,
            HoldingAmount = Net(SettlementConstants.EntryStatusHolding),
            HoldingCount = Count(SettlementConstants.EntryStatusHolding),
            OnHoldAmount = Net(SettlementConstants.EntryStatusOnHold),
            OnHoldCount = Count(SettlementConstants.EntryStatusOnHold),
            EligibleAmount = Net(SettlementConstants.EntryStatusEligible),
            EligibleCount = Count(SettlementConstants.EntryStatusEligible),
            ApprovedAmount = Net(SettlementConstants.EntryStatusApproved),
            ApprovedCount = Count(SettlementConstants.EntryStatusApproved),
            PaidAmount = Net(SettlementConstants.EntryStatusPaid),
            PaidCount = Count(SettlementConstants.EntryStatusPaid),
            CommissionPaid = buckets
                .Where(b => SettlementConstants.ReleasedStatuses.Contains(b.Status))
                .Sum(b => b.Commission),
            NextReleaseAt = nextRelease,
            HasVerifiedBankAccount = hasVerifiedBank
        };
    }

    public async Task<PayoutBatchListDto> ListBatchesAsync(
        PayoutBatchQueryRequest request,
        CancellationToken ct = default)
    {
        var (page, pageSize) = SettlementConstants.NormalizePaging(request.Page, request.PageSize);

        var query = _db.PayoutBatches.AsNoTracking();
        if (request.ShopId is { } shopId)
            query = query.Where(b => b.ShopId == shopId);
        if (!string.IsNullOrWhiteSpace(request.Status))
            query = query.Where(b => b.Status == request.Status);

        var totalCount = await query.CountAsync(ct);

        var rows = await query
            .OrderByDescending(b => b.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(BatchRow.Projection)
            .ToListAsync(ct);

        return new PayoutBatchListDto
        {
            Items = rows.Select(MapBatch).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        };
    }

    public async Task<PayoutBatchDto> GetBatchAsync(Guid payoutBatchId, CancellationToken ct = default)
    {
        var row = await _db.PayoutBatches.AsNoTracking()
            .Where(b => b.PayoutBatchId == payoutBatchId)
            .Select(BatchRow.Projection)
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Payout batch not found.");

        return MapBatch(row);
    }

    /* --------------------------------------------------------- admin: build */

    public async Task<IReadOnlyList<SettlementEligibleShopDto>> GetEligibleShopsAsync(
        DateTime asOfUtc,
        CancellationToken ct = default)
    {
        var grouped = await _db.SettlementEntries.AsNoTracking()
            .Where(e => e.Status == SettlementConstants.EntryStatusEligible
                        && e.EligibleAt != null
                        && e.EligibleAt <= asOfUtc)
            .GroupBy(e => new { e.ShopId, e.Shop.ShopName, e.Currency })
            .Select(g => new
            {
                g.Key.ShopId,
                g.Key.ShopName,
                g.Key.Currency,
                EntryCount = g.Count(),
                Gross = g.Sum(x => x.GrossAmount),
                Commission = g.Sum(x => x.CommissionAmount),
                Net = g.Sum(x => x.NetAmount)
            })
            .ToListAsync(ct);

        if (grouped.Count == 0)
            return Array.Empty<SettlementEligibleShopDto>();

        var shopIds = grouped.Select(g => g.ShopId).ToList();

        var banks = await _db.ShopBankAccounts.AsNoTracking()
            .Where(a => shopIds.Contains(a.ShopId) && a.IsDefault)
            .ToDictionaryAsync(a => a.ShopId, ct);

        var openBatchShopIds = await _db.PayoutBatches.AsNoTracking()
            .Where(b => shopIds.Contains(b.ShopId)
                        && (b.Status == SettlementConstants.BatchStatusDraft
                            || b.Status == SettlementConstants.BatchStatusApproved
                            || b.Status == SettlementConstants.BatchStatusProcessing))
            .Select(b => b.ShopId)
            .ToListAsync(ct);

        var openSet = openBatchShopIds.ToHashSet();

        return grouped
            .Select(g =>
            {
                banks.TryGetValue(g.ShopId, out var bank);
                var hasOpenBatch = openSet.Contains(g.ShopId);

                var blockers = new List<string>();
                if (bank is null)
                    blockers.Add("Shop has not registered a bank account.");
                else if (!string.Equals(bank.Status, SettlementConstants.BankStatusVerified, StringComparison.OrdinalIgnoreCase))
                    blockers.Add($"Bank account is {bank.Status.ToLowerInvariant()}.");
                if (g.Net < _options.MinPayoutAmount)
                    blockers.Add($"Below the {_options.MinPayoutAmount:0} {g.Currency} minimum payout.");
                if (hasOpenBatch)
                    blockers.Add("A payout batch is already open for this shop.");

                return new SettlementEligibleShopDto
                {
                    ShopId = g.ShopId,
                    ShopName = g.ShopName,
                    EntryCount = g.EntryCount,
                    GrossAmount = g.Gross,
                    CommissionAmount = g.Commission,
                    NetAmount = g.Net,
                    Currency = g.Currency,
                    AccountNumberMasked = bank is null ? null : Mask(bank.AccountNumber),
                    AccountName = bank?.AccountName,
                    BankName = bank?.BankName,
                    BankStatus = bank?.Status ?? SettlementBankStatus.Missing,
                    HasOpenBatch = hasOpenBatch,
                    Blockers = blockers,
                    CanPayout = blockers.Count == 0
                };
            })
            .OrderByDescending(s => s.NetAmount)
            .ToList();
    }

    public async Task<PayoutBatchDto> CreateBatchAsync(
        Guid shopId,
        DateTime periodToUtc,
        CancellationToken ct = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(ct);

        var shop = await _db.Shops.AsNoTracking()
            .FirstOrDefaultAsync(s => s.ShopId == shopId, ct)
            ?? throw new NotFoundException("Shop not found.");

        var bank = await _db.ShopBankAccounts
            .FirstOrDefaultAsync(a => a.ShopId == shopId && a.IsDefault, ct)
            ?? throw new ConflictException("This shop has not registered a bank account yet.");

        if (!string.Equals(bank.Status, SettlementConstants.BankStatusVerified, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("The shop's bank account must be verified before a payout can be created.");

        if (await _db.PayoutBatches.AnyAsync(
                b => b.ShopId == shopId
                     && (b.Status == SettlementConstants.BatchStatusDraft
                         || b.Status == SettlementConstants.BatchStatusApproved
                         || b.Status == SettlementConstants.BatchStatusProcessing),
                ct))
        {
            throw new ConflictException("This shop already has an open payout batch.");
        }

        var entries = await _db.SettlementEntries
            .Where(e => e.ShopId == shopId
                        && e.Status == SettlementConstants.EntryStatusEligible
                        && e.EligibleAt != null
                        && e.EligibleAt <= periodToUtc)
            .ToListAsync(ct);

        if (entries.Count == 0)
            throw new ConflictException("There are no eligible settlements for this shop.");

        var net = entries.Sum(e => e.NetAmount);
        if (net < _options.MinPayoutAmount)
        {
            throw new ConflictException(
                $"Eligible amount {net:0} is below the minimum payout of {_options.MinPayoutAmount:0}.");
        }

        var now = DateTime.UtcNow;
        var batch = new PayoutBatch
        {
            PayoutBatchId = Guid.NewGuid(),
            BatchCode = await GenerateBatchCodeAsync(now, ct),
            ShopId = shopId,
            ShopBankAccountId = bank.ShopBankAccountId,
            PeriodTo = periodToUtc,
            EntryCount = entries.Count,
            GrossAmount = entries.Sum(e => e.GrossAmount),
            CommissionAmount = entries.Sum(e => e.CommissionAmount),
            NetAmount = net,
            Currency = entries[0].Currency,
            Status = SettlementConstants.BatchStatusDraft,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.PayoutBatches.Add(batch);

        // Claim the entries now so a second batch cannot pick them up.
        foreach (var entry in entries)
        {
            entry.PayoutBatchId = batch.PayoutBatchId;
            entry.UpdatedAt = now;
        }

        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        _logger.LogInformation(
            "Created payout batch {BatchCode} for shop {ShopId}: {Count} entries, net {Net}",
            batch.BatchCode, shopId, entries.Count, net);

        return await GetBatchAsync(batch.PayoutBatchId, ct);
    }

    /* ------------------------------------------------------- admin: release */

    public async Task<PayoutBatchDto> ApproveBatchAsync(
        Guid payoutBatchId,
        Guid adminUserId,
        CancellationToken ct = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(ct);

        var batch = await _db.PayoutBatches
            .FirstOrDefaultAsync(b => b.PayoutBatchId == payoutBatchId, ct)
            ?? throw new NotFoundException("Payout batch not found.");

        if (string.Equals(batch.Status, SettlementConstants.BatchStatusApproved, StringComparison.OrdinalIgnoreCase))
        {
            await transaction.CommitAsync(ct);
            return await GetBatchAsync(payoutBatchId, ct);
        }

        if (!string.Equals(batch.Status, SettlementConstants.BatchStatusDraft, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException($"Only draft batches can be approved (this one is {batch.Status}).");

        var entries = await _db.SettlementEntries
            .Where(e => e.PayoutBatchId == payoutBatchId)
            .ToListAsync(ct);

        var stillEligible = entries
            .Where(e => string.Equals(e.Status, SettlementConstants.EntryStatusEligible, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (stillEligible.Count == 0)
            throw new ConflictException("No entries in this batch are eligible any more.");

        // An entry may have been put on hold or reversed after the batch was drafted.
        var dropped = entries.Except(stillEligible).ToList();
        foreach (var entry in dropped)
            entry.PayoutBatchId = null;

        var now = DateTime.UtcNow;
        var wallet = await RequireWalletAsync(batch.ShopId, ct);

        var net = stillEligible.Sum(e => e.NetAmount);
        var gross = stillEligible.Sum(e => e.GrossAmount);
        var commission = stillEligible.Sum(e => e.CommissionAmount);

        // Release: pending -> available.
        wallet.PendingBalance = Round(wallet.PendingBalance - net);
        wallet.AvailableBalance = Round(wallet.AvailableBalance + net);
        wallet.UpdatedAt = now;
        AddWalletTx(
            wallet,
            SettlementConstants.TxSettlementRelease,
            net,
            SettlementConstants.WalletReferenceTypePayoutBatch,
            batch.PayoutBatchId,
            $"Settlement released for {batch.BatchCode}",
            now);

        foreach (var entry in stillEligible)
        {
            entry.Status = SettlementConstants.EntryStatusApproved;
            entry.UpdatedAt = now;
        }

        batch.Status = SettlementConstants.BatchStatusApproved;
        batch.ApprovedBy = adminUserId;
        batch.ApprovedAt = now;
        batch.EntryCount = stillEligible.Count;
        batch.GrossAmount = gross;
        batch.CommissionAmount = commission;
        batch.NetAmount = net;
        batch.UpdatedAt = now;

        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        _logger.LogInformation(
            "Approved payout batch {BatchCode}: released {Net} to shop {ShopId}, commission {Commission}",
            batch.BatchCode, net, batch.ShopId, commission);

        return await GetBatchAsync(payoutBatchId, ct);
    }

    public async Task<PayoutBatchDto> CancelBatchAsync(
        Guid payoutBatchId,
        Guid adminUserId,
        CancellationToken ct = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(ct);

        var batch = await _db.PayoutBatches
            .FirstOrDefaultAsync(b => b.PayoutBatchId == payoutBatchId, ct)
            ?? throw new NotFoundException("Payout batch not found.");

        if (string.Equals(batch.Status, SettlementConstants.BatchStatusProcessing, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("A batch that is already being transferred cannot be cancelled.");
        if (string.Equals(batch.Status, SettlementConstants.BatchStatusPaid, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("A paid batch cannot be cancelled.");

        var now = DateTime.UtcNow;
        var entries = await _db.SettlementEntries
            .Where(e => e.PayoutBatchId == payoutBatchId)
            .ToListAsync(ct);

        // If the batch was already approved the money was released - take it back.
        if (string.Equals(batch.Status, SettlementConstants.BatchStatusApproved, StringComparison.OrdinalIgnoreCase)
            || string.Equals(batch.Status, SettlementConstants.BatchStatusFailed, StringComparison.OrdinalIgnoreCase))
        {
            var wallet = await RequireWalletAsync(batch.ShopId, ct);
            var net = entries
                .Where(e => string.Equals(e.Status, SettlementConstants.EntryStatusApproved, StringComparison.OrdinalIgnoreCase))
                .Sum(e => e.NetAmount);

            if (net > 0)
            {
                wallet.AvailableBalance = Round(wallet.AvailableBalance - net);
                wallet.PendingBalance = Round(wallet.PendingBalance + net);
                wallet.UpdatedAt = now;
                AddWalletTx(
                    wallet,
                    SettlementConstants.TxSettlementRelease,
                    -net,
                    SettlementConstants.WalletReferenceTypePayoutBatch,
                    batch.PayoutBatchId,
                    $"Release reverted - batch {batch.BatchCode} cancelled",
                    now);
            }
        }

        foreach (var entry in entries)
        {
            if (string.Equals(entry.Status, SettlementConstants.EntryStatusApproved, StringComparison.OrdinalIgnoreCase))
                entry.Status = SettlementConstants.EntryStatusEligible;
            entry.PayoutBatchId = null;
            entry.UpdatedAt = now;
        }

        batch.Status = SettlementConstants.BatchStatusCancelled;
        batch.UpdatedAt = now;
        batch.FailureReason = $"Cancelled by admin {adminUserId}";

        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return await GetBatchAsync(payoutBatchId, ct);
    }

    /* ------------------------------------------------------- admin: payout */

    public async Task<PayoutExecutionContext> BeginBatchExecutionAsync(
        Guid payoutBatchId,
        CancellationToken ct = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(ct);

        var batch = await _db.PayoutBatches
            .Include(b => b.ShopBankAccount)
            .Include(b => b.Shop)
            .FirstOrDefaultAsync(b => b.PayoutBatchId == payoutBatchId, ct)
            ?? throw new NotFoundException("Payout batch not found.");

        var canRun =
            string.Equals(batch.Status, SettlementConstants.BatchStatusApproved, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(batch.Status, SettlementConstants.BatchStatusFailed, StringComparison.OrdinalIgnoreCase);

        if (!canRun)
            throw new ConflictException($"Only approved or failed batches can be transferred (this one is {batch.Status}).");

        if (batch.AttemptCount >= SettlementConstants.MaxAttemptCount)
        {
            throw new ConflictException(
                $"This batch has failed {batch.AttemptCount} times. Resolve it manually before retrying.");
        }

        if (!string.Equals(
                batch.ShopBankAccount.Status,
                SettlementConstants.BankStatusVerified,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException("The shop's bank account is no longer verified.");
        }

        // Flip to Processing *before* calling payOS: if the app dies mid-call we
        // know a transfer may already be in flight and must be polled, not resent.
        var now = DateTime.UtcNow;
        batch.Status = SettlementConstants.BatchStatusProcessing;
        batch.AttemptCount += 1;
        batch.FailureReason = null;
        batch.UpdatedAt = now;

        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return new PayoutExecutionContext
        {
            PayoutBatchId = batch.PayoutBatchId,
            BatchCode = batch.BatchCode,
            NetAmount = batch.NetAmount,
            ToBin = batch.ShopBankAccount.BankBin,
            ToAccountNumber = batch.ShopBankAccount.AccountNumber,
            ShopName = batch.Shop.ShopName
        };
    }

    public async Task<PayoutBatchDto> CompleteBatchPayoutAsync(
        Guid payoutBatchId,
        string providerPayoutId,
        string providerState,
        string? rawJson,
        CancellationToken ct = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(ct);

        var batch = await _db.PayoutBatches
            .FirstOrDefaultAsync(b => b.PayoutBatchId == payoutBatchId, ct)
            ?? throw new NotFoundException("Payout batch not found.");

        batch.ProviderPayoutId = providerPayoutId;
        batch.ProviderState = providerState;
        batch.RawResponseJson = rawJson;
        batch.UpdatedAt = DateTime.UtcNow;

        if (IsProviderSuccess(providerState))
        {
            await MarkPaidInternalAsync(batch, null, ct);
        }
        else if (IsProviderFailure(providerState))
        {
            batch.Status = SettlementConstants.BatchStatusFailed;
            batch.FailureReason = $"payOS reported state {providerState}.";
        }
        // Anything else stays Processing; the sweep will poll it.

        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return await GetBatchAsync(payoutBatchId, ct);
    }

    public async Task<PayoutBatchDto> MarkBatchPaidAsync(
        Guid payoutBatchId,
        Guid adminUserId,
        string? reference,
        CancellationToken ct = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(ct);

        var batch = await _db.PayoutBatches
            .FirstOrDefaultAsync(b => b.PayoutBatchId == payoutBatchId, ct)
            ?? throw new NotFoundException("Payout batch not found.");

        if (string.Equals(batch.Status, SettlementConstants.BatchStatusPaid, StringComparison.OrdinalIgnoreCase))
        {
            await transaction.CommitAsync(ct);
            return await GetBatchAsync(payoutBatchId, ct);
        }

        var payable =
            string.Equals(batch.Status, SettlementConstants.BatchStatusApproved, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(batch.Status, SettlementConstants.BatchStatusProcessing, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(batch.Status, SettlementConstants.BatchStatusFailed, StringComparison.OrdinalIgnoreCase);

        if (!payable)
            throw new ConflictException($"A {batch.Status} batch cannot be marked as paid.");

        await MarkPaidInternalAsync(batch, reference, ct);

        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        _logger.LogInformation(
            "Batch {BatchCode} marked paid by admin {AdminId} (ref {Reference})",
            batch.BatchCode, adminUserId, reference ?? "-");

        return await GetBatchAsync(payoutBatchId, ct);
    }

    public async Task<PayoutBatchDto> MarkBatchFailedAsync(
        Guid payoutBatchId,
        string failureReason,
        CancellationToken ct = default)
    {
        var batch = await _db.PayoutBatches
            .FirstOrDefaultAsync(b => b.PayoutBatchId == payoutBatchId, ct)
            ?? throw new NotFoundException("Payout batch not found.");

        batch.Status = SettlementConstants.BatchStatusFailed;
        batch.FailureReason = Truncate(failureReason, SettlementConstants.MaxFailureReasonLength);
        batch.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetBatchAsync(payoutBatchId, ct);
    }

    /* --------------------------------------------------------- entry holds */

    public async Task<PayoutBatchDto> HoldEntryAsync(
        Guid settlementEntryId,
        string reason,
        CancellationToken ct = default)
    {
        var entry = await _db.SettlementEntries
            .FirstOrDefaultAsync(e => e.SettlementEntryId == settlementEntryId, ct)
            ?? throw new NotFoundException("Settlement entry not found.");

        if (SettlementConstants.ReleasedStatuses.Contains(entry.Status))
            throw new ConflictException("This settlement has already been released and cannot be put on hold.");

        entry.Status = SettlementConstants.EntryStatusOnHold;
        entry.HoldReason = Truncate(reason, SettlementConstants.MaxHoldReasonLength);
        entry.PayoutBatchId = null;
        entry.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        // Nothing batch-shaped to return; callers only need the 200.
        return new PayoutBatchDto
        {
            PayoutBatchId = Guid.Empty,
            BatchCode = string.Empty,
            ShopId = entry.ShopId,
            Status = entry.Status,
            Currency = entry.Currency,
            PeriodTo = entry.HoldUntil,
            CreatedAt = entry.CreatedAt
        };
    }

    public async Task ReleaseEntryHoldAsync(Guid settlementEntryId, CancellationToken ct = default)
    {
        var entry = await _db.SettlementEntries
            .FirstOrDefaultAsync(e => e.SettlementEntryId == settlementEntryId, ct)
            ?? throw new NotFoundException("Settlement entry not found.");

        if (!string.Equals(entry.Status, SettlementConstants.EntryStatusOnHold, StringComparison.OrdinalIgnoreCase))
            return;

        var now = DateTime.UtcNow;
        entry.Status = entry.HoldUntil <= now
            ? SettlementConstants.EntryStatusEligible
            : SettlementConstants.EntryStatusHolding;
        entry.EligibleAt = entry.HoldUntil <= now ? now : null;
        entry.HoldReason = null;
        entry.UpdatedAt = now;

        await _db.SaveChangesAsync(ct);
    }

    /* ------------------------------------------------------------- reports */

    public async Task<PlatformCommissionReportDto> GetCommissionReportAsync(
        DateTime fromUtc,
        DateTime toExclusiveUtc,
        CancellationToken ct = default)
    {
        var released = _db.SettlementEntries.AsNoTracking()
            .Where(e => (e.Status == SettlementConstants.EntryStatusApproved
                         || e.Status == SettlementConstants.EntryStatusPaid)
                        && e.PayoutBatch != null
                        && e.PayoutBatch.ApprovedAt != null
                        && e.PayoutBatch.ApprovedAt >= fromUtc
                        && e.PayoutBatch.ApprovedAt < toExclusiveUtc);

        var rows = await released
            .Select(e => new
            {
                Date = e.PayoutBatch!.ApprovedAt!.Value.Date,
                e.ShopId,
                e.Shop.ShopName,
                e.GrossAmount,
                e.CommissionAmount,
                e.NetAmount
            })
            .ToListAsync(ct);

        var series = rows
            .GroupBy(r => r.Date)
            .OrderBy(g => g.Key)
            .Select(g => new PlatformCommissionPointDto
            {
                Date = g.Key,
                OrderCount = g.Count(),
                Gmv = g.Sum(x => x.GrossAmount),
                Commission = g.Sum(x => x.CommissionAmount),
                PaidToSeller = g.Sum(x => x.NetAmount)
            })
            .ToList();

        var topShops = rows
            .GroupBy(r => new { r.ShopId, r.ShopName })
            .Select(g => new PlatformCommissionShopDto
            {
                ShopId = g.Key.ShopId,
                ShopName = g.Key.ShopName,
                OrderCount = g.Count(),
                Gmv = g.Sum(x => x.GrossAmount),
                Commission = g.Sum(x => x.CommissionAmount)
            })
            .OrderByDescending(s => s.Commission)
            .Take(10)
            .ToList();

        var escrowHeld = await _db.SettlementEntries.AsNoTracking()
            .Where(e => e.Status == SettlementConstants.EntryStatusHolding
                        || e.Status == SettlementConstants.EntryStatusOnHold
                        || e.Status == SettlementConstants.EntryStatusEligible)
            .SumAsync(e => (decimal?)e.NetAmount, ct) ?? 0m;

        var awaitingPayout = await _db.SettlementEntries.AsNoTracking()
            .Where(e => e.Status == SettlementConstants.EntryStatusApproved)
            .SumAsync(e => (decimal?)e.NetAmount, ct) ?? 0m;

        return new PlatformCommissionReportDto
        {
            FromUtc = fromUtc,
            ToUtc = toExclusiveUtc,
            CommissionRate = _options.CommissionRate,
            OrderCount = rows.Count,
            Gmv = rows.Sum(r => r.GrossAmount),
            Commission = rows.Sum(r => r.CommissionAmount),
            PaidToSeller = rows.Sum(r => r.NetAmount),
            EscrowHeld = escrowHeld,
            AwaitingPayout = awaitingPayout,
            Series = series,
            TopShops = topShops
        };
    }

    /* ------------------------------------------------------------ job work */

    public async Task<IReadOnlyList<Guid>> GetOrdersDueForAutoCompleteAsync(
        DateTime cutoffUtc,
        int limit,
        CancellationToken ct = default) =>
        await _db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderConstants.StatusDelivered
                        && o.DeliveredAt != null
                        && o.DeliveredAt <= cutoffUtc)
            .OrderBy(o => o.DeliveredAt)
            .Take(limit)
            .Select(o => o.OrderId)
            .ToListAsync(ct);

    public async Task<int> PromoteDueEntriesAsync(DateTime nowUtc, CancellationToken ct = default)
    {
        // An order with an open return keeps its money held, whatever the clock says.
        var due = await _db.SettlementEntries
            .Where(e => e.Status == SettlementConstants.EntryStatusHolding
                        && e.HoldUntil <= nowUtc
                        && e.Order.Status != OrderConstants.StatusReturnRequested
                        && !_db.ReturnRequests.Any(r => r.OrderId == e.OrderId
                                                        && r.Status != ReturnConstants.StatusRejected
                                                        && r.Status != ReturnConstants.StatusClosed))
            .ToListAsync(ct);

        if (due.Count == 0)
            return 0;

        foreach (var entry in due)
        {
            entry.Status = SettlementConstants.EntryStatusEligible;
            entry.EligibleAt = nowUtc;
            entry.UpdatedAt = nowUtc;
        }

        await _db.SaveChangesAsync(ct);
        return due.Count;
    }

    public async Task<IReadOnlyList<(Guid PayoutBatchId, string ProviderPayoutId)>>
        GetBatchesAwaitingProviderAsync(CancellationToken ct = default)
    {
        var rows = await _db.PayoutBatches.AsNoTracking()
            .Where(b => b.Status == SettlementConstants.BatchStatusProcessing
                        && b.ProviderPayoutId != null)
            .Select(b => new { b.PayoutBatchId, b.ProviderPayoutId })
            .ToListAsync(ct);

        return rows.Select(r => (r.PayoutBatchId, r.ProviderPayoutId!)).ToList();
    }

    public async Task<Guid?> GetShopOwnerUserIdAsync(Guid shopId, CancellationToken ct = default) =>
        await _db.Shops.AsNoTracking()
            .Where(s => s.ShopId == shopId)
            .Select(s => (Guid?)s.OwnerUserId)
            .FirstOrDefaultAsync(ct);

    /* ------------------------------------------------------------- helpers */

    private async Task MarkPaidInternalAsync(PayoutBatch batch, string? reference, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var wallet = await RequireWalletAsync(batch.ShopId, ct);

        var entries = await _db.SettlementEntries
            .Where(e => e.PayoutBatchId == batch.PayoutBatchId
                        && e.Status == SettlementConstants.EntryStatusApproved)
            .ToListAsync(ct);

        var net = entries.Sum(e => e.NetAmount);

        if (net > 0)
        {
            wallet.AvailableBalance = Round(wallet.AvailableBalance - net);
            wallet.UpdatedAt = now;
            AddWalletTx(
                wallet,
                SettlementConstants.TxPayout,
                -net,
                SettlementConstants.WalletReferenceTypePayoutBatch,
                batch.PayoutBatchId,
                reference is null
                    ? $"Payout {batch.BatchCode}"
                    : $"Payout {batch.BatchCode} (ref {reference})",
                now);
        }

        foreach (var entry in entries)
        {
            entry.Status = SettlementConstants.EntryStatusPaid;
            entry.UpdatedAt = now;
        }

        batch.Status = SettlementConstants.BatchStatusPaid;
        batch.PaidAt = now;
        batch.FailureReason = null;
        batch.UpdatedAt = now;
    }

    private async Task<Wallet> RequireWalletAsync(Guid shopId, CancellationToken ct) =>
        await _db.Wallets.FirstOrDefaultAsync(w => w.ShopId == shopId, ct)
        ?? throw new AppException("Seller wallet was not found for this shop.");

    private void AddWalletTx(
        Wallet wallet,
        string txType,
        decimal amount,
        string referenceType,
        Guid referenceId,
        string note,
        DateTime now)
    {
        _db.WalletTransactions.Add(new WalletTransaction
        {
            WalletId = wallet.WalletId,
            TxType = txType,
            Amount = Round(amount),
            BalanceAfter = wallet.AvailableBalance,
            PendingAfter = wallet.PendingBalance,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            Note = note,
            CreatedAt = now
        });
    }

    private bool HasOpenBatchOn(Guid shopBankAccountId) =>
        _db.PayoutBatches.Any(b => b.ShopBankAccountId == shopBankAccountId
                                   && (b.Status == SettlementConstants.BatchStatusDraft
                                       || b.Status == SettlementConstants.BatchStatusApproved
                                       || b.Status == SettlementConstants.BatchStatusProcessing));

    private async Task<string> GenerateBatchCodeAsync(DateTime now, CancellationToken ct)
    {
        for (var attempt = 0; attempt < 8; attempt++)
        {
            var code = $"PAY-{now:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}";
            if (code.Length > SettlementConstants.MaxBatchCodeLength)
                code = code[..SettlementConstants.MaxBatchCodeLength];

            if (!await _db.PayoutBatches.AsNoTracking().AnyAsync(b => b.BatchCode == code, ct))
                return code;
        }

        throw new AppException("Unable to generate a unique payout batch code. Please try again.");
    }

    private static bool IsProviderSuccess(string? state) =>
        state is not null
        && (state.Equals("SUCCEEDED", StringComparison.OrdinalIgnoreCase)
            || state.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase)
            || state.Equals("SUCCESS", StringComparison.OrdinalIgnoreCase));

    private static bool IsProviderFailure(string? state) =>
        state is not null
        && (state.Equals("FAILED", StringComparison.OrdinalIgnoreCase)
            || state.Equals("CANCELLED", StringComparison.OrdinalIgnoreCase)
            || state.Equals("REJECTED", StringComparison.OrdinalIgnoreCase));

    private static decimal Round(decimal value) =>
        decimal.Round(value, 2, MidpointRounding.AwayFromZero);

    private static int DaysUntil(DateTime holdUntil, DateTime now) =>
        holdUntil <= now ? 0 : (int)Math.Ceiling((holdUntil - now).TotalDays);

    private static string Mask(string accountNumber) =>
        accountNumber.Length <= 4
            ? accountNumber
            : new string('•', accountNumber.Length - 4) + accountNumber[^4..];

    private static string Truncate(string value, int max) =>
        string.IsNullOrEmpty(value) || value.Length <= max ? value : value[..max];

    private static ShopBankAccountDto MapBank(ShopBankAccount a) => new()
    {
        ShopBankAccountId = a.ShopBankAccountId,
        ShopId = a.ShopId,
        BankBin = a.BankBin,
        BankName = a.BankName,
        AccountNumberMasked = Mask(a.AccountNumber),
        AccountName = a.AccountName,
        Status = a.Status,
        RejectReason = a.RejectReason,
        VerifiedAt = a.VerifiedAt,
        UpdatedAt = a.UpdatedAt
    };

    /// <summary>Flat row so the account number can be masked after leaving SQL.</summary>
    private sealed record BatchRow(
        Guid PayoutBatchId,
        string BatchCode,
        Guid ShopId,
        string ShopName,
        string AccountNumber,
        string AccountName,
        string? BankName,
        DateTime PeriodTo,
        int EntryCount,
        decimal GrossAmount,
        decimal CommissionAmount,
        decimal NetAmount,
        string Currency,
        string Status,
        DateTime? ApprovedAt,
        string? ProviderPayoutId,
        string? ProviderState,
        DateTime? PaidAt,
        string? FailureReason,
        int AttemptCount,
        DateTime CreatedAt)
    {
        public static readonly Expression<Func<PayoutBatch, BatchRow>> Projection = b => new BatchRow(
            b.PayoutBatchId,
            b.BatchCode,
            b.ShopId,
            b.Shop.ShopName,
            b.ShopBankAccount.AccountNumber,
            b.ShopBankAccount.AccountName,
            b.ShopBankAccount.BankName,
            b.PeriodTo,
            b.EntryCount,
            b.GrossAmount,
            b.CommissionAmount,
            b.NetAmount,
            b.Currency,
            b.Status,
            b.ApprovedAt,
            b.ProviderPayoutId,
            b.ProviderState,
            b.PaidAt,
            b.FailureReason,
            b.AttemptCount,
            b.CreatedAt);
    }

    private static PayoutBatchDto MapBatch(BatchRow r) => new()
    {
        PayoutBatchId = r.PayoutBatchId,
        BatchCode = r.BatchCode,
        ShopId = r.ShopId,
        ShopName = r.ShopName,
        AccountNumberMasked = Mask(r.AccountNumber),
        AccountName = r.AccountName,
        BankName = r.BankName,
        PeriodTo = r.PeriodTo,
        EntryCount = r.EntryCount,
        GrossAmount = r.GrossAmount,
        CommissionAmount = r.CommissionAmount,
        NetAmount = r.NetAmount,
        Currency = r.Currency,
        Status = r.Status,
        ApprovedAt = r.ApprovedAt,
        ProviderPayoutId = r.ProviderPayoutId,
        ProviderState = r.ProviderState,
        PaidAt = r.PaidAt,
        FailureReason = r.FailureReason,
        AttemptCount = r.AttemptCount,
        CreatedAt = r.CreatedAt
    };
}
