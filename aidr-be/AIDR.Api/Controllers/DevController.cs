using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Seeding;
using AIDR.Modules.Auth.Abstractions;
using AIDR.Modules.Shipping.Abstractions;
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

    /// <summary>
    /// Seed a diverse Approved catalog across leaf categories (phones/laptops/accessories/…)
    /// and remap known demo SKUs onto leaf filters (dev only).
    /// Prerequisites: seed-demo-accounts + seed-categories (or seed-electronics-refresh).
    /// Follow with seed-inventory-lots for checkout stock.
    /// </summary>
    [HttpPost("seed-catalog-rich")]
    public async Task<IActionResult> SeedCatalogRich(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await CatalogRichSeeder.SeedAsync(db, env.ContentRootPath, ct);

        var approvedProducts = await db.Products.CountAsync(p => p.Status == "Approved", ct);
        var richTagged = await db.Products.CountAsync(
            p => p.Status == "Approved" && p.TagsJson != null && p.TagsJson.Contains("RICH"),
            ct);

        return Ok(new
        {
            message = "Rich catalog seed completed. Run POST /api/dev/seed-inventory-lots next.",
            approvedProductCount = approvedProducts,
            richProductCount = richTagged
        });
    }

    /// <summary>Normalize shops/categories/products for electronics storefront + mock image URLs (dev only).</summary>
    [HttpPost("seed-electronics-refresh")]
    public async Task<IActionResult> SeedElectronicsRefresh(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await ElectronicsCatalogRefreshSeeder.SeedAsync(db, env.ContentRootPath, ct);

        var activeCategories = await db.Categories.CountAsync(c => c.IsActive, ct);
        var approvedProducts = await db.Products.CountAsync(p => p.Status == "Approved", ct);
        var shops = await db.Shops.CountAsync(s => s.Status == "Active", ct);

        return Ok(new
        {
            message = "Electronics catalog refresh completed. Prefer POST /api/dev/seed-catalog-images for theme image URLs.",
            activeCategoryCount = activeCategories,
            approvedProductCount = approvedProducts,
            activeShopCount = shops
        });
    }

    /// <summary>Map category/product images to local /theme/images assets (dev only).</summary>
    [HttpPost("seed-catalog-images")]
    public async Task<IActionResult> SeedCatalogImages(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await CatalogImagesSeeder.SeedAsync(db, env.ContentRootPath, ct);

        var categories = await db.Categories.CountAsync(c => c.ImageUrl != null && c.ImageUrl.StartsWith("/theme/"), ct);
        var productImages = await db.ProductImages.CountAsync(i => i.ImageUrl.StartsWith("/theme/"), ct);

        return Ok(new
        {
            message = "Catalog images mapped to /theme/images assets.",
            categoryImageCount = categories,
            productImageCount = productImages
        });
    }

    /// <summary>Normalize users/shops/categories/products/reviews/registrations text to English (dev only).</summary>
    [HttpPost("seed-english-refresh")]
    public async Task<IActionResult> SeedEnglishRefresh(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await EnglishDbRefreshSeeder.SeedAsync(db, env.ContentRootPath, ct);

        return Ok(new
        {
            message = "English DB refresh completed."
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

    /// <summary>
    /// Seed paid orders and buyers for AI analytics briefs on admin/seller dashboards (dev only).
    /// Prerequisites: demo accounts and catalog from seed-demo-accounts / seed-pending-products.
    /// </summary>
    [HttpPost("seed-ai-analytics")]
    public async Task<IActionResult> SeedAiAnalytics(
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
            message = "AI analytics demo seed completed. Try GET /api/admin/ai/analytics-brief or /api/seller/ai/analytics-brief.",
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

    /// <summary>Apply price-alert schema and seed demo history/alerts (dev only).</summary>
    [HttpPost("seed-price-alerts")]
    public async Task<IActionResult> SeedPriceAlerts(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await PriceAlertDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);

        var alertCount = await db.ProductPriceAlerts.CountAsync(a => a.IsActive, ct);
        var historyCount = await db.ProductPriceHistories.CountAsync(
            h => h.Reason == "SEED-PRICE-HISTORY",
            ct);

        return Ok(new
        {
            message = "Price alert demo seed completed.",
            activeAlerts = alertCount,
            seededHistoryRows = historyCount
        });
    }

    /// <summary>Apply review-digest schema and seed demo reviews (dev only).</summary>
    [HttpPost("seed-review-digest")]
    public async Task<IActionResult> SeedReviewDigest(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await ReviewDigestDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);

        var reviewCount = await db.ProductReviews.CountAsync(
            r => r.Title != null && r.Title.StartsWith("REV-DIGEST-SEED:"),
            ct);
        var snapshotCount = await db.ProductReviewDigestSnapshots.CountAsync(ct);

        return Ok(new
        {
            message = "Review digest demo seed completed.",
            seededReviews = reviewCount,
            snapshotCount
        });
    }

    /// <summary>Seed accessory bundle + compatibility demo products (dev only).</summary>
    [HttpPost("seed-bundle-demo")]
    public async Task<IActionResult> SeedBundleDemo(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await BundleDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);

        var bundleProducts = await db.Products.CountAsync(
            p => p.TagsJson != null && p.TagsJson.Contains("BUNDLE-DEMO"),
            ct);
        var compatProducts = await db.Products.CountAsync(
            p => p.TagsJson != null && p.TagsJson.Contains("COMPAT-DEMO"),
            ct);

        return Ok(new
        {
            message = "Bundle and compatibility demo seed completed.",
            bundleProducts,
            compatProducts
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

    /// <summary>Seed storefront product reviews + sync AvgRating/ReviewCount (dev only).</summary>
    [HttpPost("seed-product-reviews")]
    public async Task<IActionResult> SeedProductReviews(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await ProductReviewsDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);

        var airPodsId = Guid.Parse("11111111-1111-1111-1111-111111111106");
        var airPods = await db.Products.AsNoTracking()
            .Where(p => p.ProductId == airPodsId)
            .Select(p => new { p.Name, p.ReviewCount, p.AvgRating })
            .FirstOrDefaultAsync(ct);
        var airPodsVisible = await db.ProductReviews.CountAsync(
            r => r.ProductId == airPodsId && r.IsVisible,
            ct);

        return Ok(new
        {
            message = "Product reviews demo seed completed.",
            airPodsProduct = airPods,
            airPodsVisibleReviewCount = airPodsVisible
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

    /// <summary>Seed sample AiConversations / AiMessages for shopping assistant testing (dev only).</summary>
    [HttpPost("seed-ai-assistant")]
    public async Task<IActionResult> SeedAiAssistant(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await AiAssistantDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);

        var buyerId = DemoAccountsSeeder.BuyerId;
        var conversationId = Guid.Parse("AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAA56");
        var conversationCount = await db.AiConversations.CountAsync(
            c => c.UserId == buyerId && c.Channel == "ShoppingAssistant", ct);
        var messageCount = await db.AiMessages.CountAsync(m => m.ConversationId == conversationId, ct);

        return Ok(new
        {
            message = "Shopping assistant demo seed completed.",
            buyerId,
            conversationId,
            conversationCount,
            messageCount,
            sampleChatMessages = new[]
            {
                "How do returns and refunds work?",
                "Recommend a Samsung phone for me",
                "What vouchers can I use at checkout?"
            }
        });
    }

    /// <summary>Seed orders at every stage of the carrier pipeline (dev only).</summary>
    [HttpPost("seed-shipping")]
    public async Task<IActionResult> SeedShipping(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await ShippingDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);

        var shipments = await db.Shipments.CountAsync(ct);
        var awaitingDispatch = await db.Orders.CountAsync(
            o => o.Status == "Paid" && !db.Shipments.Any(s => s.OrderId == o.OrderId),
            ct);

        return Ok(new
        {
            message = "Shipping demo seed completed. The sweep books these with GHN on its next tick.",
            shipmentCount = shipments,
            ordersAwaitingDispatch = awaitingDispatch,
            orderCodes = new[] { "SHIP-GHN-OK", "SHIP-GHN-FAIL" }
        });
    }

    /// <summary>Seed tables not covered by other demo scripts (dev only).</summary>
    [HttpPost("seed-table-coverage")]
    public async Task<IActionResult> SeedTableCoverage(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await TableCoverageDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);
        await DataIntegritySeeder.ReconcileAsync(db, env.ContentRootPath, ct);
        var report = await DataIntegritySeeder.ValidateAsync(db, env.ContentRootPath, ct);

        return Ok(new
        {
            message = "Table coverage seed completed.",
            isHealthy = report.IsHealthy,
            issueCount = report.IssueCount,
            tableCounts = report.TableCounts
        });
    }

    /// <summary>Backfill opening InventoryLots for products missing lot coverage (dev only).</summary>
    [HttpPost("seed-inventory-lots")]
    public async Task<IActionResult> SeedInventoryLots(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await InventoryLotsDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);

        var report = await DataIntegritySeeder.ValidateAsync(db, env.ContentRootPath, ct);
        var gaps = report.Issues.Count(i => i.Issue == "StockLotMismatch");

        return Ok(new
        {
            message = "Inventory lots backfill completed.",
            stockLotMismatchCount = gaps,
            isHealthy = report.IsHealthy,
            issueCount = report.IssueCount
        });
    }

    /// <summary>
    /// Turn demo products into variant products — applies the variant schema, builds the
    /// option matrix, and gives each configuration its own price and inventory lot (dev only).
    /// </summary>
    [HttpPost("seed-product-variants")]
    public async Task<IActionResult> SeedProductVariants(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        var log = await ProductVariantsDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);
        var report = await DataIntegritySeeder.ValidateAsync(db, env.ContentRootPath, ct);

        return Ok(new
        {
            message = "Product variants seed completed.",
            products = log,
            variantCount = await db.ProductVariants.CountAsync(ct),
            isHealthy = report.IsHealthy,
            issueCount = report.IssueCount
        });
    }

    /// <summary>Re-sync denormalized counters and fix common seed drift (dev only).</summary>
    [HttpPost("seed-reconcile-data")]
    public async Task<IActionResult> SeedReconcileData(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await DataIntegritySeeder.ReconcileAsync(db, env.ContentRootPath, ct);
        var report = await DataIntegritySeeder.ValidateAsync(db, env.ContentRootPath, ct);

        return Ok(new
        {
            message = "Data reconcile completed.",
            isHealthy = report.IsHealthy,
            issueCount = report.IssueCount,
            rulesChecked = report.RulesChecked,
            tablesChecked = report.TablesChecked,
            tableCounts = report.TableCounts,
            issuesByType = report.IssuesByType,
            issues = report.Issues
        });
    }

    /// <summary>Check denormalized counters and referential drift (dev only).</summary>
    [HttpGet("validate-data")]
    public async Task<IActionResult> ValidateData(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        var report = await DataIntegritySeeder.ValidateAsync(db, env.ContentRootPath, ct);
        return Ok(report);
    }

    /// <summary>Run all demo seeds in order, then reconcile and validate (dev only).</summary>
    [HttpPost("seed-all")]
    public async Task<IActionResult> SeedAll(
        [FromServices] AidrDbContext db,
        [FromServices] IPasswordHasher passwordHasher,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        var result = await FullDevSeedSeeder.SeedAsync(db, passwordHasher, env.ContentRootPath, ct);

        return Ok(new
        {
            message = result.Validation.IsHealthy
                ? "Full dev seed completed. All integrity checks passed."
                : "Full dev seed completed with data integrity warnings.",
            stepsCompleted = result.StepsCompleted,
            isHealthy = result.Validation.IsHealthy,
            issueCount = result.Validation.IssueCount,
            issues = result.Validation.Issues.Take(100)
        });
    }

    /// <summary>Add the map coordinate columns to Addresses / Shops (dev only).</summary>
    [HttpPost("address-geo-schema")]
    public async Task<IActionResult> ApplyAddressGeoSchema(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            env.ContentRootPath,
            Path.Combine("scripts", "address-geo-schema.sql"),
            ct);

        return Ok(new
        {
            message = "Latitude / Longitude columns are in place on Addresses and Shops."
        });
    }

    /// <summary>Run the fulfillment sweep once, on demand (dev only).</summary>
    [HttpPost("shipping/sweep")]
    public async Task<IActionResult> RunShippingSweep(
        [FromServices] IShippingService shipping,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        var result = await shipping.RunSweepAsync(ct);
        return Ok(result);
    }

    [HttpPost("seed-product-qa")]
    public async Task<IActionResult> SeedProductQa(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await ProductQaDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);
        var questionCount = await db.ProductQuestions.CountAsync(ct);

        return Ok(new
        {
            message = "Product Q&A demo seed completed.",
            questionCount
        });
    }

    [HttpPost("seed-reorder-demo")]
    public async Task<IActionResult> SeedReorderDemo(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        var (orderId, itemCount) = await ReorderDemoSeeder.SeedAsync(db, ct);

        return Ok(new
        {
            message = "Reorder demo order seeded.",
            orderId,
            itemCount
        });
    }

    [HttpPost("seed-kyc-duplicate")]
    public async Task<IActionResult> SeedKycDuplicate(
        [FromServices] AidrDbContext db,
        [FromServices] IWebHostEnvironment env,
        CancellationToken ct)
    {
        if (!env.IsDevelopment())
            return NotFound();

        await KycDuplicateDemoSeeder.SeedAsync(db, env.ContentRootPath, ct);

        return Ok(new { message = "KYC duplicate identity demo seed completed." });
    }
}
