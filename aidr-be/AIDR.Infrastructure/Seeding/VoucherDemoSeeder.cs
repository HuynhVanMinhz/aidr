using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Dev-only: seed sample system + shop vouchers for buyer apply, admin CRUD, and seller CRUD.
/// </summary>
public static class VoucherDemoSeeder
{
    public static readonly Guid SystemPercentId = Guid.Parse("EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE");
    public static readonly Guid SystemFixedId = Guid.Parse("EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEE01");
    public static readonly Guid SystemInactiveId = Guid.Parse("EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEE02");
    public static readonly Guid ShopFixedId = Guid.Parse("FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF");
    public static readonly Guid ShopPercentId = Guid.Parse("FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFF01");
    public static readonly Guid ShopExpiredId = Guid.Parse("FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFF02");

    // Back-compat aliases used by older call sites / docs.
    public static readonly Guid SystemVoucherId = SystemPercentId;
    public static readonly Guid ShopVoucherId = ShopFixedId;

    public static async Task<VoucherDemoSeedResult> SeedAsync(
        AidrDbContext db,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var adminExists = await db.Users.AnyAsync(u => u.UserId == DemoAccountsSeeder.AdminId, ct);
        if (!adminExists)
            throw new InvalidOperationException("Seed demo accounts before seeding vouchers.");

        var shopExists = await db.Shops.AnyAsync(s => s.ShopId == DemoAccountsSeeder.ShopId, ct);
        if (!shopExists)
            throw new InvalidOperationException("Demo shop is missing. Seed demo accounts first.");

        var seeds = new List<(Guid Id, string Code, string Scope, Guid? ShopId)>
        {
            // System — Admin list + buyer apply
            (SystemPercentId, "AIDR10", VoucherConstants.ScopeSystem, null),
            (SystemFixedId, "AIDR50K", VoucherConstants.ScopeSystem, null),
            (SystemInactiveId, "AIDR_OFF", VoucherConstants.ScopeSystem, null),
            // Shop — Seller list + buyer apply on demo shop cart
            (ShopFixedId, "SHOP20K", VoucherConstants.ScopeShop, DemoAccountsSeeder.ShopId),
            (ShopPercentId, "SHOP15", VoucherConstants.ScopeShop, DemoAccountsSeeder.ShopId),
            (ShopExpiredId, "SHOP_OLD", VoucherConstants.ScopeShop, DemoAccountsSeeder.ShopId),
        };

        await UpsertAsync(
            db,
            SystemPercentId,
            code: "AIDR10",
            name: "AIDR Welcome 10%",
            description: "System-wide 10% off (max 50,000 VND). Min order 100,000 VND.",
            scope: VoucherConstants.ScopeSystem,
            shopId: null,
            discountType: VoucherConstants.DiscountTypePercent,
            discountValue: 10m,
            maxDiscountAmount: 50_000m,
            minOrderAmount: 100_000m,
            usageLimit: 1000,
            perUserLimit: 3,
            startsAt: now.AddDays(-1),
            endsAt: now.AddMonths(6),
            isActive: true,
            createdBy: DemoAccountsSeeder.AdminId,
            now,
            ct);

        await UpsertAsync(
            db,
            SystemFixedId,
            code: "AIDR50K",
            name: "AIDR Flat 50K",
            description: "System-wide 50,000 VND off. Min order 200,000 VND.",
            scope: VoucherConstants.ScopeSystem,
            shopId: null,
            discountType: VoucherConstants.DiscountTypeFixedAmount,
            discountValue: 50_000m,
            maxDiscountAmount: null,
            minOrderAmount: 200_000m,
            usageLimit: 200,
            perUserLimit: 1,
            startsAt: now.AddDays(-1),
            endsAt: now.AddMonths(3),
            isActive: true,
            createdBy: DemoAccountsSeeder.AdminId,
            now,
            ct);

        await UpsertAsync(
            db,
            SystemInactiveId,
            code: "AIDR_OFF",
            name: "AIDR Disabled (test)",
            description: "Inactive system voucher — use to test activate/disable.",
            scope: VoucherConstants.ScopeSystem,
            shopId: null,
            discountType: VoucherConstants.DiscountTypePercent,
            discountValue: 5m,
            maxDiscountAmount: 20_000m,
            minOrderAmount: 0m,
            usageLimit: 100,
            perUserLimit: 1,
            startsAt: now.AddDays(-1),
            endsAt: now.AddMonths(6),
            isActive: false,
            createdBy: DemoAccountsSeeder.AdminId,
            now,
            ct);

        await UpsertAsync(
            db,
            ShopFixedId,
            code: "SHOP20K",
            name: "Shop Flat 20K",
            description: "Demo shop voucher: 20,000 VND off. Min order 50,000 VND.",
            scope: VoucherConstants.ScopeShop,
            shopId: DemoAccountsSeeder.ShopId,
            discountType: VoucherConstants.DiscountTypeFixedAmount,
            discountValue: 20_000m,
            maxDiscountAmount: null,
            minOrderAmount: 50_000m,
            usageLimit: 500,
            perUserLimit: 5,
            startsAt: now.AddDays(-1),
            endsAt: now.AddMonths(6),
            isActive: true,
            createdBy: DemoAccountsSeeder.SellerId,
            now,
            ct);

        await UpsertAsync(
            db,
            ShopPercentId,
            code: "SHOP15",
            name: "Shop 15% Off",
            description: "Demo shop 15% off (max 30,000 VND). Min order 80,000 VND.",
            scope: VoucherConstants.ScopeShop,
            shopId: DemoAccountsSeeder.ShopId,
            discountType: VoucherConstants.DiscountTypePercent,
            discountValue: 15m,
            maxDiscountAmount: 30_000m,
            minOrderAmount: 80_000m,
            usageLimit: 300,
            perUserLimit: 2,
            startsAt: now.AddDays(-1),
            endsAt: now.AddMonths(6),
            isActive: true,
            createdBy: DemoAccountsSeeder.SellerId,
            now,
            ct);

        await UpsertAsync(
            db,
            ShopExpiredId,
            code: "SHOP_OLD",
            name: "Shop Expired (test)",
            description: "Expired shop voucher — appears in Expired KPI, not eligible for apply.",
            scope: VoucherConstants.ScopeShop,
            shopId: DemoAccountsSeeder.ShopId,
            discountType: VoucherConstants.DiscountTypeFixedAmount,
            discountValue: 10_000m,
            maxDiscountAmount: null,
            minOrderAmount: 0m,
            usageLimit: 50,
            perUserLimit: 1,
            startsAt: now.AddMonths(-3),
            endsAt: now.AddDays(-7),
            isActive: true,
            createdBy: DemoAccountsSeeder.SellerId,
            now,
            ct);

        await db.SaveChangesAsync(ct);

        return new VoucherDemoSeedResult
        {
            Vouchers = seeds
                .Select(s => new VoucherDemoInfo(s.Code, s.Scope, s.ShopId))
                .ToList()
        };
    }

