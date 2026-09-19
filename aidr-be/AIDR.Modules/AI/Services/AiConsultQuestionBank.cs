using System.Globalization;
using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Constants;

namespace AIDR.Modules.AI.Services;

/// <summary>One tappable answer to a consultation question.</summary>
public sealed class ConsultChoice
{
    public string Label { get; init; } = null!;

    /// <summary>Stable internal value stored in <see cref="ConsultState.Answers"/>.</summary>
    public string Value { get; init; } = null!;

    /// <summary>Catalog keywords this answer implies - used for search Q and ranking.</summary>
    public IReadOnlyList<string> Keywords { get; init; } = Array.Empty<string>();

    /// <summary>Child category slug to narrow into when the catalog has one.</summary>
    public string? ChildCategorySlug { get; init; }

    /// <summary>Discovery sort this answer implies, if any.</summary>
    public string? Sort { get; init; }

    /// <summary>Minimum rating this answer implies, if any.</summary>
    public decimal? MinRating { get; init; }

    /// <summary>Price band, for budget answers.</summary>
    public decimal? MinPrice { get; init; }

    public decimal? MaxPrice { get; init; }

    /// <summary>Category id, for category answers.</summary>
    public int? CategoryId { get; init; }
}

public sealed class ConsultQuestion
{
    /// <summary>category | budget | useCase | priority</summary>
    public string Key { get; init; } = null!;

    public string Text { get; init; } = null!;

    public IReadOnlyList<ConsultChoice> Choices { get; init; } = Array.Empty<ConsultChoice>();
}

/// <summary>
/// Deterministic question bank for guided consultation. Questions are rules, not prompts -
/// the assistant keeps consulting when Groq is mocked or unavailable.
/// </summary>
public static class AiConsultQuestionBank
{
    public const string GroupPhones = "phones";
    public const string GroupLaptops = "laptops";
    public const string GroupTablets = "tablets";
    public const string GroupAudio = "audio";
    public const string GroupWearables = "wearables";
    public const string GroupDisplays = "displays";
    public const string GroupSmartHome = "smarthome";
    public const string GroupGaming = "gaming";
    public const string GroupAccessories = "accessories";

    /// <summary>Wire key used by both slot-level and whole-round skips.</summary>
    public const string SkipValue = "skip";

    /// <summary>
    /// Resolve the question group for a category, walking up to the parent when a leaf
    /// (e.g. "Xiaomi" under "Phones") carries no recognizable keyword of its own.
    /// </summary>
    public static string? ResolveGroup(int? categoryId, IReadOnlyList<AiCategoryLookup> categories)
    {
        if (categoryId is not int id)
            return null;

        var guard = 0;
        var current = categories.FirstOrDefault(c => c.CategoryId == id);
        while (current is not null && guard++ < 5)
        {
            var group = MatchGroup(current.Name) ?? MatchGroup(current.Slug);
            if (group is not null)
                return group;
            current = current.ParentId is int parentId
                ? categories.FirstOrDefault(c => c.CategoryId == parentId)
                : null;
        }

        return null;
    }

    private static string? MatchGroup(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return null;
        var n = name.Trim().ToLowerInvariant();

        // Order matters: "headphone" contains "phone", "gaming laptop" contains "gaming".
        if (Has(n, "headphone", "earbud", "earphone", "audio", "speaker", "tai nghe", "am-thanh"))
            return GroupAudio;
        if (Has(n, "laptop", "notebook", "macbook"))
            return GroupLaptops;
        if (Has(n, "tablet", "ipad"))
            return GroupTablets;
        if (Has(n, "wearable", "smartwatch", "watch", "tracker", "deo-thong-minh", "đồng hồ"))
            return GroupWearables;
        if (Has(n, "monitor", "tivi", "television", "tv"))
            return GroupDisplays;
        if (Has(n, "smart home", "nha-thong-minh", "camera", "lighting"))
            return GroupSmartHome;
        if (Has(n, "gaming gear", "gaming-gear", "keyboard", "mouse", "gamepad"))
            return GroupGaming;
        if (Has(n, "accessor", "phu-kien", "charger", "cable", "case"))
            return GroupAccessories;
        if (Has(n, "phone", "iphone", "galaxy", "dien-thoai", "điện thoại", "smartphone"))
            return GroupPhones;

        return null;
    }

