using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

public static class ProductQaDemoSeeder
{
    public static async Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default)
    {
        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "product-qa-schema.sql"),
            ct);

        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-product-qa.sql"),
            ct);
    }
}
