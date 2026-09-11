using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Dev-only: assigns each active category its own transparent-background SVG
/// icon (under aidr-fe/public/theme/images/category-icons/) instead of the
/// generic cycled placeholder photos.
/// </summary>
public static class CategoryIconsSeeder
{
    public static Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default) =>
        SqlScriptSeeder.ExecuteFileAsync(db, contentRootPath, Path.Combine("scripts", "seed-category-icons.sql"), ct);
}
