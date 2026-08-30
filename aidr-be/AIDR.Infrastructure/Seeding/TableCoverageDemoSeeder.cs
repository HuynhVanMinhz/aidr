using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Dev-only: seed tables not covered by other demo scripts (variants, price history,
/// seller ratings, bank accounts, payout batches, password reset tokens, …).
/// </summary>
public static class TableCoverageDemoSeeder
{
    public static async Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default)
    {
        var hasSettlement = await SqlScriptSeeder.TableExistsAsync(db, "dbo.SettlementEntries", ct);
        if (!hasSettlement)
        {
            await SqlScriptSeeder.ExecuteFileAsync(
                db,
                contentRootPath,
                Path.Combine("scripts", "settlement-schema.sql"),
                ct);
        }

        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-table-coverage.sql"),
            ct);
    }
}
