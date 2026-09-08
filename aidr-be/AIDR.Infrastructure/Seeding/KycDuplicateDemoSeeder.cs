using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

public static class KycDuplicateDemoSeeder
{
    public static Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default)
        => SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-kyc-duplicate.sql"),
            ct);
}
