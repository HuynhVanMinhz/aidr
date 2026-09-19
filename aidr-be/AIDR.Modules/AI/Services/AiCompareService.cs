using System.Globalization;
using System.Text;
using System.Text.Json;
using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;

namespace AIDR.Modules.AI.Services;

public sealed class AiCompareService : IAiCompareService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private static readonly (string Key, string Label)[] PreferredSpecKeys =
    [
        ("ram", "RAM"),
        ("storage", "Storage"),
        ("screen", "Screen"),
        ("display", "Display"),
        ("refresh_rate", "Refresh rate"),
        ("battery", "Battery"),
        ("chip", "Chip"),
        ("cpu", "CPU"),
        ("gpu", "GPU"),
        ("camera", "Camera"),
        ("front_camera", "Front camera"),
        ("rear_camera", "Rear camera"),
        ("os", "OS"),
        ("weight", "Weight"),
        ("dimensions", "Dimensions"),
        ("connectivity", "Connectivity"),
        ("ports", "Ports"),
        ("audio", "Audio"),
        ("charging", "Charging"),
        ("sim", "SIM"),
        ("color", "Color"),
        ("material", "Material")
    ];

    private readonly ILlmClient _llm;
    private readonly IAiCatalogRepository _catalog;
    private readonly ILogger<AiCompareService> _logger;

    public AiCompareService(
        ILlmClient llm,
        IAiCatalogRepository catalog,
        ILogger<AiCompareService> logger)
    {
        _llm = llm;
        _catalog = catalog;
        _logger = logger;
    }

    public async Task<CompareProductsResultDto> CompareAsync(
        CompareProductsRequest request,
        CancellationToken cancellationToken = default)
    {
        var ids = (request.ProductIds ?? new List<Guid>())
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();

        if (ids.Count < AiConstants.MinCompareProducts)
            throw new AppException($"Select at least {AiConstants.MinCompareProducts} products to compare.");
        if (ids.Count > AiConstants.MaxCompareProducts)
            throw new AppException($"You can compare at most {AiConstants.MaxCompareProducts} products.");

        var products = await _catalog.GetApprovedProductsByIdsAsync(ids, cancellationToken);
        if (products.Count < AiConstants.MinCompareProducts)
            throw new AppException("At least two approved products are required for comparison.");
        if (products.Count != ids.Count)
        {
            var missing = ids.Except(products.Select(p => p.ProductId)).ToList();
            throw new NotFoundException(
                $"Some products were not found or are not available: {string.Join(", ", missing)}");
        }

        var cards = products.Select(MapCard).ToList();
        var dimensions = BuildDimensions(cards);
        var heuristic = BuildHeuristicNarrative(cards, dimensions);

        if (_llm.UseMock)
        {
            return new CompareProductsResultDto
            {
                Products = cards,
                Dimensions = dimensions,
                Summary = heuristic.Summary,
                Highlights = heuristic.Highlights,
                Source = AiConstants.SourceHeuristic
            };
        }

        var productBlock = BuildPromptProductBlock(cards);
        var systemPrompt =
            """
            You are a shopping assistant comparing consumer electronics for AIDR marketplace.
            Given product cards with specs, write a concise English comparison.
            Return ONLY JSON: { "summary": string, "highlights": string[] } where highlights has 2-5 short bullet points.
            Be factual; do not invent specs not provided. Mention price and standout trade-offs.
            Format all VND prices like 3.690.000 ₫ (never 3690000 VND).
            """;
        var userPrompt = $"Compare these products:\n{productBlock}";

        var raw = await _llm.ChatAsync(systemPrompt, userPrompt, jsonFormat: true, cancellationToken);
        if (string.IsNullOrWhiteSpace(raw))
        {
            _logger.LogInformation("Compare falling back to heuristic (no Groq response).");
            return new CompareProductsResultDto
            {
                Products = cards,
                Dimensions = dimensions,
                Summary = heuristic.Summary,
                Highlights = heuristic.Highlights,
                Source = AiConstants.SourceHeuristic
            };
        }

        try
        {
            var llm = JsonSerializer.Deserialize<CompareLlmPayload>(ExtractJsonObject(raw), JsonOptions);
            var summary = string.IsNullOrWhiteSpace(llm?.Summary) ? heuristic.Summary : llm!.Summary.Trim();
            var highlights = (llm?.Highlights ?? Array.Empty<string>())
                .Where(h => !string.IsNullOrWhiteSpace(h))
                .Select(h => h.Trim())
                .Take(6)
                .ToList();
            if (highlights.Count == 0)
                highlights = heuristic.Highlights.ToList();

            return new CompareProductsResultDto
            {
                Products = cards,
                Dimensions = dimensions,
                Summary = summary,
                Highlights = highlights,
                Source = AiConstants.SourceGroq
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse Groq compare JSON; using heuristic.");
            return new CompareProductsResultDto
            {
                Products = cards,
                Dimensions = dimensions,
                Summary = heuristic.Summary,
                Highlights = heuristic.Highlights,
                Source = AiConstants.SourceHeuristic
            };
        }
    }

    private static CompareProductCardDto MapCard(AiCompareProductRecord p)
    {
        var effective = p.SalePrice is decimal sale && sale > 0 && sale < p.BasePrice
            ? sale
            : p.BasePrice;
        var available = Math.Max(0, p.StockQuantity - p.ReservedQuantity);
        return new CompareProductCardDto
        {
            ProductId = p.ProductId,
            Name = p.Name,
            Slug = p.Slug,
            Brand = p.Brand,
            ModelNumber = p.ModelNumber,
            ConditionType = string.IsNullOrWhiteSpace(p.ConditionType) ? "New" : p.ConditionType,
            BasePrice = p.BasePrice,
            SalePrice = p.SalePrice,
            EffectivePrice = effective,
            Currency = p.Currency,
            AvgRating = p.AvgRating,
            ReviewCount = p.ReviewCount,
            WarrantyMonths = p.WarrantyMonths,
            OriginCountry = p.OriginCountry,
            AvailableQuantity = available,
            SoldCount = p.SoldCount,
            PrimaryImageUrl = p.PrimaryImageUrl,
            CategoryId = p.CategoryId,
            CategoryName = p.CategoryName,
            ShopId = p.ShopId,
            ShopName = p.ShopName,
            Tags = ParseTags(p.TagsJson),
            Specs = ParseSpecs(p.SpecsJson)
        };
    }

    private static IReadOnlyList<string> ParseTags(string? tagsJson)
    {
        if (string.IsNullOrWhiteSpace(tagsJson))
            return Array.Empty<string>();

        try
        {
            using var doc = JsonDocument.Parse(tagsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
                return Array.Empty<string>();

            return doc.RootElement.EnumerateArray()
                .Select(el => el.ValueKind == JsonValueKind.String ? el.GetString() : el.ToString())
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Select(t => t!.Trim())
                .Where(t => !t.StartsWith("NL-COMPARE-SEED", StringComparison.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(8)
                .ToList();
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }

    private static IReadOnlyDictionary<string, string> ParseSpecs(string? specsJson)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(specsJson))
            return result;

        try
        {
            using var doc = JsonDocument.Parse(specsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return result;

            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                var value = prop.Value.ValueKind switch
                {
                    JsonValueKind.String => prop.Value.GetString(),
                    JsonValueKind.Number => prop.Value.ToString(),
                    JsonValueKind.True => "Yes",
                    JsonValueKind.False => "No",
                    _ => prop.Value.ToString()
                };
                if (!string.IsNullOrWhiteSpace(value))
                    result[prop.Name] = value!;
            }
        }
        catch (JsonException)
        {
            // ignore malformed specs
        }

        return result;
    }

    private static IReadOnlyList<CompareDimensionDto> BuildDimensions(IReadOnlyList<CompareProductCardDto> cards)
    {
        var dims = new List<CompareDimensionDto>
        {
            BuildFixed("price", "Price", cards, c => FormatPrice(c.EffectivePrice, c.Currency)),
        };

        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "price" };

        if (cards.Any(c => c.SalePrice is decimal sale && sale > 0 && sale < c.BasePrice))
        {
            dims.Add(BuildFixed("list_price", "List price", cards, c => FormatPrice(c.BasePrice, c.Currency)));
            dims.Add(BuildFixed("discount", "Discount", cards, c =>
            {
                if (c.SalePrice is not decimal sale || sale <= 0 || sale >= c.BasePrice || c.BasePrice <= 0)
                    return "No discount";
                var pct = Math.Round((c.BasePrice - sale) / c.BasePrice * 100m, 0);
                return $"{pct}%";
            }));
            used.Add("list_price");
            used.Add("discount");
        }

        dims.Add(BuildFixed("brand", "Brand", cards, c =>
            string.IsNullOrWhiteSpace(c.Brand) ? "Not specified" : c.Brand!));
        dims.Add(BuildFixed("model", "Model", cards, c =>
            string.IsNullOrWhiteSpace(c.ModelNumber) ? "Not specified" : c.ModelNumber!));
        dims.Add(BuildFixed("category", "Category", cards, c =>
            string.IsNullOrWhiteSpace(c.CategoryName) ? "Not specified" : c.CategoryName));
        dims.Add(BuildFixed("shop", "Shop", cards, c =>
            string.IsNullOrWhiteSpace(c.ShopName) ? "Not specified" : c.ShopName));
        dims.Add(BuildFixed("condition", "Condition", cards, c => c.ConditionType));
        dims.Add(BuildFixed("rating", "Rating", cards, c =>
            c.ReviewCount <= 0
                ? "No reviews yet"
                : $"{c.AvgRating.ToString("0.0", CultureInfo.InvariantCulture)} ★"));
        dims.Add(BuildFixed("reviews", "Reviews", cards, c =>
            c.ReviewCount <= 0 ? "No reviews yet" : c.ReviewCount.ToString(CultureInfo.InvariantCulture)));
        dims.Add(BuildFixed("warranty", "Warranty", cards, c =>
            c.WarrantyMonths is null ? "Not specified" : $"{c.WarrantyMonths} months"));
        dims.Add(BuildFixed("origin", "Origin", cards, c =>
            string.IsNullOrWhiteSpace(c.OriginCountry) ? "Not specified" : c.OriginCountry!));
        dims.Add(BuildFixed("stock", "In stock", cards, c =>
            c.AvailableQuantity <= 0 ? "Out of stock" : $"{c.AvailableQuantity} available"));
        dims.Add(BuildFixed("sold", "Sold", cards, c =>
            c.SoldCount <= 0 ? "No sales yet" : c.SoldCount.ToString(CultureInfo.InvariantCulture)));

        used.UnionWith([
            "brand", "model", "category", "shop", "condition", "rating", "reviews",
            "warranty", "origin", "stock", "sold"
        ]);

        if (cards.Any(c => c.Tags.Count > 0))
        {
            dims.Add(BuildFixed("tags", "Tags", cards, c =>
                c.Tags.Count == 0 ? "Not specified" : string.Join(", ", c.Tags)));
            used.Add("tags");
        }

        foreach (var (key, label) in PreferredSpecKeys)
        {
            if (used.Contains(key))
                continue;
            if (!cards.Any(c => c.Specs.ContainsKey(key)))
                continue;
            dims.Add(BuildSpec(key, label, cards));
            used.Add(key);
        }

        // Remaining specs from any product (union), so unique fields still appear.
        var extraKeys = cards
            .SelectMany(c => c.Specs.Keys)
            .Where(k => !used.Contains(k))
            .GroupBy(k => k, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.Key)
            .OrderBy(k => k, StringComparer.OrdinalIgnoreCase)
            .Take(24);

        foreach (var key in extraKeys)
        {
            dims.Add(BuildSpec(key, ToLabel(key), cards));
            used.Add(key);
        }

        return dims;
    }

    private static CompareDimensionDto BuildFixed(
        string key,
        string label,
        IReadOnlyList<CompareProductCardDto> cards,
        Func<CompareProductCardDto, string> selector)
    {
        var values = cards.ToDictionary(
            c => c.ProductId.ToString(),
            selector,
            StringComparer.OrdinalIgnoreCase);
        return new CompareDimensionDto { Key = key, Label = label, Values = values };
    }

    private static CompareDimensionDto BuildSpec(
        string key,
        string label,
        IReadOnlyList<CompareProductCardDto> cards)
    {
        var values = cards.ToDictionary(
            c => c.ProductId.ToString(),
            c => c.Specs.TryGetValue(key, out var v) ? FormatSpecValue(key, v) : "Not available",
            StringComparer.OrdinalIgnoreCase);
        return new CompareDimensionDto { Key = key, Label = label, Values = values };
    }

    private static string FormatSpecValue(string key, string value)
    {
        if (string.IsNullOrWhiteSpace(value) || value == "-" || value == "-")
            return "Not available";

        if (key.Equals("screen", StringComparison.OrdinalIgnoreCase)
            || key.Equals("display", StringComparison.OrdinalIgnoreCase))
        {
            if (value.Contains('"') || value.Contains('″')
                || value.Contains("inch", StringComparison.OrdinalIgnoreCase))
                return value;

            var match = System.Text.RegularExpressions.Regex.Match(value, @"-?\d+(\.\d+)?");
            if (match.Success)
                return $"{match.Value}\"";
        }

        return value;
    }

    private static string ToLabel(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return key;
        var parts = key.Replace('_', ' ').Replace('-', ' ').Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return string.Join(' ', parts.Select(p =>
            char.ToUpperInvariant(p[0]) + (p.Length > 1 ? p[1..].ToLowerInvariant() : string.Empty)));
    }

    private static string FormatPrice(decimal amount, string currency)
    {
        if (string.Equals(currency, "VND", StringComparison.OrdinalIgnoreCase))
        {
            var rounded = (long)decimal.Round(amount, 0, MidpointRounding.AwayFromZero);
            return $"{FormatGroupedDigits(rounded)} ₫";
        }

        return string.Create(CultureInfo.InvariantCulture, $"{amount:0.##} {currency}");
    }

    private static string FormatGroupedDigits(long value)
    {
        var negative = value < 0;
        var digits = Math.Abs(value).ToString(CultureInfo.InvariantCulture);
        var sb = new StringBuilder();
        for (var i = 0; i < digits.Length; i++)
        {
            if (i > 0 && (digits.Length - i) % 3 == 0)
                sb.Append('.');
            sb.Append(digits[i]);
        }

        return negative ? $"-{sb}" : sb.ToString();
    }

    private static (string Summary, IReadOnlyList<string> Highlights) BuildHeuristicNarrative(
        IReadOnlyList<CompareProductCardDto> cards,
        IReadOnlyList<CompareDimensionDto> dimensions)
    {
        var cheapest = cards.OrderBy(c => c.EffectivePrice).First();
        var priciest = cards.OrderByDescending(c => c.EffectivePrice).First();
        var topRated = cards.OrderByDescending(c => c.AvgRating).ThenByDescending(c => c.ReviewCount).First();

        var summary = cards.Count == 2
            ? $"{cards[0].Name} vs {cards[1].Name}: " +
              $"{cheapest.Name} is the better value at {FormatPrice(cheapest.EffectivePrice, cheapest.Currency)}" +
              (ReferenceEquals(cheapest, topRated)
                  ? " and also leads on rating."
                  : $", while {topRated.Name} leads on customer rating ({topRated.AvgRating:0.0}).")
            : $"Among {cards.Count} products, {cheapest.Name} is the lowest price " +
              $"({FormatPrice(cheapest.EffectivePrice, cheapest.Currency)}) and {topRated.Name} has the strongest rating.";

        var highlights = new List<string>
        {
            $"Best price: {cheapest.Name} - {FormatPrice(cheapest.EffectivePrice, cheapest.Currency)}.",
            $"Highest rating: {topRated.Name} - {topRated.AvgRating:0.0} ({topRated.ReviewCount} reviews)."
        };

        if (!ReferenceEquals(cheapest, priciest))
        {
            var delta = priciest.EffectivePrice - cheapest.EffectivePrice;
            highlights.Add(
                $"Price spread: {FormatPrice(delta, cheapest.Currency)} between {cheapest.Name} and {priciest.Name}.");
        }

        var ramDim = dimensions.FirstOrDefault(d => d.Key.Equals("ram", StringComparison.OrdinalIgnoreCase));
        if (ramDim is not null)
        {
            var distinct = ramDim.Values.Values
                .Where(v => !IsMissingCompareValue(v))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (distinct.Count > 1)
                highlights.Add($"RAM differs across picks: {string.Join(", ", distinct)}.");
        }

        var storageDim = dimensions.FirstOrDefault(d => d.Key.Equals("storage", StringComparison.OrdinalIgnoreCase));
        if (storageDim is not null)
        {
            var distinct = storageDim.Values.Values
                .Where(v => !IsMissingCompareValue(v))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (distinct.Count > 1)
                highlights.Add($"Storage options: {string.Join(", ", distinct)}.");
        }

        return (summary, highlights);
    }

    private static bool IsMissingCompareValue(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return true;
        return value is "-" or "-" or "Not available" or "Not specified" or "No reviews yet"
            or "No sales yet" or "No discount" or "Out of stock";
    }

    private static string BuildPromptProductBlock(IReadOnlyList<CompareProductCardDto> cards)
    {
        var sb = new StringBuilder();
        foreach (var c in cards)
        {
            sb.AppendLine($"- id={c.ProductId}");
            sb.AppendLine($"  name={c.Name}");
            sb.AppendLine($"  brand={c.Brand}");
            sb.AppendLine($"  model={c.ModelNumber}");
            sb.AppendLine($"  category={c.CategoryName}");
            sb.AppendLine($"  shop={c.ShopName}");
            sb.AppendLine($"  condition={c.ConditionType}");
            sb.AppendLine($"  price={c.EffectivePrice} {c.Currency}");
            sb.AppendLine($"  listPrice={c.BasePrice} {c.Currency}");
            sb.AppendLine($"  rating={c.AvgRating} ({c.ReviewCount} reviews)");
            sb.AppendLine($"  warrantyMonths={c.WarrantyMonths}");
            sb.AppendLine($"  origin={c.OriginCountry}");
            sb.AppendLine($"  available={c.AvailableQuantity}");
            sb.AppendLine($"  sold={c.SoldCount}");
            if (c.Tags.Count > 0)
                sb.AppendLine($"  tags={string.Join(", ", c.Tags)}");
            if (c.Specs.Count > 0)
                sb.AppendLine($"  specs={JsonSerializer.Serialize(c.Specs)}");
        }

        return sb.ToString();
    }

    private static string ExtractJsonObject(string raw)
    {
        var start = raw.IndexOf('{');
        var end = raw.LastIndexOf('}');
        if (start >= 0 && end > start)
            return raw[start..(end + 1)];
        return raw;
    }

    private sealed class CompareLlmPayload
    {
        public string? Summary { get; set; }
        public string[]? Highlights { get; set; }
    }
}
