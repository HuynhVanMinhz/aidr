using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Dev-only: seed view history + ProductRecommendations for hybrid recommend / similar testing.
/// </summary>
public static class RecommendationDemoSeeder
{
    public static Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default) =>
        SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-recommendations.sql"),
            ct);
}
