using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Dev-only: seed sample system + shop vouchers so buyer apply APIs can be tested
/// before Admin/Seller voucher CRUD modules land.
/// </summary>
public static class VoucherDemoSeeder
{
    public static readonly Guid SystemVoucherId = Guid.Parse("EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE");
    public static readonly Guid ShopVoucherId = Guid.Parse("FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF");

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

        await UpsertAsync(
            db,
            SystemVoucherId,
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
            createdBy: DemoAccountsSeeder.AdminId,
            now,
            ct);

        await UpsertAsync(
            db,
            ShopVoucherId,
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
            createdBy: DemoAccountsSeeder.SellerId,
            now,
            ct);

        await db.SaveChangesAsync(ct);

        return new VoucherDemoSeedResult
        {
            Vouchers =
            [
                new VoucherDemoInfo("AIDR10", VoucherConstants.ScopeSystem, null),
                new VoucherDemoInfo("SHOP20K", VoucherConstants.ScopeShop, DemoAccountsSeeder.ShopId)
            ]
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
                StartsAt = now.AddDays(-1),
                EndsAt = now.AddMonths(6),
                IsActive = true,
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
        existing.StartsAt = now.AddDays(-1);
        existing.EndsAt = now.AddMonths(6);
        existing.IsActive = true;
        existing.UpdatedAt = now;
    }
}

public sealed class VoucherDemoSeedResult
{
    public required IReadOnlyList<VoucherDemoInfo> Vouchers { get; init; }
}

public sealed record VoucherDemoInfo(string Code, string Scope, Guid? ShopId);
