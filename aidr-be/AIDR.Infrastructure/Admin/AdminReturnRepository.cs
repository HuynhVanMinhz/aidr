using System.Text.Json;
using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Admin;

public sealed class AdminReturnRepository : IAdminReturnRepository
{
    private readonly AidrDbContext _db;

    public AdminReturnRepository(AidrDbContext db)
    {
        _db = db;
    }

    public async Task<(IReadOnlyList<AdminReturnListRecord> Items, int TotalCount, int Page, AdminReturnRequestListSummary Summary)>
        ListPagedAsync(
            string? status,
            string? keyword,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default)
    {
        var query =
            from r in _db.ReturnRequests.AsNoTracking()
            join o in _db.Orders.AsNoTracking() on r.OrderId equals o.OrderId
            join s in _db.Shops.AsNoTracking() on o.ShopId equals s.ShopId
            join b in _db.Users.AsNoTracking() on r.BuyerUserId equals b.UserId
            select new { Return = r, Order = o, Shop = s, Buyer = b };

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Return.Status == status);

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var term = keyword.Trim();
            query = query.Where(x =>
                x.Order.OrderCode.Contains(term)
                || x.Shop.ShopName.Contains(term)
                || x.Buyer.Email.Contains(term)
                || x.Buyer.FullName.Contains(term)
                || x.Return.Reason.Contains(term));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var summary = await BuildSummaryAsync(cancellationToken);

        if (totalCount == 0)
            return (Array.Empty<AdminReturnListRecord>(), 0, 1, summary);

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        if (page > totalPages)
            page = totalPages;

        var rows = await query
            .OrderByDescending(x => x.Return.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Return.ReturnRequestId,
                x.Return.OrderId,
                x.Order.OrderCode,
                x.Order.ShopId,
                x.Shop.ShopName,
                x.Return.BuyerUserId,
                BuyerEmail = x.Buyer.Email,
                BuyerFullName = x.Buyer.FullName,
                x.Return.Reason,
                x.Return.Status,
                x.Return.ResolutionType,
                x.Return.RefundAmount,
                OrderTotalAmount = x.Order.TotalAmount,
                EvidenceCount = x.Return.Evidences.Count,
                x.Return.CreatedAt,
                x.Return.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(x => new AdminReturnListRecord
        {
            ReturnRequestId = x.ReturnRequestId,
            OrderId = x.OrderId,
            OrderCode = x.OrderCode,
            ShopId = x.ShopId,
            ShopName = x.ShopName,
            BuyerUserId = x.BuyerUserId,
            BuyerEmail = x.BuyerEmail,
            BuyerFullName = x.BuyerFullName,
            Reason = x.Reason,
            Status = x.Status,
            ResolutionType = x.ResolutionType,
            RefundAmount = x.RefundAmount,
            OrderTotalAmount = x.OrderTotalAmount,
            EvidenceCount = x.EvidenceCount,
            CreatedAt = x.CreatedAt,
            UpdatedAt = x.UpdatedAt
        }).ToList();

        return (items, totalCount, page, summary);
    }

