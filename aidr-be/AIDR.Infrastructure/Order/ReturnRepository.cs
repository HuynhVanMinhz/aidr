using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Ordering;

public sealed class ReturnRepository : IReturnRepository
{
    private static readonly string[] ActiveReturnStatusValues =
        ReturnConstants.ActiveReturnStatuses.ToArray();

    private readonly AidrDbContext _db;

    public ReturnRepository(AidrDbContext db) => _db = db;

    public async Task<BuyerReturnRequestDto> CreateAsync(
        Guid buyerUserId,
        Guid orderId,
        string reason,
        string? description,
        string resolutionType,
        string? refundBankBin,
        string? refundBankName,
        string? refundAccountNumber,
        string? refundAccountName,
        IReadOnlyList<(Guid OrderItemId, int Quantity)> items,
        IReadOnlyList<(string EvidenceType, string MediaUrl, string? PublicId)> evidences,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(
                o => o.OrderId == orderId && o.BuyerUserId == buyerUserId,
                cancellationToken)
            ?? throw new NotFoundException("Order not found.");

        if (!ReturnConstants.EligibleOrderStatuses.Contains(order.Status))
        {
            throw new ConflictException(
                "Return requests are only allowed for shipping, delivered, or completed orders.");
        }

        var hasActiveReturn = await _db.ReturnRequests.AnyAsync(
            r => r.OrderId == orderId && ActiveReturnStatusValues.Contains(r.Status),
            cancellationToken);

        if (hasActiveReturn)
            throw new ConflictException("This order already has an active return request.");

        var returnItems = ResolveReturnItems(order, items);

        var now = DateTime.UtcNow;
        var fromOrderStatus = order.Status;

        var returnRequest = new ReturnRequest
        {
            ReturnRequestId = Guid.NewGuid(),
            OrderId = order.OrderId,
            BuyerUserId = buyerUserId,
            Reason = reason,
            Description = description,
            ResolutionType = resolutionType,
            RefundBankBin = refundBankBin,
            RefundBankName = refundBankName,
            RefundAccountNumber = refundAccountNumber,
            RefundAccountName = refundAccountName,
            Status = ReturnConstants.StatusPending,
            CreatedAt = now,
            UpdatedAt = now
        };

        foreach (var (orderItem, quantity) in returnItems)
        {
            returnRequest.Items.Add(new ReturnRequestItem
            {
                ReturnItemId = Guid.NewGuid(),
                ReturnRequestId = returnRequest.ReturnRequestId,
                OrderItemId = orderItem.OrderItemId,
                Quantity = quantity
            });
        }

        var sort = 0;
        foreach (var (evidenceType, mediaUrl, publicId) in evidences)
        {
            returnRequest.Evidences.Add(new ReturnEvidence
            {
                EvidenceId = Guid.NewGuid(),
                ReturnRequestId = returnRequest.ReturnRequestId,
                EvidenceType = evidenceType,
                MediaUrl = mediaUrl,
                PublicId = publicId,
                SortOrder = sort++,
                CreatedAt = now
            });
        }

        returnRequest.StatusHistories.Add(new ReturnStatusHistory
        {
            ReturnRequestId = returnRequest.ReturnRequestId,
            FromStatus = null,
            ToStatus = ReturnConstants.StatusPending,
            ChangedBy = buyerUserId,
            Note = "Buyer submitted return request",
            CreatedAt = now
        });

        order.Status = OrderConstants.StatusReturnRequested;
        order.UpdatedAt = now;
        order.StatusHistories.Add(new OrderStatusHistory
        {
            OrderId = order.OrderId,
            FromStatus = fromOrderStatus,
            ToStatus = OrderConstants.StatusReturnRequested,
            ChangedBy = buyerUserId,
            Note = "Buyer requested return / refund / exchange",
            CreatedAt = now
        });

        _db.ReturnRequests.Add(returnRequest);

        // Freeze the shop's settlement: a disputed order must not be paid out
        // just because its hold window happens to expire mid-dispute.
        var entry = await _db.SettlementEntries
            .FirstOrDefaultAsync(e => e.OrderId == order.OrderId, cancellationToken);

        if (entry is not null && SettlementConstants.PendingBalanceStatuses.Contains(entry.Status))
        {
            entry.Status = SettlementConstants.EntryStatusOnHold;
            entry.HoldReason = "Return request open";
            entry.PayoutBatchId = null;
            entry.UpdatedAt = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await LoadBuyerDtoAsync(returnRequest.ReturnRequestId, cancellationToken)
            ?? throw new AppException("Unable to load the created return request.");
    }

    public async Task<BuyerReturnRequestDto?> GetByOrderForBuyerAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default)
    {
        var returnId = await _db.ReturnRequests.AsNoTracking()
            .Where(r => r.OrderId == orderId && r.BuyerUserId == buyerUserId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => (Guid?)r.ReturnRequestId)
            .FirstOrDefaultAsync(cancellationToken);

        if (returnId is null)
            return null;

        return await LoadBuyerDtoAsync(returnId.Value, cancellationToken);
    }

    public async Task<(IReadOnlyList<BuyerReturnRequestDto> Items, int TotalCount, int EffectivePage)>
        ListForBuyerAsync(
            Guid buyerUserId,
            string? status,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default)
    {
        var query = _db.ReturnRequests.AsNoTracking()
            .Where(r => r.BuyerUserId == buyerUserId);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(r => r.Status == status);

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = pageSize <= 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);
        var effectivePage = totalPages == 0 ? 1 : Math.Min(page, totalPages);

        var ids = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((effectivePage - 1) * pageSize)
            .Take(pageSize)
            .Select(r => r.ReturnRequestId)
            .ToListAsync(cancellationToken);

