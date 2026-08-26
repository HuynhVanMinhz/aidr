using AIDR.Infrastructure.Persistence;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Dev-only: seed sample AiConversations / AiMessages for shopping assistant testing.
/// </summary>
public static class AiAssistantDemoSeeder
{
    public static Task SeedAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default) =>
        SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-ai-assistant.sql"),
            ct);
}
