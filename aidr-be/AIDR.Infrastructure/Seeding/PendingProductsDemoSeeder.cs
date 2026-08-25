using AIDR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Seeding;

public static class PendingProductsDemoSeeder
{
    public static Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default) =>
        SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-pending-products.sql"),
            ct);
}
