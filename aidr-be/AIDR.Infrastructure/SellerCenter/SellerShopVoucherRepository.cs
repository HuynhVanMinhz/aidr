using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.SellerCenter;

public sealed class SellerShopVoucherRepository : ISellerShopVoucherRepository
{
    private readonly AidrDbContext _db;

    public SellerShopVoucherRepository(AidrDbContext db) => _db = db;

    public async Task<(IReadOnlyList<SellerShopVoucherRecord> Items, int TotalCount, int EffectivePage, SellerShopVoucherListSummary Summary)>
        ListPagedAsync(
            Guid shopId,
            string? keyword,
            bool? isActive,
            int page,
            int pageSize,
            DateTime utcNow,
            CancellationToken cancellationToken = default)
    {
        var baseQuery = _db.Vouchers.AsNoTracking()
            .Where(v => v.Scope == VoucherConstants.ScopeShop && v.ShopId == shopId);

        var summary = new SellerShopVoucherListSummary
        {
            ActiveCount = await baseQuery.CountAsync(v => v.IsActive, cancellationToken),
            InactiveCount = await baseQuery.CountAsync(v => !v.IsActive, cancellationToken),
            ExpiredCount = await baseQuery.CountAsync(v => v.EndsAt < utcNow, cancellationToken)
        };

        var query = baseQuery;
        if (isActive is bool activeFilter)
            query = query.Where(v => v.IsActive == activeFilter);

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var like = $"%{keyword}%";
            query = query.Where(v =>
                EF.Functions.Like(v.Code, like) ||
                EF.Functions.Like(v.Name, like) ||
                (v.Description != null && EF.Functions.Like(v.Description, like)));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var totalPages = pageSize <= 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);
        var effectivePage = totalPages == 0 ? 1 : Math.Min(page, totalPages);

        var rows = await query
            .OrderByDescending(v => v.CreatedAt)
            .ThenBy(v => v.Code)
            .Skip((effectivePage - 1) * pageSize)
            .Take(pageSize)
            .Select(v => new
            {
                Voucher = v,
                ShopName = _db.Shops
                    .Where(s => s.ShopId == v.ShopId)
                    .Select(s => s.ShopName)
                    .FirstOrDefault(),
                HasRedemptions = _db.VoucherRedemptions.Any(r => r.VoucherId == v.VoucherId),
                IsReferencedByOrders = _db.Orders.Any(o => o.VoucherId == v.VoucherId)
            })
            .ToListAsync(cancellationToken);

        var items = rows
            .Select(r => Map(r.Voucher, r.ShopName, r.HasRedemptions, r.IsReferencedByOrders))
            .ToList();

