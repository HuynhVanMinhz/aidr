using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

public static class GovernanceInsightsDemoSeeder
{
    public static Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default) =>
        SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-governance-insights.sql"),
            ct);
}