    public async Task<AdminReturnRequestDetailDto?> GetDetailAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken = default)
    {
        var entity = await LoadTrackedDetailQuery()
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.ReturnRequestId == returnRequestId, cancellationToken);

        if (entity is null)
            return null;

        var changerNames = await LoadUserNamesAsync(
            entity.StatusHistories.Where(h => h.ChangedBy.HasValue).Select(h => h.ChangedBy!.Value),
            cancellationToken);

        return MapDetail(entity, changerNames);
    }

    public async Task<AdminReturnRequestDetailDto> ApproveAsync(
        Guid returnRequestId,
        Guid adminUserId,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var entity = await LoadTrackedDetailQuery()
            .FirstOrDefaultAsync(r => r.ReturnRequestId == returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        if (!string.Equals(entity.Status, ReturnConstants.StatusPending, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Only pending return requests can be approved.");

        var now = DateTime.UtcNow;
        var from = entity.Status;
        entity.Status = ReturnConstants.StatusApproved;
        entity.ReviewedBy = adminUserId;
        entity.ReviewedAt = now;
        entity.UpdatedAt = now;
        entity.StatusHistories.Add(new ReturnStatusHistory
        {
            ReturnRequestId = entity.ReturnRequestId,
            FromStatus = from,
            ToStatus = ReturnConstants.StatusApproved,
            ChangedBy = adminUserId,
            Note = "Admin approved and forwarded return request to seller",
            CreatedAt = now
        });

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return (await GetDetailAsync(returnRequestId, cancellationToken))!;
    }

    public async Task<AdminReturnRequestDetailDto> RejectAsync(
        Guid returnRequestId,
        Guid adminUserId,
        string adminNote,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var entity = await LoadTrackedDetailQuery()
            .FirstOrDefaultAsync(r => r.ReturnRequestId == returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        if (!string.Equals(entity.Status, ReturnConstants.StatusPending, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Only pending return requests can be rejected.");

        var now = DateTime.UtcNow;
        var from = entity.Status;
        entity.Status = ReturnConstants.StatusRejected;
        entity.AdminNote = adminNote;
        entity.ReviewedBy = adminUserId;
        entity.ReviewedAt = now;
        entity.UpdatedAt = now;
        entity.StatusHistories.Add(new ReturnStatusHistory
        {
            ReturnRequestId = entity.ReturnRequestId,
            FromStatus = from,
            ToStatus = ReturnConstants.StatusRejected,
            ChangedBy = adminUserId,
            Note = adminNote,
            CreatedAt = now
        });

        await RestoreOrderStatusAfterRejectAsync(entity.Order, adminUserId, now, cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return (await GetDetailAsync(returnRequestId, cancellationToken))!;
    }

    public async Task<AdminReturnRequestDetailDto> UpdateStatusAsync(
        Guid returnRequestId,
        Guid adminUserId,
        string toStatus,
        string? note,
        string? refundToBin,
        string? refundToAccountNumber,
        string? refundTransferProofUrl,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var entity = await LoadTrackedDetailQuery()
            .FirstOrDefaultAsync(r => r.ReturnRequestId == returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        if (!ReturnConstants.AdminStatusTransitions.TryGetValue(entity.Status, out var allowed)
            || !allowed.Contains(toStatus, StringComparer.OrdinalIgnoreCase))
        {
            throw new ConflictException(
                $"Cannot transition return request from {entity.Status} to {toStatus}.");
        }

        if (string.Equals(entity.Status, ReturnConstants.StatusAccepted, StringComparison.OrdinalIgnoreCase))
        {
            var expectedOutcome = ReturnConstants.ExpectedResolutionOutcome(entity.ResolutionType);
            if (!string.Equals(toStatus, expectedOutcome, StringComparison.OrdinalIgnoreCase))
            {
                throw new ConflictException(
                    $"Resolution type {entity.ResolutionType} requires status {expectedOutcome}.");
            }
        }

        var now = DateTime.UtcNow;
        var from = entity.Status;

        if (string.Equals(toStatus, ReturnConstants.StatusRefunded, StringComparison.OrdinalIgnoreCase))
        {
            await ProcessRefundAsync(
                entity,
                now,
                refundToBin,
                refundToAccountNumber,
                refundTransferProofUrl,
                cancellationToken);
        }

        entity.Status = toStatus;
        entity.UpdatedAt = now;
        entity.StatusHistories.Add(new ReturnStatusHistory
        {
            ReturnRequestId = entity.ReturnRequestId,
            FromStatus = from,
            ToStatus = toStatus,
            ChangedBy = adminUserId,
            Note = note ?? BuildDefaultStatusNote(toStatus),
            CreatedAt = now
        });

        if (string.Equals(toStatus, ReturnConstants.StatusRefunded, StringComparison.OrdinalIgnoreCase)
            || string.Equals(toStatus, ReturnConstants.StatusExchanged, StringComparison.OrdinalIgnoreCase)
            || string.Equals(toStatus, ReturnConstants.StatusClosed, StringComparison.OrdinalIgnoreCase))
        {
            await MarkOrderReturnedAsync(entity.Order, adminUserId, now);
        }

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return (await GetDetailAsync(returnRequestId, cancellationToken))!;
    }

    private async Task ProcessRefundAsync(
        ReturnRequest entity,
        DateTime now,
        string? refundToBin,
        string? refundToAccountNumber,
        string? refundTransferProofUrl,
        CancellationToken cancellationToken)
    {
        var order = entity.Order;
        var refundAmount = decimal.Round(order.TotalAmount, 2, MidpointRounding.AwayFromZero);
        entity.RefundAmount = refundAmount;
        entity.RefundTransferProofUrl = refundTransferProofUrl;

        var payment = order.Payments
            .Where(p => string.Equals(p.Status, PaymentConstants.StatusSucceeded, StringComparison.OrdinalIgnoreCase)
                        || string.Equals(p.Status, PaymentConstants.StatusRefunded, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(p => p.PaidAt ?? p.CreatedAt)
            .FirstOrDefault();

        if (payment is null)
            throw new ConflictException("No succeeded payment was found to refund for this order.");

        // Admin transfers manually (no payOS Chi hộ). Mark payment refunded and keep an audit trail.
        if (!string.Equals(payment.Status, PaymentConstants.StatusRefunded, StringComparison.OrdinalIgnoreCase))
        {
            var toBin = !string.IsNullOrWhiteSpace(refundToBin)
                ? refundToBin.Trim()
                : entity.RefundBankBin?.Trim();
            var toAccount = !string.IsNullOrWhiteSpace(refundToAccountNumber)
                ? refundToAccountNumber.Trim()
                : entity.RefundAccountNumber?.Trim();

            payment.Status = PaymentConstants.StatusRefunded;
            payment.UpdatedAt = now;
            payment.RawResponseJson = MergeManualRefundIntoPaymentRaw(
                payment.RawResponseJson,
                entity.ReturnRequestId,
                refundAmount,
                toBin,
                toAccount,
                refundTransferProofUrl,
                now);
        }

        await ReverseSettlementAsync(order, entity.ReturnRequestId, refundAmount, now, cancellationToken);
    }

    private static string MergeManualRefundIntoPaymentRaw(
        string? existingRaw,
        Guid returnRequestId,
        decimal refundAmount,
        string? toBin,
        string? toAccountNumber,
        string? proofUrl,
        DateTime now)
    {
        object? previous = null;
        if (!string.IsNullOrWhiteSpace(existingRaw))
        {
            try
            {
                previous = JsonSerializer.Deserialize<JsonElement>(existingRaw);
            }
            catch (JsonException)
            {
                previous = existingRaw;
            }
        }

        return JsonSerializer.Serialize(new
        {
            previous,
            manualRefund = new
            {
                mode = "manual",
                returnRequestId,
                amount = refundAmount,
                toBin,
                toAccountNumber,
                proofUrl,
                refundedAt = now
            }
        });
    }

    /// <summary>
    /// Take the shop's money back for a refunded order. Which balance it comes out
    /// of depends on how far the settlement got:
    ///   still held  -> drop the pending amount, and the platform earns no commission;
    ///   released    -> debit the available balance (may go negative, BR-R04) and
    ///                  credit back the commission already recognised.
    /// </summary>
    private async Task ReverseSettlementAsync(
        Order order,
        Guid returnRequestId,
        decimal refundAmount,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var alreadyReversed = await _db.WalletTransactions.AnyAsync(
            t => t.ReferenceType == ReturnConstants.WalletReferenceTypeReturnRequest
                 && t.ReferenceId == returnRequestId
                 && (t.TxType == ReturnConstants.WalletTxTypeRefundDebit
                     || t.TxType == SettlementConstants.TxSettlementReversal),
            cancellationToken);

        if (alreadyReversed)
            return;

        var entry = await _db.SettlementEntries
            .FirstOrDefaultAsync(e => e.OrderId == order.OrderId, cancellationToken);

        // No entry yet (order never reached Completed) - nothing was ever owed.
        if (entry is null)
            return;

        var wallet = await _db.Wallets
            .FirstOrDefaultAsync(w => w.ShopId == order.ShopId, cancellationToken)
            ?? throw new AppException("Seller wallet was not found for this shop.");

        if (SettlementConstants.PendingBalanceStatuses.Contains(entry.Status))
        {
            wallet.PendingBalance = decimal.Round(
                Math.Max(0m, wallet.PendingBalance - entry.NetAmount),
                2,
                MidpointRounding.AwayFromZero);
            wallet.UpdatedAt = now;

            _db.WalletTransactions.Add(new WalletTransaction
            {
                WalletId = wallet.WalletId,
                TxType = SettlementConstants.TxSettlementReversal,
                Amount = -entry.NetAmount,
                BalanceAfter = wallet.AvailableBalance,
                PendingAfter = wallet.PendingBalance,
                ReferenceType = ReturnConstants.WalletReferenceTypeReturnRequest,
                ReferenceId = returnRequestId,
                Note = $"Settlement reversed - order {order.OrderCode} refunded before release",
                CreatedAt = now
            });

            entry.Status = SettlementConstants.EntryStatusReversed;
            entry.ReversedReason = $"Return refunded on {now:yyyy-MM-dd}";
            entry.PayoutBatchId = null;
            entry.UpdatedAt = now;
            return;
        }

        // Already released or paid out: claw the net back from the available
        // balance and hand back the commission - the platform does not keep a fee
        // on an order that was returned.
        wallet.AvailableBalance = decimal.Round(
            wallet.AvailableBalance - refundAmount,
            2,
            MidpointRounding.AwayFromZero);
        wallet.UpdatedAt = now;

        _db.WalletTransactions.Add(new WalletTransaction
        {
            WalletId = wallet.WalletId,
            TxType = ReturnConstants.WalletTxTypeRefundDebit,
            Amount = -refundAmount,
            BalanceAfter = wallet.AvailableBalance,
            PendingAfter = wallet.PendingBalance,
            ReferenceType = ReturnConstants.WalletReferenceTypeReturnRequest,
            ReferenceId = returnRequestId,
            Note = $"Refund debit for return on order {order.OrderCode}",
            CreatedAt = now
        });

        if (entry.CommissionAmount > 0)
        {
            wallet.AvailableBalance = decimal.Round(
                wallet.AvailableBalance + entry.CommissionAmount,
                2,
                MidpointRounding.AwayFromZero);
            wallet.UpdatedAt = now;

            _db.WalletTransactions.Add(new WalletTransaction
            {
                WalletId = wallet.WalletId,
                TxType = SettlementConstants.TxCommissionFee,
                Amount = entry.CommissionAmount,
                BalanceAfter = wallet.AvailableBalance,
                PendingAfter = wallet.PendingBalance,
                ReferenceType = ReturnConstants.WalletReferenceTypeReturnRequest,
                ReferenceId = returnRequestId,
                Note = $"Platform fee refunded - order {order.OrderCode} returned",
                CreatedAt = now
            });
        }

        entry.ReversedReason = $"Refunded after release on {now:yyyy-MM-dd}";
        entry.UpdatedAt = now;
    }

    private async Task RestoreOrderStatusAfterRejectAsync(
        Order order,
        Guid adminUserId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(order.Status, OrderConstants.StatusReturnRequested, StringComparison.OrdinalIgnoreCase))
            return;

        var previous = await _db.OrderStatusHistories.AsNoTracking()
            .Where(h => h.OrderId == order.OrderId
                        && h.ToStatus == OrderConstants.StatusReturnRequested)
            .OrderByDescending(h => h.CreatedAt)
            .ThenByDescending(h => h.HistoryId)
            .Select(h => h.FromStatus)
            .FirstOrDefaultAsync(cancellationToken);

        var restoreStatus = previous is not null && ReturnConstants.EligibleOrderStatuses.Contains(previous)
            ? previous
            : OrderConstants.StatusDelivered;

        var from = order.Status;
        order.Status = restoreStatus;
        order.UpdatedAt = now;
        order.StatusHistories.Add(new OrderStatusHistory
        {
            OrderId = order.OrderId,
            FromStatus = from,
            ToStatus = restoreStatus,
            ChangedBy = adminUserId,
            Note = "Return request rejected; order status restored",
            CreatedAt = now
        });

        // Dispute over - let the settlement continue where it left off.
        var entry = await _db.SettlementEntries
            .FirstOrDefaultAsync(e => e.OrderId == order.OrderId, cancellationToken);

        if (entry is not null
            && string.Equals(entry.Status, SettlementConstants.EntryStatusOnHold, StringComparison.OrdinalIgnoreCase))
        {
            var due = entry.HoldUntil <= now;
            entry.Status = due
                ? SettlementConstants.EntryStatusEligible
                : SettlementConstants.EntryStatusHolding;
            entry.EligibleAt = due ? now : null;
            entry.HoldReason = null;
            entry.UpdatedAt = now;
        }
    }

    private static Task MarkOrderReturnedAsync(Order order, Guid adminUserId, DateTime now)
    {
        if (string.Equals(order.Status, OrderConstants.StatusReturned, StringComparison.OrdinalIgnoreCase))
            return Task.CompletedTask;

        var from = order.Status;
        order.Status = OrderConstants.StatusReturned;
        order.UpdatedAt = now;
        order.StatusHistories.Add(new OrderStatusHistory
        {
            OrderId = order.OrderId,
            FromStatus = from,
            ToStatus = OrderConstants.StatusReturned,
            ChangedBy = adminUserId,
            Note = "Return / refund completed",
            CreatedAt = now
        });

        return Task.CompletedTask;
    }

    private IQueryable<ReturnRequest> LoadTrackedDetailQuery() =>
        _db.ReturnRequests
            .Include(r => r.Order)
                .ThenInclude(o => o.Shop)
            .Include(r => r.Order)
                .ThenInclude(o => o.Payments)
            .Include(r => r.Order)
                .ThenInclude(o => o.StatusHistories)
            .Include(r => r.Buyer)
            .Include(r => r.Reviewer)
            .Include(r => r.Items)
                .ThenInclude(i => i.OrderItem)
            .Include(r => r.Evidences)
            .Include(r => r.StatusHistories);

    private async Task<AdminReturnRequestListSummary> BuildSummaryAsync(CancellationToken cancellationToken)
    {
        var rows = await _db.ReturnRequests.AsNoTracking()
            .GroupBy(r => r.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        int CountOf(string status) =>
            rows.Where(r => string.Equals(r.Status, status, StringComparison.OrdinalIgnoreCase))
                .Select(r => r.Count)
                .FirstOrDefault();

        return new AdminReturnRequestListSummary
        {
            PendingCount = CountOf(ReturnConstants.StatusPending),
            ApprovedCount = CountOf(ReturnConstants.StatusApproved),
            RejectedCount = CountOf(ReturnConstants.StatusRejected),
            SellerConfirmedCount = CountOf(ReturnConstants.StatusSellerConfirmed),
            ReceivingCount = CountOf(ReturnConstants.StatusReceiving),
            AcceptedCount = CountOf(ReturnConstants.StatusAccepted),
            RefundedCount = CountOf(ReturnConstants.StatusRefunded),
            ExchangedCount = CountOf(ReturnConstants.StatusExchanged),
            ClosedCount = CountOf(ReturnConstants.StatusClosed)
        };
    }

    private async Task<IReadOnlyDictionary<Guid, string>> LoadUserNamesAsync(
        IEnumerable<Guid> userIds,
        CancellationToken cancellationToken)
    {
        var ids = userIds.Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<Guid, string>();

        return await _db.Users.AsNoTracking()
            .Where(u => ids.Contains(u.UserId))
            .ToDictionaryAsync(u => u.UserId, u => u.FullName, cancellationToken);
    }

    private static AdminReturnRequestDetailDto MapDetail(
        ReturnRequest entity,
        IReadOnlyDictionary<Guid, string> changerNames)
    {
        return new AdminReturnRequestDetailDto
        {
            ReturnRequestId = entity.ReturnRequestId,
            OrderId = entity.OrderId,
            OrderCode = entity.Order.OrderCode,
            OrderStatus = entity.Order.Status,
            ShopId = entity.Order.ShopId,
            ShopName = entity.Order.Shop.ShopName,
            ShopOwnerUserId = entity.Order.Shop.OwnerUserId,
            BuyerUserId = entity.BuyerUserId,
            BuyerEmail = entity.Buyer.Email,
            BuyerFullName = entity.Buyer.FullName,
            Reason = entity.Reason,
            Description = entity.Description,
            ResolutionType = entity.ResolutionType,
            Status = entity.Status,
            RefundAmount = entity.RefundAmount,
            OrderTotalAmount = entity.Order.TotalAmount,
            AdminNote = entity.AdminNote,
            ReviewedBy = entity.ReviewedBy,
            ReviewerFullName = entity.Reviewer?.FullName,
            ReviewedAt = entity.ReviewedAt,
            RefundBankBin = entity.RefundBankBin,
            RefundBankName = entity.RefundBankName,
            RefundAccountNumber = entity.RefundAccountNumber,
            RefundAccountNumberMasked = entity.RefundAccountNumber is { Length: > 4 } acct
                ? $"{new string('*', acct.Length - 4)}{acct[^4..]}"
                : entity.RefundAccountNumber,
            RefundAccountName = entity.RefundAccountName,
            RefundTransferProofUrl = entity.RefundTransferProofUrl,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt,
            Items = entity.Items
                .OrderBy(i => i.ReturnItemId)
                .Select(i => new AdminReturnItemDto
                {
                    ReturnItemId = i.ReturnItemId,
                    OrderItemId = i.OrderItemId,
                    ProductId = i.OrderItem.ProductId,
                    ProductName = i.OrderItem.ProductNameSnapshot,
                    Sku = i.OrderItem.SkuSnapshot,
                    Quantity = i.Quantity,
                    UnitPrice = i.OrderItem.UnitPrice,
                    LineTotal = decimal.Round(
                        i.OrderItem.UnitPrice * i.Quantity,
                        2,
                        MidpointRounding.AwayFromZero)
                })
                .ToList(),
            Evidences = entity.Evidences
                .OrderBy(e => e.SortOrder)
                .ThenBy(e => e.CreatedAt)
                .Select(e => new AdminReturnEvidenceDto
                {
                    EvidenceId = e.EvidenceId,
                    EvidenceType = e.EvidenceType,
                    MediaUrl = e.MediaUrl,
                    PublicId = e.PublicId,
                    SortOrder = e.SortOrder,
                    CreatedAt = e.CreatedAt
                })
                .ToList(),
            StatusHistories = entity.StatusHistories
                .OrderBy(h => h.CreatedAt)
                .ThenBy(h => h.HistoryId)
                .Select(h => new AdminReturnStatusHistoryDto
                {
                    FromStatus = h.FromStatus,
                    ToStatus = h.ToStatus,
                    ChangedBy = h.ChangedBy,
                    ChangedByFullName = h.ChangedBy.HasValue
                        && changerNames.TryGetValue(h.ChangedBy.Value, out var name)
                            ? name
                            : null,
                    Note = h.Note,
                    CreatedAt = h.CreatedAt
                })
                .ToList()
        };
    }

    private static string BuildDefaultStatusNote(string toStatus) =>
        toStatus switch
        {
            ReturnConstants.StatusRefunded => "Buyer refunded via manual bank transfer; seller wallet debit recorded",
            ReturnConstants.StatusExchanged => "Exchange completed - replacement handled by seller",
            ReturnConstants.StatusClosed => "Return request closed",
            _ => $"Status updated to {toStatus}"
        };
}
