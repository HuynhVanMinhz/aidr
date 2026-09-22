using AIDR.Infrastructure.Persistence;
using AIDR.Modules.Auth.Abstractions;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Dev-only: run all idempotent demo seeds in business-safe order, then reconcile.
/// </summary>
public static class FullDevSeedSeeder
{
    public static async Task<FullDevSeedResult> SeedAsync(
        AidrDbContext db,
        IPasswordHasher passwordHasher,
        string contentRootPath,
        CancellationToken ct = default)
    {
        var steps = new List<string>();

        await DemoAccountsSeeder.SeedAsync(db, passwordHasher, ct);
        steps.Add("demo-accounts");

        await CategoryHierarchyDemoSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("categories");

        await CatalogDemoSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("catalog");

        await CatalogRichSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("catalog-rich");

        await ElectronicsCatalogExpansionSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("catalog-expansion");

        await CatalogImagesSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("catalog-images");

        await CategoryIconsSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("category-icons");

        await InventoryLotsDemoSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("inventory-lots");

        await VoucherDemoSeeder.SeedAsync(db, ct);
        steps.Add("vouchers");

        await PendingProductsDemoSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("pending-products");

        await SellerRegistrationDemoSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("seller-registrations");

        await ProductReviewsDemoSeeder.SeedAsync(db, contentRootPath, ct);
        await ReviewModerationDemoSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("product-reviews");

        await RecommendationDemoSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("recommendations");

        await NlCompareDemoSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("nl-compare");

        await AiAssistantDemoSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("ai-assistant");

        await WalletDemoSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("wallet");

        await LowStockNotificationDemoSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("low-stock-notifications");

        await ReturnDemoSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("returns");

        await ShippingDemoSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("shipping");

        await GovernanceInsightsDemoSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("governance-insights");

        await TrySettlementBackfillAsync(db, contentRootPath, steps, ct);

        await TableCoverageDemoSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("table-coverage");

        await InventoryLotsDemoSeeder.SeedAsync(db, contentRootPath, ct);
        steps.Add("inventory-lots-final");

        await DataIntegritySeeder.ReconcileAsync(db, contentRootPath, ct);
        steps.Add("reconcile");

        var validation = await DataIntegritySeeder.ValidateAsync(db, contentRootPath, ct);

        return new FullDevSeedResult
        {
            StepsCompleted = steps,
            Validation = validation
        };
    }

    private static async Task TrySettlementBackfillAsync(
        AidrDbContext db,
        string contentRootPath,
        List<string> steps,
        CancellationToken ct)
    {
        var hasSettlement = await SqlScriptSeeder.TableExistsAsync(db, "dbo.SettlementEntries", ct);

        if (hasSettlement != true)
            return;

        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-settlement-backfill.sql"),
            ct);
        steps.Add("settlement-backfill");
    }
}

public sealed class FullDevSeedResult
{
    public IReadOnlyList<string> StepsCompleted { get; init; } = Array.Empty<string>();
    public DataIntegrityReport Validation { get; init; } = null!;
}
