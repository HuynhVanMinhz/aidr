using System.Data;
using System.Text.RegularExpressions;
using AIDR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Seeding;

public static class SqlScriptSeeder
{
    public static async Task ExecuteFileAsync(
        AidrDbContext db,
        string contentRootPath,
        string relativeScriptPath,
        CancellationToken ct = default)
    {
        var repoRoot = Path.GetFullPath(Path.Combine(contentRootPath, "..", ".."));
        var sqlPath = Path.Combine(repoRoot, relativeScriptPath);

        if (!File.Exists(sqlPath))
            throw new FileNotFoundException($"Seed script not found: {sqlPath}");

        var sql = await File.ReadAllTextAsync(sqlPath, ct);
        var batches = Regex.Split(sql, @"^\s*GO\s*;?\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase);

        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync(ct);

        foreach (var batch in batches)
        {
            var trimmed = batch.Trim();
            if (string.IsNullOrWhiteSpace(trimmed))
                continue;

            var executable = Regex.Replace(trimmed, @"/\*.*?\*/", string.Empty, RegexOptions.Singleline).Trim();
            if (string.IsNullOrWhiteSpace(executable))
                continue;

            await using var command = connection.CreateCommand();
            command.CommandText = trimmed;
            command.CommandTimeout = 120;
            await command.ExecuteNonQueryAsync(ct);
        }
    }
}
