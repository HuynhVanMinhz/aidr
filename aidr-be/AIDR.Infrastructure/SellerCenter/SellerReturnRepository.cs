using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.SellerCenter;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.SellerCenter;

public sealed class SellerReturnRepository : ISellerReturnRepository
{
    private readonly AidrDbContext _db;

    public SellerReturnRepository(AidrDbContext db) => _db = db;

    public async Task<(IReadOnlyList<SellerReturnListRecord> Items, int TotalCount, int Page, SellerReturnListSummary Summary)>
        ListPagedForShopAsync(
            Guid shopId,
            string? status,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default)
    {
        var query =
            from r in _db.ReturnRequests.AsNoTracking()
            join o in _db.Orders.AsNoTracking() on r.OrderId equals o.OrderId
            join b in _db.Users.AsNoTracking() on r.BuyerUserId equals b.UserId
            where o.ShopId == shopId
            select new { Return = r, Order = o, Buyer = b };

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Return.Status == status);

        var totalCount = await query.CountAsync(cancellationToken);
        var summary = await BuildSummaryAsync(shopId, cancellationToken);

        if (totalCount == 0)
            return (Array.Empty<SellerReturnListRecord>(), 0, 1, summary);

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        if (page > totalPages)
            page = totalPages;

        var rows = await query
            .OrderByDescending(x => x.Return.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new SellerReturnListRecord
            {
                ReturnRequestId = x.Return.ReturnRequestId,
                OrderId = x.Return.OrderId,
                OrderCode = x.Order.OrderCode,
                BuyerUserId = x.Return.BuyerUserId,
                BuyerEmail = x.Buyer.Email,
                BuyerFullName = x.Buyer.FullName,
                Reason = x.Return.Reason,
                Status = x.Return.Status,
                ResolutionType = x.Return.ResolutionType,
                RefundAmount = x.Return.RefundAmount,
                OrderTotalAmount = x.Order.TotalAmount,
                EvidenceCount = x.Return.Evidences.Count,
                CreatedAt = x.Return.CreatedAt,
                UpdatedAt = x.Return.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        return (rows, totalCount, page, summary);
    }

    public async Task<SellerReturnDetailDto?> GetDetailForShopAsync(
        Guid shopId,
        Guid returnRequestId,
        CancellationToken cancellationToken = default)
    {
        var entity = await LoadDetailQuery()
            .AsNoTracking()
            .FirstOrDefaultAsync(
                r => r.ReturnRequestId == returnRequestId && r.Order.ShopId == shopId,
                cancellationToken);

        if (entity is null)
            return null;

        var changerNames = await LoadUserNamesAsync(
            entity.StatusHistories.Where(h => h.ChangedBy.HasValue).Select(h => h.ChangedBy!.Value),
            cancellationToken);

        return MapDetail(entity, changerNames);
    }

    public async Task<SellerReturnDetailDto> ConfirmAsync(
        Guid shopId,
        Guid returnRequestId,
        Guid sellerUserId,
        string resolutionType,
        string? note,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var entity = await LoadDetailQuery()
            .FirstOrDefaultAsync(
                r => r.ReturnRequestId == returnRequestId && r.Order.ShopId == shopId,
                cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        if (!string.Equals(entity.Status, ReturnConstants.StatusApproved, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Only approved return requests can be confirmed by the seller.");

        var now = DateTime.UtcNow;
        var from = entity.Status;
        entity.ResolutionType = resolutionType;
        entity.Status = ReturnConstants.StatusSellerConfirmed;
        entity.UpdatedAt = now;
        entity.StatusHistories.Add(new ReturnStatusHistory
        {
            ReturnRequestId = entity.ReturnRequestId,
            FromStatus = from,
            ToStatus = ReturnConstants.StatusSellerConfirmed,
            ChangedBy = sellerUserId,
            Note = note ?? $"Seller confirmed {resolutionType}",
            CreatedAt = now
        });

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return (await GetDetailForShopAsync(shopId, returnRequestId, cancellationToken))!;
    }

    public async Task<SellerReturnDetailDto> AdvanceAsync(
        Guid shopId,
        Guid returnRequestId,
        Guid sellerUserId,
        string toStatus,
        string? note,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var entity = await LoadDetailQuery()
            .FirstOrDefaultAsync(
                r => r.ReturnRequestId == returnRequestId && r.Order.ShopId == shopId,
                cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        if (!ReturnConstants.SellerStatusTransitions.TryGetValue(entity.Status, out var expected)
            || !string.Equals(expected, toStatus, StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException(
                $"Cannot transition return request from {entity.Status} to {toStatus}.");
        }

        var now = DateTime.UtcNow;
        var from = entity.Status;
        entity.Status = toStatus;
        entity.UpdatedAt = now;
        entity.StatusHistories.Add(new ReturnStatusHistory
        {
            ReturnRequestId = entity.ReturnRequestId,
            FromStatus = from,
            ToStatus = toStatus,
            ChangedBy = sellerUserId,
            Note = note ?? BuildDefaultNote(toStatus),
            CreatedAt = now
        });

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return (await GetDetailForShopAsync(shopId, returnRequestId, cancellationToken))!;
    }

    public async Task<SellerReturnDetailDto> RejectAsync(
        Guid shopId,
        Guid returnRequestId,
        Guid sellerUserId,
        string note,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var entity = await LoadDetailQuery()
            .FirstOrDefaultAsync(
                r => r.ReturnRequestId == returnRequestId && r.Order.ShopId == shopId,
                cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        if (!ReturnConstants.SellerRejectableStatuses.Contains(entity.Status))
            throw new ConflictException("Seller can only reject returns that are approved or receiving.");

        var now = DateTime.UtcNow;
        var from = entity.Status;
        entity.Status = ReturnConstants.StatusRejected;
        entity.AdminNote = note;
        entity.UpdatedAt = now;
        entity.StatusHistories.Add(new ReturnStatusHistory
        {
            ReturnRequestId = entity.ReturnRequestId,
            FromStatus = from,
            ToStatus = ReturnConstants.StatusRejected,
            ChangedBy = sellerUserId,
            Note = note,
            CreatedAt = now
        });

        await RestoreOrderStatusAfterRejectAsync(entity.Order, sellerUserId, now);

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return (await GetDetailForShopAsync(shopId, returnRequestId, cancellationToken))!;
    }

    public async Task<Guid?> GetShopOwnerUserIdAsync(Guid shopId, CancellationToken cancellationToken = default)
    {
        return await _db.Shops.AsNoTracking()
            .Where(s => s.ShopId == shopId)
            .Select(s => (Guid?)s.OwnerUserId)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Guid>> ListAdminUserIdsAsync(CancellationToken cancellationToken = default)
    {
        return await _db.UserRoles.AsNoTracking()
            .Where(ur => ur.Role.RoleCode == RoleCodes.Admin)
            .Select(ur => ur.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);
    }

    private async Task RestoreOrderStatusAfterRejectAsync(Order order, Guid changedBy, DateTime now)
    {
        if (!string.Equals(order.Status, OrderConstants.StatusReturnRequested, StringComparison.OrdinalIgnoreCase))
            return;

        var previous = order.StatusHistories
            .Where(h => string.Equals(h.ToStatus, OrderConstants.StatusReturnRequested, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(h => h.CreatedAt)
            .Select(h => h.FromStatus)
            .FirstOrDefault();

        var restoreTo = !string.IsNullOrWhiteSpace(previous) && ReturnConstants.EligibleOrderStatuses.Contains(previous)
            ? previous
            : OrderConstants.StatusDelivered;

        var from = order.Status;
        order.Status = restoreTo!;
        order.UpdatedAt = now;
        order.StatusHistories.Add(new OrderStatusHistory
        {
            OrderId = order.OrderId,
            FromStatus = from,
            ToStatus = restoreTo,
            ChangedBy = changedBy,
            Note = "Return request rejected - order status restored",
            CreatedAt = now
        });

        var entry = await _db.SettlementEntries.FirstOrDefaultAsync(e => e.OrderId == order.OrderId);
        if (entry is not null
            && string.Equals(entry.Status, SettlementConstants.EntryStatusOnHold, StringComparison.OrdinalIgnoreCase)
            && string.Equals(entry.HoldReason, "Return request open", StringComparison.OrdinalIgnoreCase))
        {
            entry.Status = SettlementConstants.EntryStatusHolding;
            entry.HoldReason = null;
            entry.UpdatedAt = now;
        }
    }

    private async Task<SellerReturnListSummary> BuildSummaryAsync(Guid shopId, CancellationToken cancellationToken)
    {
        var rows = await (
            from r in _db.ReturnRequests.AsNoTracking()
            join o in _db.Orders.AsNoTracking() on r.OrderId equals o.OrderId
            where o.ShopId == shopId
            group r by r.Status into g
            select new { Status = g.Key, Count = g.Count() }
        ).ToListAsync(cancellationToken);

        int CountOf(string status) =>
            rows.Where(r => string.Equals(r.Status, status, StringComparison.OrdinalIgnoreCase))
                .Select(r => r.Count)
                .FirstOrDefault();

        return new SellerReturnListSummary
        {
            ApprovedCount = CountOf(ReturnConstants.StatusApproved),
            SellerConfirmedCount = CountOf(ReturnConstants.StatusSellerConfirmed),
            ReceivingCount = CountOf(ReturnConstants.StatusReceiving),
            AcceptedCount = CountOf(ReturnConstants.StatusAccepted)
        };
    }

    private IQueryable<ReturnRequest> LoadDetailQuery() =>
        _db.ReturnRequests
            .Include(r => r.Order)
                .ThenInclude(o => o.Shop)
            .Include(r => r.Order)
                .ThenInclude(o => o.StatusHistories)
            .Include(r => r.Buyer)
            .Include(r => r.Items)
                .ThenInclude(i => i.OrderItem)
            .Include(r => r.Evidences)
            .Include(r => r.StatusHistories);

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

    private static SellerReturnDetailDto MapDetail(
        ReturnRequest entity,
        IReadOnlyDictionary<Guid, string> changerNames) =>
        new()
        {
            ReturnRequestId = entity.ReturnRequestId,
            OrderId = entity.OrderId,
            OrderCode = entity.Order.OrderCode,
            OrderStatus = entity.Order.Status,
            ShopId = entity.Order.ShopId,
            ShopName = entity.Order.Shop.ShopName,
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
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt,
            Items = entity.Items
                .OrderBy(i => i.ReturnItemId)
                .Select(i => new SellerReturnItemDto
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
                .Select(e => new SellerReturnEvidenceDto
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
                .Select(h => new SellerReturnStatusHistoryDto
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

    private static string BuildDefaultNote(string toStatus) =>
        toStatus switch
        {
            ReturnConstants.StatusReceiving => "Seller marked returned goods as receiving",
            ReturnConstants.StatusAccepted => "Seller accepted returned goods after inspection",
            _ => $"Status updated to {toStatus}"
        };
}
