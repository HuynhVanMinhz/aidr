using AIDR.Infrastructure.Auth;
using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Auth.Abstractions;
using AIDR.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Dev-only: ensure demo admin/seller/buyer accounts exist with a known password.
/// </summary>
public static class DemoAccountsSeeder
{
    public const string DemoPassword = "Aidr@123";

    public static readonly Guid AdminId = Guid.Parse("AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA");
    public static readonly Guid SellerId = Guid.Parse("BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB");
    public static readonly Guid BuyerId = Guid.Parse("CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC");
    public static readonly Guid ShopId = Guid.Parse("DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD");

    public static async Task<DemoAccountsSeedResult> SeedAsync(
        AidrDbContext db,
        IPasswordHasher passwordHasher,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var passwordHash = passwordHasher.Hash(DemoPassword);

        var roleAdmin = await EnsureRoleAsync(db, "ADMIN", "Admin", "System administrator", ct);
        var roleSeller = await EnsureRoleAsync(db, "SELLER", "Seller", "Shop owner", ct);
        var roleBuyer = await EnsureRoleAsync(db, "BUYER", "Buyer", "Customer", ct);

        await UpsertUserAsync(
            db,
            AdminId,
            "admin@aidr.local",
            "System Admin",
            "0900000001",
            passwordHash,
            now,
            ct);
        await UpsertUserAsync(
            db,
            SellerId,
            "seller@aidr.local",
            "Alex Seller",
            "0900000002",
            passwordHash,
            now,
            ct);
        await UpsertUserAsync(
            db,
            BuyerId,
            "buyer@aidr.local",
            "Jamie Buyer",
            "0900000003",
            passwordHash,
            now,
            ct);

        await EnsureUserRoleAsync(db, AdminId, roleAdmin.RoleId, now, ct);
        await EnsureUserRoleAsync(db, SellerId, roleSeller.RoleId, now, ct);
        await EnsureUserRoleAsync(db, SellerId, roleBuyer.RoleId, now, ct);
        await EnsureUserRoleAsync(db, BuyerId, roleBuyer.RoleId, now, ct);

        await EnsureSellerShopAsync(db, now, ct);
        await db.SaveChangesAsync(ct);

        return new DemoAccountsSeedResult
        {
            Password = DemoPassword,
            Accounts =
            [
                new DemoAccountInfo("admin@aidr.local", "ADMIN"),
                new DemoAccountInfo("seller@aidr.local", "SELLER"),
                new DemoAccountInfo("buyer@aidr.local", "BUYER")
            ]
        };
    }

    private static async Task<Role> EnsureRoleAsync(
        AidrDbContext db,
        string code,
        string name,
        string description,
        CancellationToken ct)
    {
        var role = await db.Roles.FirstOrDefaultAsync(r => r.RoleCode == code, ct);
        if (role is not null)
            return role;

        role = new Role
        {
            RoleCode = code,
            RoleName = name,
            Description = description,
            CreatedAt = DateTime.UtcNow
        };
        db.Roles.Add(role);
        await db.SaveChangesAsync(ct);
        return role;
    }

    private static async Task UpsertUserAsync(
        AidrDbContext db,
        Guid userId,
        string email,
        string fullName,
        string phone,
        string passwordHash,
        DateTime now,
        CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.UserId == userId || u.Email == email, ct);
        if (user is null)
        {
            db.Users.Add(new User
            {
                UserId = userId,
                Email = email,
                EmailConfirmed = true,
                PasswordHash = passwordHash,
                FullName = fullName,
                Phone = phone,
                Status = "Active",
                CreatedAt = now,
                UpdatedAt = now
            });
            return;
        }

        user.Email = email;
        user.EmailConfirmed = true;
        user.PasswordHash = passwordHash;
        user.FullName = fullName;
        user.Phone = phone;
        user.Status = "Active";
        user.FailedLoginCount = 0;
        user.LockoutUntil = null;
        user.UpdatedAt = now;
    }

    private static async Task EnsureUserRoleAsync(
        AidrDbContext db,
        Guid userId,
        int roleId,
        DateTime now,
        CancellationToken ct)
    {
        var exists = await db.UserRoles.AnyAsync(ur => ur.UserId == userId && ur.RoleId == roleId, ct);
        if (exists)
            return;

        db.UserRoles.Add(new UserRole
        {
            UserId = userId,
            RoleId = roleId,
            AssignedAt = now
        });
    }

    private static async Task EnsureSellerShopAsync(AidrDbContext db, DateTime now, CancellationToken ct)
    {
        var shop = await db.Shops.FirstOrDefaultAsync(s => s.OwnerUserId == SellerId, ct)
            ?? await db.Shops.FirstOrDefaultAsync(s => s.ShopId == ShopId, ct);

        if (shop is null)
        {
            shop = new Shop
            {
                ShopId = ShopId,
                OwnerUserId = SellerId,
                ShopName = "TechZone Official",
                Slug = "techzone-official",
                Tagline = "Authentic phones, laptops and gadgets",
                ShortDescription = "Authorized electronics retailer for smartphones, laptops, audio and accessories.",
                CostingMethod = AdminConstants.ShopCostingMethodFifo,
                IsVerified = true,
                VerifiedAt = now,
                Status = AdminConstants.ShopStatusActive,
                CreatedAt = now,
                UpdatedAt = now
            };
            db.Shops.Add(shop);
        }
        else
        {
            if (shop.OwnerUserId != SellerId)
            {
                var ownerTaken = await db.Shops.AnyAsync(
                    s => s.OwnerUserId == SellerId && s.ShopId != shop.ShopId,
                    ct);
                if (!ownerTaken)
                    shop.OwnerUserId = SellerId;
            }

            shop.Status = AdminConstants.ShopStatusActive;
            shop.IsVerified = true;
            shop.VerifiedAt ??= now;
            shop.UpdatedAt = now;
        }

        var walletExists = await db.Wallets.AnyAsync(w => w.ShopId == shop.ShopId, ct);
        if (!walletExists)
        {
            db.Wallets.Add(new Wallet
            {
                WalletId = Guid.NewGuid(),
                ShopId = shop.ShopId,
                AvailableBalance = 0,
                PendingBalance = 0,
                Currency = AdminConstants.WalletCurrencyVnd,
                UpdatedAt = now
            });
        }
    }
}

public sealed class DemoAccountsSeedResult
{
    public string Password { get; init; } = null!;
    public IReadOnlyList<DemoAccountInfo> Accounts { get; init; } = Array.Empty<DemoAccountInfo>();
}

public sealed record DemoAccountInfo(string Email, string Role);
