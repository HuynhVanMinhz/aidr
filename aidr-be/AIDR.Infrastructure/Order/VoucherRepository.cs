using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Ordering;

public sealed class VoucherRepository : IVoucherRepository
{
    private readonly AidrDbContext _db;

    public VoucherRepository(AidrDbContext db) => _db = db;

    public async Task<CartPricingContext> GetCartPricingContextAsync(
        Guid buyerUserId,
        IReadOnlyCollection<Guid>? cartItemIds,
        CancellationToken cancellationToken = default)
    {
        var cart = await _db.Carts
            .AsNoTracking()
            .Include(c => c.Items)
                .ThenInclude(i => i.Product)
                    .ThenInclude(p => p.Shop)
            .FirstOrDefaultAsync(c => c.UserId == buyerUserId, cancellationToken);

        if (cart is null || cart.Items.Count == 0)
        {
            return new CartPricingContext
            {
                ShopSubtotals = Array.Empty<CartShopSubtotal>(),
                GrandSubtotal = 0m,
                Currency = "VND"
            };
        }

        IEnumerable<CartItem> items = cart.Items;
        if (cartItemIds is { Count: > 0 })
        {
            var idSet = cartItemIds.ToHashSet();
            items = cart.Items.Where(i => idSet.Contains(i.CartItemId));
        }

        var shopGroups = items
            .Where(i => i.Product is not null)
            .GroupBy(i => i.Product.ShopId)
            .Select(g =>
            {
                var shop = g.First().Product.Shop;
                var subtotal = decimal.Round(
                    g.Sum(i =>
                    {
                        var unit = i.UnitPriceSnapshot
                            ?? i.Product.SalePrice
                            ?? i.Product.BasePrice;
                        return unit * i.Quantity;
                    }),
                    2,
                    MidpointRounding.AwayFromZero);
                var currency = g.First().Product.Currency;

                return new CartShopSubtotal
                {
                    ShopId = shop.ShopId,
                    ShopName = shop.ShopName,
                    Subtotal = subtotal,
                    Currency = currency
                };
            })
            .OrderByDescending(s => s.Subtotal)
            .ToList();

        return new CartPricingContext
        {
            ShopSubtotals = shopGroups,
            GrandSubtotal = decimal.Round(shopGroups.Sum(s => s.Subtotal), 2, MidpointRounding.AwayFromZero),
            Currency = shopGroups.FirstOrDefault()?.Currency ?? "VND"
        };
    }

    public async Task<(IReadOnlyList<VoucherRecord> Items, int TotalCount)> ListCandidateVouchersAsync(
        IReadOnlyCollection<Guid> cartShopIds,
        string? scope,
        Guid? shopId,
        DateTime utcNow,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Vouchers.AsNoTracking()
            .Include(v => v.Shop)
            .Where(v => v.IsActive && v.StartsAt <= utcNow && v.EndsAt >= utcNow);

        if (!string.IsNullOrWhiteSpace(scope))
            query = query.Where(v => v.Scope == scope);

        if (shopId is Guid filterShopId && filterShopId != Guid.Empty)
        {
            query = query.Where(v =>
                v.Scope == VoucherConstants.ScopeSystem ||
                (v.Scope == VoucherConstants.ScopeShop && v.ShopId == filterShopId));
        }
        else if (cartShopIds.Count > 0)
        {
            query = query.Where(v =>
                v.Scope == VoucherConstants.ScopeSystem ||
                (v.Scope == VoucherConstants.ScopeShop && v.ShopId != null && cartShopIds.Contains(v.ShopId.Value)));
        }
        else
        {
            // Empty cart: still show active system vouchers (marked ineligible by service).
            query = query.Where(v => v.Scope == VoucherConstants.ScopeSystem);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(v => v.EndsAt)
            .ThenBy(v => v.Code)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (rows.Select(MapRecord).ToList(), totalCount);
    }

    public async Task<VoucherRecord?> FindVoucherAsync(
        Guid? voucherId,
        string? code,
        CancellationToken cancellationToken = default)
    {
        IQueryable<Voucher> query = _db.Vouchers.AsNoTracking().Include(v => v.Shop);

        if (voucherId is Guid id && id != Guid.Empty)
            query = query.Where(v => v.VoucherId == id);
        else if (!string.IsNullOrWhiteSpace(code))
        {
            var normalized = code.Trim().ToUpperInvariant();
            query = query.Where(v => v.Code.ToUpper() == normalized);
        }
        else
            return null;

        var entity = await query.FirstOrDefaultAsync(cancellationToken);
        return entity is null ? null : MapRecord(entity);
    }

    public async Task<int> CountUserRedemptionsAsync(
        Guid voucherId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return await _db.VoucherRedemptions.AsNoTracking()
            .CountAsync(r => r.VoucherId == voucherId && r.UserId == userId, cancellationToken);
    }

    public async Task<IReadOnlyDictionary<Guid, int>> CountUserRedemptionsAsync(
        IReadOnlyCollection<Guid> voucherIds,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        if (voucherIds.Count == 0)
            return new Dictionary<Guid, int>();

        var rows = await _db.VoucherRedemptions.AsNoTracking()
            .Where(r => r.UserId == userId && voucherIds.Contains(r.VoucherId))
            .GroupBy(r => r.VoucherId)
            .Select(g => new { VoucherId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(x => x.VoucherId, x => x.Count);
    }

    private static VoucherRecord MapRecord(Voucher v) => new()
    {
        VoucherId = v.VoucherId,
        Code = v.Code,
        Name = v.Name,
        Description = v.Description,
        Scope = v.Scope,
        ShopId = v.ShopId,
        ShopName = v.Shop?.ShopName,
        DiscountType = v.DiscountType,
        DiscountValue = v.DiscountValue,
        MaxDiscountAmount = v.MaxDiscountAmount,
        MinOrderAmount = v.MinOrderAmount,
        UsageLimit = v.UsageLimit,
        PerUserLimit = v.PerUserLimit,
        UsedCount = v.UsedCount,
        StartsAt = v.StartsAt,
        EndsAt = v.EndsAt,
        IsActive = v.IsActive
    };
}
