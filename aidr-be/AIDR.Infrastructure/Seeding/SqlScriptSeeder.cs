using System.Data;
using System.Data.Common;
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
        await ExecuteBatchesAsync(db, sql, ct);
    }

    public static async Task<bool> TableExistsAsync(
        AidrDbContext db,
        string tableName,
        CancellationToken ct = default)
    {
        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync(ct);

        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT CASE WHEN OBJECT_ID(@tableName, N'U') IS NOT NULL THEN 1 ELSE 0 END";

        var param = command.CreateParameter();
        param.ParameterName = "@tableName";
        param.Value = tableName;
        command.Parameters.Add(param);

        var result = await command.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result) == 1;
    }

    private static async Task ExecuteBatchesAsync(AidrDbContext db, string sql, CancellationToken ct)
    {
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
