using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

public static class ReviewDigestDemoSeeder
{
    public static async Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default)
    {
        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "review-digest-schema.sql"),
            ct);

        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-review-digest.sql"),
            ct);
    }
}

public static class BundleDemoSeeder
{
    public static async Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default)
    {
        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-accessory-bundle.sql"),
            ct);

        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-compatibility-demo.sql"),
            ct);
    }
}
