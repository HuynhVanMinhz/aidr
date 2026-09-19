using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Dev-only: backfill opening InventoryLots for products whose StockQuantity is not lot-backed.
/// Required before checkout - FIFO allocation reads InventoryLots, not Products.StockQuantity alone.
/// </summary>
public static class InventoryLotsDemoSeeder
{
    public static Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default) =>
        SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-inventory-lots.sql"),
            ct);
}