    private static bool Has(string haystack, params string[] needles)
        => needles.Any(x => haystack.Contains(x, StringComparison.Ordinal));

    /// <summary>Top-level categories as tappable chips.</summary>
    public static ConsultQuestion? BuildCategoryQuestion(IReadOnlyList<AiCategoryLookup> categories)
    {
        var roots = categories.Where(c => c.ParentId is null).Take(8).ToList();
        if (roots.Count < 2)
            return null;

        var choices = roots
            .Select(c => new ConsultChoice
            {
                Label = c.Name,
                Value = c.CategoryId.ToString(CultureInfo.InvariantCulture),
                CategoryId = c.CategoryId
            })
            .ToList();

        choices.Add(SkipChoice(AiConstants.ConsultQuestionCategory, "Not sure yet"));

        return new ConsultQuestion
        {
            Key = AiConstants.ConsultQuestionCategory,
            Text = "What kind of product are you shopping for?",
            Choices = choices
        };
    }

    /// <summary>Budget chips derived from the real price spread of the current scope.</summary>
    public static ConsultQuestion? BuildBudgetQuestion(AiPriceBands bands)
    {
        if (bands.Count < AiConstants.BudgetQuestionMinPool)
            return null;

        var low = RoundBand(bands.P33);
        var high = RoundBand(bands.P66);
        if (low <= 0 || high <= low)
            return null;

        var choices = new List<ConsultChoice>
        {
            new()
            {
                Label = $"Under {FormatVnd(low)}",
                Value = $":{Fmt(low)}",
                MaxPrice = low
            },
            new()
            {
                Label = $"{FormatVnd(low)} – {FormatVnd(high)}",
                Value = $"{Fmt(low)}:{Fmt(high)}",
                MinPrice = low,
                MaxPrice = high
            },
            new()
            {
                Label = $"Over {FormatVnd(high)}",
                Value = $"{Fmt(high)}:",
                MinPrice = high
            },
            SkipChoice(AiConstants.ConsultQuestionBudget, "No fixed budget")
        };

        return new ConsultQuestion
        {
            Key = AiConstants.ConsultQuestionBudget,
            Text = "Roughly what budget are you working with?",
            Choices = choices
        };
    }

    public static ConsultQuestion? BuildUseCaseQuestion(string? group)
    {
        if (group is null || !UseCases.TryGetValue(group, out var entry))
            return null;

        var choices = entry.Choices.ToList();
        choices.Add(SkipChoice(AiConstants.ConsultQuestionUseCase, "Not sure"));

        return new ConsultQuestion
        {
            Key = AiConstants.ConsultQuestionUseCase,
            Text = entry.Text,
            Choices = choices
        };
    }

    public static ConsultQuestion? BuildPriorityQuestion(string? group)
    {
        if (group is null || !Priorities.TryGetValue(group, out var entry))
            return null;

        var choices = entry.Choices.ToList();
        choices.Add(SkipChoice(AiConstants.ConsultQuestionPriority, "No preference"));

        return new ConsultQuestion
        {
            Key = AiConstants.ConsultQuestionPriority,
            Text = entry.Text,
            Choices = choices
        };
    }

    /// <summary>
    /// Does this free text actually describe a use case for the group? The NL filter leaves
    /// low-signal leftovers in <c>q</c> ("buy", "want"), which must NOT count as an answer -
    /// otherwise the assistant silently skips the question it most needs to ask.
    /// </summary>
    public static bool MentionsUseCase(string? text, string? group)
    {
        if (string.IsNullOrWhiteSpace(text) || group is null || !UseCases.TryGetValue(group, out var entry))
            return false;

        var lower = text.ToLowerInvariant();
        foreach (var choice in entry.Choices)
        {
            if (lower.Contains(choice.Value, StringComparison.Ordinal)
                || lower.Contains(choice.Label.ToLowerInvariant(), StringComparison.Ordinal))
                return true;
            if (choice.Keywords.Any(k => lower.Contains(k.ToLowerInvariant(), StringComparison.Ordinal)))
                return true;
        }

        return false;
    }

