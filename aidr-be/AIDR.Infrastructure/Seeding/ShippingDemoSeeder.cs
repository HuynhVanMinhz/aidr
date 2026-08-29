using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Dev-only: applies the shipment schema, then seeds orders sitting at every
/// stage of the carrier pipeline (waiting to dispatch, picked up, in transit,
/// and one the carrier refused).
/// </summary>
public static class ShippingDemoSeeder
{
    public static async Task SeedAsync(
        AidrDbContext db,
        string contentRootPath,
        CancellationToken ct = default)
    {
        // The tracking map needs the pinned coordinates on Addresses / Shops.
        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "address-geo-schema.sql"),
            ct);

        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "shipping-schema.sql"),
            ct);

        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-shipping.sql"),
            ct);
    }
}
