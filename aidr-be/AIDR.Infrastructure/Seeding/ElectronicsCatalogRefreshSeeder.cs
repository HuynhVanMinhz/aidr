using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Dev-only: normalize shops/categories/products for an electronics storefront
/// and assign mock image URLs under https://cdn.aidr.local/mock/...
/// </summary>
public static class ElectronicsCatalogRefreshSeeder
{
    public static Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default) =>
        SqlScriptSeeder.ExecuteFileAsync(db, contentRootPath, Path.Combine("scripts", "seed-electronics-refresh.sql"), ct);
}