        if (ids.Count == 0)
            return (Array.Empty<BuyerReturnRequestDto>(), totalCount, effectivePage);

        var entities = await _db.ReturnRequests.AsNoTracking()
            .Include(r => r.Order)
            .Include(r => r.Items)
                .ThenInclude(i => i.OrderItem)
                    .ThenInclude(oi => oi.Product)
                        .ThenInclude(p => p.Images)
            .Include(r => r.Evidences)
            .Include(r => r.StatusHistories)
            .Where(r => ids.Contains(r.ReturnRequestId))
            .ToListAsync(cancellationToken);

        var byId = entities.ToDictionary(e => e.ReturnRequestId);
        var items = ids
            .Where(id => byId.ContainsKey(id))
            .Select(id => MapBuyer(byId[id]))
            .ToList();

        return (items, totalCount, effectivePage);
    }

    public Task<BuyerReturnRequestDto?> GetByIdForBuyerAsync(
        Guid buyerUserId,
        Guid returnRequestId,
        CancellationToken cancellationToken = default) =>
        LoadBuyerDtoForOwnerAsync(returnRequestId, buyerUserId, cancellationToken);

    private static List<(OrderItem OrderItem, int Quantity)> ResolveReturnItems(
        Order order,
        IReadOnlyList<(Guid OrderItemId, int Quantity)> items)
    {
        if (items.Count == 0)
        {
            return order.Items
                .Select(i => (i, i.Quantity))
                .ToList();
        }

        var result = new List<(OrderItem, int)>(items.Count);
        foreach (var (orderItemId, quantity) in items)
        {
            var orderItem = order.Items.FirstOrDefault(i => i.OrderItemId == orderItemId)
                ?? throw new AppException("One or more order items do not belong to this order.");

            if (quantity > orderItem.Quantity)
            {
                throw new AppException(
                    $"Return quantity for '{orderItem.ProductNameSnapshot}' exceeds the ordered quantity.");
            }

            result.Add((orderItem, quantity));
        }

        return result;
    }

    private async Task<BuyerReturnRequestDto?> LoadBuyerDtoAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken)
    {
        var entity = await _db.ReturnRequests.AsNoTracking()
            .Include(r => r.Order)
            .Include(r => r.Items)
                .ThenInclude(i => i.OrderItem)
                    .ThenInclude(oi => oi.Product)
                        .ThenInclude(p => p.Images)
            .Include(r => r.Evidences)
            .Include(r => r.StatusHistories)
            .FirstOrDefaultAsync(r => r.ReturnRequestId == returnRequestId, cancellationToken);

        return entity is null ? null : MapBuyer(entity);
    }

    private async Task<BuyerReturnRequestDto?> LoadBuyerDtoForOwnerAsync(
        Guid returnRequestId,
        Guid buyerUserId,
        CancellationToken cancellationToken)
    {
        var entity = await _db.ReturnRequests.AsNoTracking()
            .Include(r => r.Order)
            .Include(r => r.Items)
                .ThenInclude(i => i.OrderItem)
                    .ThenInclude(oi => oi.Product)
                        .ThenInclude(p => p.Images)
            .Include(r => r.Evidences)
            .Include(r => r.StatusHistories)
            .FirstOrDefaultAsync(
                r => r.ReturnRequestId == returnRequestId && r.BuyerUserId == buyerUserId,
                cancellationToken);

        return entity is null ? null : MapBuyer(entity);
    }

    private static BuyerReturnRequestDto MapBuyer(ReturnRequest entity)
    {
        return new BuyerReturnRequestDto
        {
            ReturnRequestId = entity.ReturnRequestId,
            OrderId = entity.OrderId,
            OrderCode = entity.Order.OrderCode,
            Reason = entity.Reason,
            Description = entity.Description,
            ResolutionType = entity.ResolutionType,
            Status = entity.Status,
            RefundAmount = entity.RefundAmount,
            AdminNote = entity.AdminNote,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt,
            Items = entity.Items
                .OrderBy(i => i.ReturnItemId)
                .Select(i => new BuyerReturnItemDto
                {
                    ReturnItemId = i.ReturnItemId,
                    OrderItemId = i.OrderItemId,
                    ProductId = i.OrderItem.ProductId,
                    ProductName = i.OrderItem.ProductNameSnapshot,
                    Sku = i.OrderItem.SkuSnapshot,
                    ImageUrl = i.OrderItem.Product.Images
                        .OrderByDescending(img => img.IsPrimary)
                        .ThenBy(img => img.SortOrder)
                        .Select(img => img.ImageUrl)
                        .FirstOrDefault(),
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
                .Select(e => new BuyerReturnEvidenceDto
                {
                    EvidenceId = e.EvidenceId,
                    EvidenceType = e.EvidenceType,
                    MediaUrl = e.MediaUrl,
                    PublicId = e.PublicId,
                    SortOrder = e.SortOrder
                })
                .ToList(),
            StatusHistories = entity.StatusHistories
                .OrderBy(h => h.CreatedAt)
                .ThenBy(h => h.HistoryId)
                .Select(h => new BuyerReturnStatusHistoryDto
                {
                    FromStatus = h.FromStatus,
                    ToStatus = h.ToStatus,
                    Note = h.Note,
                    CreatedAt = h.CreatedAt
                })
                .ToList()
        };
    }

    public async Task<IReadOnlyList<Guid>> ListAdminUserIdsAsync(CancellationToken cancellationToken = default)
    {
        return await _db.UserRoles.AsNoTracking()
            .Where(ur => ur.Role.RoleCode == RoleCodes.Admin)
            .Select(ur => ur.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);
    }
}
