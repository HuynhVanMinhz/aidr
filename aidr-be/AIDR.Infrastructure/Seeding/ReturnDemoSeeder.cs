using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Dev-only: seed Delivered orders + return requests across Pending/Approved/Receiving/Rejected/Closed (Seller pipeline).
/// </summary>
public static class ReturnDemoSeeder
{
    public static Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default) =>
        SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-returns.sql"),
            ct);
}
