using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

/// <summary>Dev-only: normalize demo/catalog text fields to English.</summary>
public static class EnglishDbRefreshSeeder
{
    public static Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default) =>
        SqlScriptSeeder.ExecuteFileAsync(db, contentRootPath, Path.Combine("scripts", "seed-english-db-refresh.sql"), ct);
}