    private static async Task UpsertAsync(
        AidrDbContext db,
        Guid voucherId,
        string code,
        string name,
        string description,
        string scope,
        Guid? shopId,
        string discountType,
        decimal discountValue,
        decimal? maxDiscountAmount,
        decimal minOrderAmount,
        int usageLimit,
        int perUserLimit,
        DateTime startsAt,
        DateTime endsAt,
        bool isActive,
        Guid createdBy,
        DateTime now,
        CancellationToken ct)
    {
        var existing = await db.Vouchers.FirstOrDefaultAsync(v => v.VoucherId == voucherId, ct);
        if (existing is null)
        {
            existing = await db.Vouchers.FirstOrDefaultAsync(v => v.Code == code, ct);
        }

        if (existing is null)
        {
            db.Vouchers.Add(new Voucher
            {
                VoucherId = voucherId,
                Code = code,
                Name = name,
                Description = description,
                Scope = scope,
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
            });
            return;
        }

        existing.Code = code;
        existing.Name = name;
        existing.Description = description;
        existing.Scope = scope;
        existing.ShopId = shopId;
        existing.DiscountType = discountType;
        existing.DiscountValue = discountValue;
        existing.MaxDiscountAmount = maxDiscountAmount;
        existing.MinOrderAmount = minOrderAmount;
        existing.UsageLimit = usageLimit;
        existing.PerUserLimit = perUserLimit;
        existing.StartsAt = startsAt;
        existing.EndsAt = endsAt;
        existing.IsActive = isActive;
        existing.UpdatedAt = now;
    }
}

public sealed class VoucherDemoSeedResult
{
    public required IReadOnlyList<VoucherDemoInfo> Vouchers { get; init; }
}

public sealed record VoucherDemoInfo(string Code, string Scope, Guid? ShopId);
