using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

/// <summary>Dev-only: point category/product images at local /theme/images assets.</summary>
public static class CatalogImagesSeeder
{
    public static Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default) =>
        SqlScriptSeeder.ExecuteFileAsync(db, contentRootPath, Path.Combine("scripts", "seed-catalog-images.sql"), ct);
}
