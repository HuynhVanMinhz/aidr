using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Seeding;
using AIDR.Modules.Auth.Abstractions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/dev")]
public class DevController : ControllerBase
{
    /// <summary>Ensure demo admin/seller/buyer accounts exist with a known password (dev only).</summary>
    [HttpPost("seed-demo-accounts")]
    public async Task<IActionResult> SeedDemoAccounts(
        [FromServices] AidrDbContext db,
        [FromServices] IPasswordHasher passwordHasher,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        var result = await DemoAccountsSeeder.SeedAsync(db, passwordHasher, ct);
        return Ok(new
        {
            message = "Demo accounts seeded.",
            password = result.Password,
            accounts = result.Accounts
        });
    }

    [HttpPost("seed-catalog")]
    public async Task<IActionResult> SeedCatalog(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await CatalogDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);
        var count = await db.Products.CountAsync(p => p.Status == "Approved", ct);

        return Ok(new
        {
            message = "Catalog demo seed completed.",
            approvedProductCount = count
        });
    }

    [HttpPost("seed-categories")]
    public async Task<IActionResult> SeedCategories(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await CategoryHierarchyDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);
        var total = await db.Categories.CountAsync(ct);
        var roots = await db.Categories.CountAsync(c => c.ParentId == null, ct);
        var children = total - roots;

        return Ok(new
        {
            message = "Category hierarchy demo seed completed.",
            totalCount = total,
            rootCount = roots,
            childCount = children
        });
    }

    [HttpPost("seed-seller-registrations")]
    public async Task<IActionResult> SeedSellerRegistrations(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await SellerRegistrationDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);
        var pending = await db.SellerRegistrationRequests.CountAsync(r => r.Status == "Pending", ct);
        var total = await db.SellerRegistrationRequests.CountAsync(ct);

        return Ok(new
        {
            message = "Seller registration demo seed completed.",
            pendingCount = pending,
            totalCount = total
        });
    }

    /// <summary>Seed Pending/Rejected products for Admin Product Moderation queue (dev only).</summary>
    [HttpPost("seed-pending-products")]
    public async Task<IActionResult> SeedPendingProducts(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await PendingProductsDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);
        var pending = await db.Products.CountAsync(p => p.Status == "Pending", ct);
        var rejected = await db.Products.CountAsync(p => p.Status == "Rejected", ct);

        return Ok(new
        {
            message = "Pending products demo seed completed.",
            pendingCount = pending,
            rejectedCount = rejected
        });
    }

    [HttpPost("seed-vouchers")]
    public async Task<IActionResult> SeedVouchers(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        var result = await VoucherDemoSeeder.SeedAsync(db, ct);
        return Ok(new
        {
            message = "Voucher demo seed completed.",
            vouchers = result.Vouchers
        });
    }

    /// <summary>Seed buyers + paid orders for Admin Customer Insights charts (dev only).</summary>
    [HttpPost("seed-governance-insights")]
    public async Task<IActionResult> SeedGovernanceInsights(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await GovernanceInsightsDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);

        var insightBuyers = await db.Users.CountAsync(
            u => u.Email.StartsWith("insight-buyer-"),
            ct);
        var insightOrders = await db.Orders.CountAsync(
            o => o.OrderCode.StartsWith("INS"),
            ct);

        return Ok(new
        {
            message = "Governance insights demo seed completed.",
            insightBuyerCount = insightBuyers,
            insightOrderCount = insightOrders
        });
    }

    /// <summary>Seed Delivered orders + return requests for Return & Refund flows (dev only).</summary>
    [HttpPost("seed-returns")]
    public async Task<IActionResult> SeedReturns(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await ReturnDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);

        var returnOrders = await db.Orders.CountAsync(
            o => o.OrderCode.StartsWith("RET-"),
            ct);
        var returns = await db.ReturnRequests.CountAsync(ct);
        var pending = await db.ReturnRequests.CountAsync(r => r.Status == "Pending", ct);

        return Ok(new
        {
            message = "Return & Refund demo seed completed.",
            returnOrderCount = returnOrders,
            returnRequestCount = returns,
            pendingCount = pending
        });
    }

    /// <summary>Seed wallet ledger rows for demo seller shop (dev only).</summary>
    [HttpPost("seed-wallet")]
    public async Task<IActionResult> SeedWallet(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await WalletDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);

        var shopId = DemoAccountsSeeder.ShopId;
        var wallet = await db.Wallets.AsNoTracking()
            .FirstOrDefaultAsync(w => w.ShopId == shopId, ct);
        var txCount = wallet == null
            ? 0
            : await db.WalletTransactions.CountAsync(t => t.WalletId == wallet.WalletId, ct);
        var seedCount = wallet == null
            ? 0
            : await db.WalletTransactions.CountAsync(
                t => t.WalletId == wallet.WalletId && t.Note != null && t.Note.StartsWith("WAL-SEED-"),
                ct);

        return Ok(new
        {
            message = "Wallet demo seed completed.",
            shopId,
            walletId = wallet?.WalletId,
            availableBalance = wallet?.AvailableBalance,
            transactionCount = txCount,
            seedTransactionCount = seedCount
        });
    }

    /// <summary>Seed System/Product low-stock notifications for demo seller (dev only).</summary>
    [HttpPost("seed-low-stock-notifications")]
    public async Task<IActionResult> SeedLowStockNotifications(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await LowStockNotificationDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);

        var sellerId = DemoAccountsSeeder.SellerId;
        var total = await db.Notifications.CountAsync(
            n => n.UserId == sellerId
                 && n.Type == "System"
                 && n.ReferenceType == "Product",
            ct);
        var unread = await db.Notifications.CountAsync(
            n => n.UserId == sellerId
                 && n.Type == "System"
                 && n.ReferenceType == "Product"
                 && !n.IsRead,
            ct);

        return Ok(new
        {
            message = "Low-stock notification demo seed completed.",
            sellerId,
            systemProductNotificationCount = total,
            unreadCount = unread
        });
    }

    /// <summary>Seed view history + ProductRecommendations for recommend/similar testing (dev only).</summary>
    [HttpPost("seed-recommendations")]
    public async Task<IActionResult> SeedRecommendations(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await RecommendationDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);

        var buyerId = DemoAccountsSeeder.BuyerId;
        var viewCount = await db.ViewedProductHistories.CountAsync(
            v => v.UserId == buyerId && v.SessionId == "REC-SEED", ct);
        var recCount = await db.ProductRecommendations.CountAsync(r => r.UserId == buyerId, ct);

        return Ok(new
        {
            message = "Recommendation demo seed completed.",
            buyerId,
            seededViewCount = viewCount,
            recommendationCount = recCount
        });
    }

    /// <summary>Enrich SpecsJson on demo products for NL filter / compare testing (dev only).</summary>
    [HttpPost("seed-nl-compare")]
    public async Task<IActionResult> SeedNlCompare(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await NlCompareDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);

        var enriched = await db.Products.CountAsync(
            p => p.TagsJson != null && p.TagsJson.Contains("NL-COMPARE-SEED"), ct);

        return Ok(new
        {
            message = "NL filter / compare demo seed completed.",
            enrichedProductCount = enriched,
            sampleCompareProductIds = new[]
            {
                "EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE",
                "11111111-1111-1111-1111-111111111101",
                "11111111-1111-1111-1111-111111111102"
            },
            sampleNlQueries = new[]
            {
                "Điện thoại Samsung dưới 15 triệu, sắp xếp giá tăng dần",
                "Laptop Apple từ 20 triệu, rating từ 4 sao",
                "Find Xiaomi phones under 20m sorted by popular"
            }
        });
    }
}
