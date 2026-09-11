using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Dev-only: rounds the active catalog out to 25 categories (smart devices &amp;
/// consumer electronics only) by adding Cameras &amp; Drones, Networking, Speakers,
/// Keyboards &amp; Mice, Power Banks &amp; Wireless Charging, and Robot Vacuums, each
/// populated with realistic Approved products.
/// </summary>
public static class ElectronicsCatalogExpansionSeeder
{
    public static Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default) =>
        SqlScriptSeeder.ExecuteFileAsync(db, contentRootPath, Path.Combine("scripts", "seed-electronics-catalog-expansion.sql"), ct);
}
