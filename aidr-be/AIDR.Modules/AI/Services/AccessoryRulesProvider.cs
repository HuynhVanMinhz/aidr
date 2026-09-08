using System.Text.Json;

namespace AIDR.Modules.AI.Services;

public sealed class AccessoryRulesProvider
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly IReadOnlyDictionary<string, AccessoryRuleDefinition> _rules;

    public AccessoryRulesProvider()
    {
        _rules = LoadRules();
    }

    public AccessoryRuleDefinition? ResolveRule(string categorySlug, int? parentCategoryId, Func<int, string?> parentSlugLookup)
    {
        if (_rules.TryGetValue(categorySlug, out var direct))
            return direct;

        if (parentCategoryId is int parentId)
        {
            var parentSlug = parentSlugLookup(parentId);
            if (!string.IsNullOrWhiteSpace(parentSlug) && _rules.TryGetValue(parentSlug!, out var parentRule))
                return parentRule;
        }

        return null;
    }

    public IReadOnlyDictionary<string, AccessoryRuleDefinition> Rules => _rules;

    private static IReadOnlyDictionary<string, AccessoryRuleDefinition> LoadRules()
    {
        var assembly = typeof(AccessoryRulesProvider).Assembly;
        var resourceName = assembly.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("accessory-rules.json", StringComparison.OrdinalIgnoreCase));

        if (resourceName is null)
        {
            var path = Path.Combine(AppContext.BaseDirectory, "AI", "Data", "accessory-rules.json");
            if (File.Exists(path))
            {
                var jsonFromFile = File.ReadAllText(path);
                return ParseRules(jsonFromFile);
            }

            return new Dictionary<string, AccessoryRuleDefinition>(StringComparer.OrdinalIgnoreCase);
        }

        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException("Accessory rules resource stream missing.");
        using var reader = new StreamReader(stream);
        return ParseRules(reader.ReadToEnd());
    }

    private static IReadOnlyDictionary<string, AccessoryRuleDefinition> ParseRules(string json)
    {
        var parsed = JsonSerializer.Deserialize<Dictionary<string, AccessoryRuleDefinition>>(json, JsonOptions)
            ?? new Dictionary<string, AccessoryRuleDefinition>(StringComparer.OrdinalIgnoreCase);

        return new Dictionary<string, AccessoryRuleDefinition>(parsed, StringComparer.OrdinalIgnoreCase);
    }
}

public sealed class AccessoryRuleDefinition
{
    public List<string> AccessoryCategories { get; set; } = [];
    public int MaxItems { get; set; } = 3;
}
