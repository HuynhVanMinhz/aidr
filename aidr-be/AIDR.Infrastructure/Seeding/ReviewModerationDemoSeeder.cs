using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Dev-only: apply review moderation schema + seed PendingTrust / Reported samples.
/// </summary>
public static class ReviewModerationDemoSeeder
{
    public static async Task SeedAsync(
        AidrDbContext db,
        string contentRootPath,
        CancellationToken ct = default)
    {
        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "review-moderation-schema.sql"),
            ct);

        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-review-moderation.sql"),
            ct);
    }
}