    /// <summary>Look a stored answer back up so ranking can reuse its keywords.</summary>
    public static ConsultChoice? FindChoice(string? group, string questionKey, string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || group is null)
            return null;

        var table = questionKey switch
        {
            AiConstants.ConsultQuestionUseCase => UseCases,
            AiConstants.ConsultQuestionPriority => Priorities,
            _ => null
        };

        if (table is null || !table.TryGetValue(group, out var entry))
            return null;

        return entry.Choices.FirstOrDefault(c =>
            string.Equals(c.Value, value, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>Parse a <c>key=value</c> quick reply from the widget.</summary>
    public static (string Key, string Value)? ParseQuickReply(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;
        var idx = raw.IndexOf('=');
        if (idx <= 0)
            return null;

        var key = raw[..idx].Trim();
        var value = raw[(idx + 1)..].Trim();
        if (key.Length == 0 || value.Length == 0)
            return null;

        // Normalize the wire key to the canonical question key.
        key = key.ToLowerInvariant() switch
        {
            "category" => AiConstants.ConsultQuestionCategory,
            "budget" => AiConstants.ConsultQuestionBudget,
            "usecase" => AiConstants.ConsultQuestionUseCase,
            "priority" => AiConstants.ConsultQuestionPriority,
            SkipValue => SkipValue,
            _ => string.Empty
        };

        return key.Length == 0 ? null : (key, value);
    }

    /// <summary>Wire value for a chip, matching <see cref="ParseQuickReply"/>.</summary>
    public static string ToWireValue(string questionKey, ConsultChoice choice)
    {
        if (choice.Value.StartsWith(SkipValue + ":", StringComparison.Ordinal))
            return $"{SkipValue}={choice.Value[(SkipValue.Length + 1)..]}";

        var prefix = questionKey switch
        {
            AiConstants.ConsultQuestionCategory => "category",
            AiConstants.ConsultQuestionBudget => "budget",
            AiConstants.ConsultQuestionUseCase => "usecase",
            AiConstants.ConsultQuestionPriority => "priority",
            _ => "unknown"
        };
        return $"{prefix}={choice.Value}";
    }

    /// <summary>Parse a <c>min:max</c> budget value; empty side means unbounded.</summary>
    public static (decimal? Min, decimal? Max)? ParseBudgetValue(string value)
    {
        var parts = value.Split(':');
        if (parts.Length != 2)
            return null;

        decimal? min = decimal.TryParse(parts[0], NumberStyles.Any, CultureInfo.InvariantCulture, out var lo)
            ? lo
            : null;
        decimal? max = decimal.TryParse(parts[1], NumberStyles.Any, CultureInfo.InvariantCulture, out var hi)
            ? hi
            : null;

        return min is null && max is null ? null : (min, max);
    }

    private static ConsultChoice SkipChoice(string questionKey, string label)
        => new() { Label = label, Value = $"{SkipValue}:{questionKey}" };

    /// <summary>Wire value for the widget's "skip questions" button - ends the round immediately.</summary>
    public const string SkipAllValue = SkipValue + "=all";

    /// <summary>Marker stored in <see cref="ConsultState.Answers"/> for a skipped slot.</summary>
    public const string SkippedAnswer = "(skipped)";

    public const string SkipAllTarget = "all";

    /// <summary>Round to a price a human would say out loud.</summary>
    private static decimal RoundBand(decimal value)
    {
        if (value <= 0)
            return 0;
        var step = value switch
        {
            < 1_000_000m => 100_000m,
            < 10_000_000m => 500_000m,
            _ => 1_000_000m
        };
        return Math.Round(value / step, 0, MidpointRounding.AwayFromZero) * step;
    }

    private static string Fmt(decimal value)
        => value.ToString("0", CultureInfo.InvariantCulture);

    private static string FormatVnd(decimal value)
        => value >= 1_000_000m
            ? $"{(value / 1_000_000m).ToString("0.#", CultureInfo.InvariantCulture)}M ₫"
            : $"{value.ToString("#,0", CultureInfo.InvariantCulture)} ₫";

    private sealed record QuestionEntry(string Text, IReadOnlyList<ConsultChoice> Choices);

    private static readonly Dictionary<string, QuestionEntry> UseCases = new(StringComparer.Ordinal)
    {
        [GroupPhones] = new(
            "What will you mostly use the phone for?",
            [
                new() { Label = "Photography", Value = "photography", Keywords = ["camera", "MP", "OIS", "zoom"] },
                new() { Label = "Gaming", Value = "gaming", Keywords = ["gaming", "Snapdragon", "120Hz", "144Hz"] },
                new() { Label = "Everyday basics", Value = "everyday", Keywords = ["5G", "128GB"] },
                new() { Label = "Long battery life", Value = "battery", Keywords = ["mAh", "battery", "5000"] }
            ]),
        [GroupLaptops] = new(
            "What will you mostly use the laptop for?",
            [
                new()
                {
                    Label = "Work & study",
                    Value = "office",
                    ChildCategorySlug = "laptop-van-phong",
                    Keywords = ["office", "Core i5", "Ryzen 5", "16GB"]
                },
                new()
                {
                    Label = "Gaming",
                    Value = "gaming",
                    ChildCategorySlug = "laptop-gaming",
                    Keywords = ["gaming", "RTX", "GeForce", "144Hz"]
                },
                new() { Label = "Design & video", Value = "creative", Keywords = ["OLED", "RTX", "32GB", "color"] },
                new() { Label = "Thin & portable", Value = "portable", Keywords = ["thin", "light", "kg", "ultrabook"] }
            ]),
        [GroupTablets] = new(
            "What will the tablet be used for?",
            [
                new() { Label = "Study & notes", Value = "study", Keywords = ["pen", "stylus", "note"] },
                new() { Label = "Drawing & design", Value = "drawing", Keywords = ["pen", "stylus", "120Hz", "OLED"] },
                new() { Label = "Entertainment", Value = "entertainment", Keywords = ["speaker", "inch", "display"] },
                new() { Label = "For kids", Value = "kids", Keywords = ["kids", "durable", "parental"] }
            ]),
        [GroupAudio] = new(
            "Where will you use them most?",
            [
                new() { Label = "Commute / noise", Value = "anc", Keywords = ["ANC", "noise cancelling", "noise"] },
                new() { Label = "Sports", Value = "sports", Keywords = ["sport", "IPX", "waterproof", "fit"] },
                new() { Label = "Critical listening", Value = "hifi", Keywords = ["Hi-Res", "LDAC", "driver", "studio"] },
                new() { Label = "Calls & meetings", Value = "calls", Keywords = ["mic", "call", "ENC"] }
            ]),
        [GroupWearables] = new(
            "What do you want the wearable for?",
            [
                new() { Label = "Sports tracking", Value = "sports", Keywords = ["GPS", "sport", "workout"] },
                new() { Label = "Health monitoring", Value = "health", Keywords = ["SpO2", "heart rate", "ECG", "sleep"] },
                new() { Label = "Notifications", Value = "notifications", Keywords = ["notification", "AMOLED"] }
            ]),
        [GroupDisplays] = new(
            "What will the screen be used for?",
            [
                new() { Label = "Movies", Value = "movies", Keywords = ["4K", "HDR", "Dolby"] },
                new() { Label = "Gaming", Value = "gaming", Keywords = ["144Hz", "165Hz", "1ms", "G-Sync"] },
                new() { Label = "Work", Value = "work", Keywords = ["IPS", "sRGB", "adjustable"] }
            ]),
        [GroupGaming] = new(
            "What do you play most?",
            [
                new() { Label = "FPS / fast games", Value = "fps", Keywords = ["DPI", "1ms", "wireless", "lightweight"] },
                new() { Label = "MOBA / strategy", Value = "moba", Keywords = ["macro", "mechanical", "switch"] },
                new() { Label = "Streaming", Value = "streaming", Keywords = ["mic", "RGB", "USB"] }
            ]),
        [GroupSmartHome] = new(
            "What do you want to set up?",
            [
                new() { Label = "Security", Value = "security", Keywords = ["camera", "sensor", "motion"] },
                new() { Label = "Lighting", Value = "lighting", Keywords = ["light", "bulb", "LED"] },
                new() { Label = "Automation", Value = "automation", Keywords = ["hub", "plug", "switch"] }
            ])
    };

    private static readonly Dictionary<string, QuestionEntry> Priorities = new(StringComparer.Ordinal)
    {
        [GroupPhones] = new(
            "Within that range, what matters most?",
            [
                new() { Label = "Camera", Value = "camera", Keywords = ["camera", "MP", "OIS"] },
                new() { Label = "Battery", Value = "battery", Keywords = ["mAh", "battery"] },
                new() { Label = "Performance", Value = "performance", Keywords = ["Snapdragon", "Dimensity", "chip"] },
                BestPrice(),
                TopRated()
            ]),
        [GroupLaptops] = new(
            "Within that range, what matters most?",
            [
                new() { Label = "Performance", Value = "performance", Keywords = ["RTX", "Core i7", "Ryzen 7", "32GB"] },
                new() { Label = "Screen", Value = "screen", Keywords = ["OLED", "144Hz", "2K", "IPS"] },
                new() { Label = "Battery & weight", Value = "portability", Keywords = ["kg", "battery", "Wh", "thin"] },
                BestPrice(),
                TopRated()
            ]),
        [GroupTablets] = new(
            "Within that range, what matters most?",
            [
                new() { Label = "Screen", Value = "screen", Keywords = ["OLED", "120Hz", "inch"] },
                new() { Label = "Pen support", Value = "pen", Keywords = ["pen", "stylus"] },
                new() { Label = "Battery", Value = "battery", Keywords = ["mAh", "battery"] },
                BestPrice(),
                TopRated()
            ]),
        [GroupAudio] = new(
            "Within that range, what matters most?",
            [
                new() { Label = "Sound quality", Value = "sound", Keywords = ["driver", "Hi-Res", "LDAC"] },
                new() { Label = "Noise cancelling", Value = "anc", Keywords = ["ANC", "noise"] },
                new() { Label = "Battery", Value = "battery", Keywords = ["hours", "battery", "mAh"] },
                BestPrice(),
                TopRated()
            ]),
        [GroupWearables] = new(
            "Within that range, what matters most?",
            [
                new() { Label = "Battery", Value = "battery", Keywords = ["days", "battery", "mAh"] },
                new() { Label = "Sensors", Value = "sensors", Keywords = ["SpO2", "ECG", "GPS"] },
                BestPrice(),
                TopRated()
            ]),
        [GroupDisplays] = new(
            "Within that range, what matters most?",
            [
                new() { Label = "Refresh rate", Value = "refresh", Keywords = ["144Hz", "165Hz", "120Hz"] },
                new() { Label = "Screen size", Value = "size", Keywords = ["inch", "55", "65", "27"] },
                BestPrice(),
                TopRated()
            ]),
        [GroupGaming] = new(
            "Within that range, what matters most?",
            [
                new() { Label = "Low latency", Value = "latency", Keywords = ["1ms", "wireless", "polling"] },
                new() { Label = "Build quality", Value = "build", Keywords = ["aluminium", "mechanical", "durable"] },
                BestPrice(),
                TopRated()
            ]),
        [GroupSmartHome] = new(
            "Within that range, what matters most?",
            [
                new() { Label = "Compatibility", Value = "compatibility", Keywords = ["HomeKit", "Google", "Alexa", "Tuya"] },
                BestPrice(),
                TopRated()
            ]),
        [GroupAccessories] = new(
            "Within that range, what matters most?",
            [
                new() { Label = "Genuine brand", Value = "genuine", Keywords = ["genuine", "original"] },
                BestPrice(),
                TopRated()
            ])
    };

    private static ConsultChoice BestPrice()
        => new()
        {
            Label = "Best price",
            Value = "price",
            Sort = DiscoveryConstants.SortPriceAsc
        };

    private static ConsultChoice TopRated()
        => new()
        {
            Label = "Highest rated",
            Value = "rating",
            Sort = DiscoveryConstants.SortRating,
            MinRating = 4m
        };
}
