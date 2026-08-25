using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Admin;

public sealed class AdminSystemVoucherRepository : IAdminSystemVoucherRepository
{
    private readonly AidrDbContext _db;

    public AdminSystemVoucherRepository(AidrDbContext db) => _db = db;

    public async Task<(IReadOnlyList<AdminSystemVoucherRecord> Items, int TotalCount, int EffectivePage, AdminSystemVoucherListSummary Summary)>
        ListPagedAsync(
            string? keyword,
            bool? isActive,
            int page,
            int pageSize,
            DateTime utcNow,
            CancellationToken cancellationToken = default)
    {
        var baseQuery = _db.Vouchers.AsNoTracking()
            .Where(v => v.Scope == VoucherConstants.ScopeSystem);

        var summary = new AdminSystemVoucherListSummary
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
                CreatorName = _db.Users
                    .Where(u => u.UserId == v.CreatedBy)
                    .Select(u => u.FullName)
                    .FirstOrDefault(),
                HasRedemptions = _db.VoucherRedemptions.Any(r => r.VoucherId == v.VoucherId),
                IsReferencedByOrders = _db.Orders.Any(o => o.VoucherId == v.VoucherId)
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(r => Map(r.Voucher, r.CreatorName, r.HasRedemptions, r.IsReferencedByOrders))
            .ToList();

        return (items, totalCount, effectivePage, summary);
    }

    public async Task<AdminSystemVoucherRecord?> GetByIdAsync(
        Guid voucherId,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.Vouchers.AsNoTracking()
            .Where(v => v.VoucherId == voucherId && v.Scope == VoucherConstants.ScopeSystem)
            .Select(v => new
            {
                Voucher = v,
                CreatorName = _db.Users
                    .Where(u => u.UserId == v.CreatedBy)
                    .Select(u => u.FullName)
                    .FirstOrDefault(),
                HasRedemptions = _db.VoucherRedemptions.Any(r => r.VoucherId == v.VoucherId),
                IsReferencedByOrders = _db.Orders.Any(o => o.VoucherId == v.VoucherId)
            })
            .FirstOrDefaultAsync(cancellationToken);

        return row is null
            ? null
            : Map(row.Voucher, row.CreatorName, row.HasRedemptions, row.IsReferencedByOrders);
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

    public async Task<AdminSystemVoucherRecord> CreateAsync(
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
            Scope = VoucherConstants.ScopeSystem,
            ShopId = null,
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

        var creatorName = await _db.Users.AsNoTracking()
            .Where(u => u.UserId == createdBy)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync(cancellationToken);

        return Map(entity, creatorName, hasRedemptions: false, isReferencedByOrders: false);
    }

    public async Task<AdminSystemVoucherRecord> UpdateAsync(
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
                v => v.VoucherId == voucherId && v.Scope == VoucherConstants.ScopeSystem,
                cancellationToken)
            ?? throw new NotFoundException("System voucher not found.");

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
        return (await GetByIdAsync(voucherId, cancellationToken))!;
    }

    public async Task<AdminSystemVoucherRecord> UpdateStatusAsync(
        Guid voucherId,
        bool isActive,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.Vouchers
            .FirstOrDefaultAsync(
                v => v.VoucherId == voucherId && v.Scope == VoucherConstants.ScopeSystem,
                cancellationToken)
            ?? throw new NotFoundException("System voucher not found.");

        entity.IsActive = isActive;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return (await GetByIdAsync(voucherId, cancellationToken))!;
    }

    public async Task DeleteAsync(Guid voucherId, CancellationToken cancellationToken = default)
    {
        var entity = await _db.Vouchers
            .FirstOrDefaultAsync(
                v => v.VoucherId == voucherId && v.Scope == VoucherConstants.ScopeSystem,
                cancellationToken)
            ?? throw new NotFoundException("System voucher not found.");

        _db.Vouchers.Remove(entity);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private static AdminSystemVoucherRecord Map(
        Voucher v,
        string? creatorName,
        bool hasRedemptions,
        bool isReferencedByOrders) => new()
    {
        VoucherId = v.VoucherId,
        Code = v.Code,
        Name = v.Name,
        Description = v.Description,
        Scope = v.Scope,
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
        CreatedByName = creatorName,
        CreatedAt = v.CreatedAt,
        UpdatedAt = v.UpdatedAt,
        HasRedemptions = hasRedemptions,
        IsReferencedByOrders = isReferencedByOrders
    };
}