        return (items, totalCount, effectivePage, summary);
    }

    public async Task<SellerShopVoucherRecord?> GetByIdForShopAsync(
        Guid shopId,
        Guid voucherId,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.Vouchers.AsNoTracking()
            .Where(v =>
                v.VoucherId == voucherId &&
                v.Scope == VoucherConstants.ScopeShop &&
                v.ShopId == shopId)
            .Select(v => new
            {
                Voucher = v,
                ShopName = _db.Shops
                    .Where(s => s.ShopId == v.ShopId)
                    .Select(s => s.ShopName)
                    .FirstOrDefault(),
                HasRedemptions = _db.VoucherRedemptions.Any(r => r.VoucherId == v.VoucherId),
                IsReferencedByOrders = _db.Orders.Any(o => o.VoucherId == v.VoucherId)
            })
            .FirstOrDefaultAsync(cancellationToken);

        return row is null
            ? null
            : Map(row.Voucher, row.ShopName, row.HasRedemptions, row.IsReferencedByOrders);
    }

    public async Task<bool> CodeExistsAsync(
        string code,
        Guid? excludeVoucherId = null,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Vouchers.AsNoTracking().Where(v => v.Code == code);
        if (excludeVoucherId is Guid id)
            query = query.Where(v => v.VoucherId != id);
        return await query.AnyAsync(cancellationToken);
    }

    public async Task<SellerShopVoucherRecord> CreateAsync(
        Guid shopId,
        string code,
        string name,
        string? description,
        string discountType,
        decimal discountValue,
        decimal? maxDiscountAmount,
        decimal minOrderAmount,
        int? usageLimit,
        int perUserLimit,
        DateTime startsAt,
        DateTime endsAt,
        bool isActive,
        Guid createdBy,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var entity = new Voucher
        {
            VoucherId = Guid.NewGuid(),
            Code = code,
            Name = name,
            Description = description,
            Scope = VoucherConstants.ScopeShop,
            ShopId = shopId,
            DiscountType = discountType,
            DiscountValue = discountValue,
            MaxDiscountAmount = maxDiscountAmount,
            MinOrderAmount = minOrderAmount,
            UsageLimit = usageLimit,
            PerUserLimit = perUserLimit,
            UsedCount = 0,
            StartsAt = startsAt,
            EndsAt = endsAt,
            IsActive = isActive,
            CreatedBy = createdBy,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.Vouchers.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        return (await GetByIdForShopAsync(shopId, entity.VoucherId, cancellationToken))!;
    }

    public async Task<SellerShopVoucherRecord> UpdateAsync(
        Guid shopId,
        Guid voucherId,
        string name,
        string? description,
        string discountType,
        decimal discountValue,
        decimal? maxDiscountAmount,
        decimal minOrderAmount,
        int? usageLimit,
        int perUserLimit,
        DateTime startsAt,
        DateTime endsAt,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.Vouchers
            .FirstOrDefaultAsync(
                v =>
                    v.VoucherId == voucherId &&
                    v.Scope == VoucherConstants.ScopeShop &&
                    v.ShopId == shopId,
                cancellationToken)
            ?? throw new NotFoundException("Shop voucher not found.");

        entity.Name = name;
        entity.Description = description;
        entity.DiscountType = discountType;
        entity.DiscountValue = discountValue;
        entity.MaxDiscountAmount = maxDiscountAmount;
        entity.MinOrderAmount = minOrderAmount;
        entity.UsageLimit = usageLimit;
        entity.PerUserLimit = perUserLimit;
        entity.StartsAt = startsAt;
        entity.EndsAt = endsAt;
        entity.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
        return (await GetByIdForShopAsync(shopId, voucherId, cancellationToken))!;
    }

    public async Task<SellerShopVoucherRecord> UpdateStatusAsync(
        Guid shopId,
        Guid voucherId,
        bool isActive,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.Vouchers
            .FirstOrDefaultAsync(
                v =>
                    v.VoucherId == voucherId &&
                    v.Scope == VoucherConstants.ScopeShop &&
                    v.ShopId == shopId,
                cancellationToken)
            ?? throw new NotFoundException("Shop voucher not found.");

        entity.IsActive = isActive;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return (await GetByIdForShopAsync(shopId, voucherId, cancellationToken))!;
    }

    public async Task DeleteAsync(Guid shopId, Guid voucherId, CancellationToken cancellationToken = default)
    {
        var entity = await _db.Vouchers
            .FirstOrDefaultAsync(
                v =>
                    v.VoucherId == voucherId &&
                    v.Scope == VoucherConstants.ScopeShop &&
                    v.ShopId == shopId,
                cancellationToken)
            ?? throw new NotFoundException("Shop voucher not found.");

        _db.Vouchers.Remove(entity);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private static SellerShopVoucherRecord Map(
        Voucher v,
        string? shopName,
        bool hasRedemptions,
        bool isReferencedByOrders) => new()
    {
        VoucherId = v.VoucherId,
        Code = v.Code,
        Name = v.Name,
        Description = v.Description,
        Scope = v.Scope,
        ShopId = v.ShopId ?? Guid.Empty,
        ShopName = shopName,
        DiscountType = v.DiscountType,
        DiscountValue = v.DiscountValue,
        MaxDiscountAmount = v.MaxDiscountAmount,
        MinOrderAmount = v.MinOrderAmount,
        UsageLimit = v.UsageLimit,
        PerUserLimit = v.PerUserLimit,
        UsedCount = v.UsedCount,
        StartsAt = v.StartsAt,
        EndsAt = v.EndsAt,
        IsActive = v.IsActive,
        CreatedBy = v.CreatedBy,
        CreatedAt = v.CreatedAt,
        UpdatedAt = v.UpdatedAt,
        HasRedemptions = hasRedemptions,
        IsReferencedByOrders = isReferencedByOrders
    };
}
