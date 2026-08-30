using System.Data;
using System.Text.RegularExpressions;
using AIDR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Dev-only: reconcile denormalized counters and validate data integrity after seed scripts.
/// </summary>
public static class DataIntegritySeeder
{
    private const int MaxIssuesReturned = 200;

    public static Task ReconcileAsync(AidrDbContext db, string contentRootPath, CancellationToken ct = default) =>
        SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "seed-data-reconcile.sql"),
            ct);

    public static async Task<DataIntegrityReport> ValidateAsync(
        AidrDbContext db,
        string contentRootPath,
        CancellationToken ct = default)
    {
        var repoRoot = Path.GetFullPath(Path.Combine(contentRootPath, "..", ".."));
        var tableCounts = await ReadTableCountsAsync(db, repoRoot, ct);
        var issues = await ReadValidationIssuesAsync(db, repoRoot, ct);

        var issuesByType = issues
            .GroupBy(i => i.Issue)
            .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);

        return new DataIntegrityReport
        {
            IsHealthy = issues.Count == 0,
            IssueCount = issues.Count,
            RulesChecked = CountValidationRules(repoRoot),
            TablesChecked = tableCounts.Count,
            TableCounts = tableCounts,
            IssuesByType = issuesByType,
            Issues = issues.Take(MaxIssuesReturned).ToList()
        };
    }

    private static int CountValidationRules(string repoRoot)
    {
        var sqlPath = Path.Combine(repoRoot, "scripts", "seed-data-validate.sql");
        if (!File.Exists(sqlPath))
            return 0;

        var sql = File.ReadAllText(sqlPath);
        return Regex.Matches(sql, @"Issue\s*=\s*N'", RegexOptions.IgnoreCase).Count;
    }

    private static async Task<IReadOnlyDictionary<string, int>> ReadTableCountsAsync(
        AidrDbContext db,
        string repoRoot,
        CancellationToken ct)
    {
        var sqlPath = Path.Combine(repoRoot, "scripts", "seed-data-table-counts.sql");
        if (!File.Exists(sqlPath))
            return new Dictionary<string, int>();

        var sql = await File.ReadAllTextAsync(sqlPath, ct);
        var rows = await ExecuteReaderAsync(db, sql, ct);

        return rows.ToDictionary(
            r => r["TableName"]?.ToString() ?? "?",
            r =>
            {
                if (r.TryGetValue("Rows", out var rowsVal) && rowsVal is not null)
                    return Convert.ToInt32(rowsVal);
                if (r.TryGetValue("RowCount", out var rowCountVal) && rowCountVal is not null)
                    return Convert.ToInt32(rowCountVal);
                return 0;
            },
            StringComparer.OrdinalIgnoreCase);
    }

    private static async Task<List<DataIntegrityIssue>> ReadValidationIssuesAsync(
        AidrDbContext db,
        string repoRoot,
        CancellationToken ct)
    {
        var sqlPath = Path.Combine(repoRoot, "scripts", "seed-data-validate.sql");
        if (!File.Exists(sqlPath))
            throw new FileNotFoundException($"Validation script not found: {sqlPath}");

        var sql = await File.ReadAllTextAsync(sqlPath, ct);
        var batches = Regex.Split(sql, @"^\s*GO\s*;?\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase);

        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync(ct);

        var issues = new List<DataIntegrityIssue>();

        foreach (var batch in batches)
        {
            var trimmed = batch.Trim();
            if (string.IsNullOrWhiteSpace(trimmed))
                continue;

            var executable = Regex.Replace(trimmed, @"/\*.*?\*/", string.Empty, RegexOptions.Singleline).Trim();
            if (string.IsNullOrWhiteSpace(executable))
                continue;

            var rows = await ExecuteReaderAsync(db, trimmed, ct);
            foreach (var row in rows)
            {
                var issueType = row.TryGetValue("Issue", out var issueObj) && issueObj is not null
                    ? issueObj.ToString() ?? "Unknown"
                    : "Unknown";

                issues.Add(new DataIntegrityIssue
                {
                    Issue = issueType,
                    Details = row
                });
            }
        }

        return issues;
    }

    private static async Task<List<Dictionary<string, object?>>> ExecuteReaderAsync(
        AidrDbContext db,
        string sql,
        CancellationToken ct)
    {
        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync(ct);

        var rows = new List<Dictionary<string, object?>>();

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.CommandTimeout = 120;

        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < reader.FieldCount; i++)
            {
                var name = reader.GetName(i);
                row[name] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            }

            rows.Add(row);
        }

        return rows;
    }
}

public sealed class DataIntegrityReport
{
    public bool IsHealthy { get; init; }
    public int IssueCount { get; init; }
    public int RulesChecked { get; init; }
    public int TablesChecked { get; init; }
    public IReadOnlyDictionary<string, int> TableCounts { get; init; } = new Dictionary<string, int>();
    public IReadOnlyDictionary<string, int> IssuesByType { get; init; } = new Dictionary<string, int>();
    public IReadOnlyList<DataIntegrityIssue> Issues { get; init; } = Array.Empty<DataIntegrityIssue>();
}

public sealed class DataIntegrityIssue
{
    public string Issue { get; init; } = null!;
    public IReadOnlyDictionary<string, object?> Details { get; init; } = new Dictionary<string, object?>();
}
