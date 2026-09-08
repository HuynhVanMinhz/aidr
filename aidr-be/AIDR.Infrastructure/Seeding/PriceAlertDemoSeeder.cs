using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

public static class PriceAlertDemoSeeder
{
    public static async Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default)
    {
        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "price-alert-schema.sql"),
            ct);

        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-price-alerts.sql"),
            ct);
    }
}
