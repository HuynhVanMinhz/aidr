using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Dev-only: seed ~78 Approved products across leaf + root electronics categories
/// and remap known demo SKUs onto leaf filters.
/// </summary>
public static class CatalogRichSeeder
{
    public static Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default) =>
        SqlScriptSeeder.ExecuteFileAsync(db, contentRootPath, Path.Combine("scripts", "seed-catalog-rich.sql"), ct);
}
