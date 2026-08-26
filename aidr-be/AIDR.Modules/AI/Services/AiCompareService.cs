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
        ("battery", "Battery"),
        ("chip", "Chip"),
        ("cpu", "CPU"),
        ("gpu", "GPU"),
        ("camera", "Camera"),
        ("os", "OS"),
        ("weight", "Weight"),
        ("refresh_rate", "Refresh rate"),
        ("display", "Display")
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
        return new CompareProductCardDto
        {
            ProductId = p.ProductId,
            Name = p.Name,
            Slug = p.Slug,
            Brand = p.Brand,
            ModelNumber = p.ModelNumber,
            BasePrice = p.BasePrice,
            SalePrice = p.SalePrice,
            EffectivePrice = effective,
            Currency = p.Currency,
            AvgRating = p.AvgRating,
            ReviewCount = p.ReviewCount,
            WarrantyMonths = p.WarrantyMonths,
            PrimaryImageUrl = p.PrimaryImageUrl,
            CategoryId = p.CategoryId,
            CategoryName = p.CategoryName,
            ShopId = p.ShopId,
            ShopName = p.ShopName,
            Specs = ParseSpecs(p.SpecsJson)
        };
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
            BuildFixed("brand", "Brand", cards, c => c.Brand ?? "—"),
            BuildFixed("rating", "Rating", cards, c =>
                c.ReviewCount <= 0
                    ? "—"
                    : $"{c.AvgRating.ToString("0.0", CultureInfo.InvariantCulture)} ({c.ReviewCount})"),
            BuildFixed("warranty", "Warranty", cards, c =>
                c.WarrantyMonths is null ? "—" : $"{c.WarrantyMonths} months")
        };

        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "price", "brand", "rating", "warranty" };

        foreach (var (key, label) in PreferredSpecKeys)
        {
            if (used.Contains(key))
                continue;
            if (!cards.Any(c => c.Specs.ContainsKey(key)))
                continue;
            dims.Add(BuildSpec(key, label, cards));
            used.Add(key);
        }

        // Any remaining shared keys (appear on 2+ products).
        var extraKeys = cards
            .SelectMany(c => c.Specs.Keys)
            .Where(k => !used.Contains(k))
            .GroupBy(k => k, StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Count() >= 2)
            .Select(g => g.Key)
            .Take(6);

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
            c => c.Specs.TryGetValue(key, out var v) ? v : "—",
            StringComparer.OrdinalIgnoreCase);
        return new CompareDimensionDto { Key = key, Label = label, Values = values };
    }

    private static string ToLabel(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return key;
        var parts = key.Replace('_', ' ').Replace('-', ' ').Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return string.Join(' ', parts.Select(p =>
            char.ToUpperInvariant(p[0]) + (p.Length > 1 ? p[1..].ToLowerInvariant() : string.Empty)));
    }

    private static string FormatPrice(decimal amount, string currency)
        => string.Create(CultureInfo.InvariantCulture, $"{amount:0} {currency}");

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
            $"Best price: {cheapest.Name} — {FormatPrice(cheapest.EffectivePrice, cheapest.Currency)}.",
            $"Highest rating: {topRated.Name} — {topRated.AvgRating:0.0} ({topRated.ReviewCount} reviews)."
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
            var distinct = ramDim.Values.Values.Where(v => v != "—").Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            if (distinct.Count > 1)
                highlights.Add($"RAM differs across picks: {string.Join(", ", distinct)}.");
        }

        var storageDim = dimensions.FirstOrDefault(d => d.Key.Equals("storage", StringComparison.OrdinalIgnoreCase));
        if (storageDim is not null)
        {
            var distinct = storageDim.Values.Values.Where(v => v != "—").Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            if (distinct.Count > 1)
                highlights.Add($"Storage options: {string.Join(", ", distinct)}.");
        }

        return (summary, highlights);
    }

    private static string BuildPromptProductBlock(IReadOnlyList<CompareProductCardDto> cards)
    {
        var sb = new StringBuilder();
        foreach (var c in cards)
        {
            sb.AppendLine($"- id={c.ProductId}");
            sb.AppendLine($"  name={c.Name}");
            sb.AppendLine($"  brand={c.Brand}");
            sb.AppendLine($"  price={c.EffectivePrice} {c.Currency}");
            sb.AppendLine($"  rating={c.AvgRating} ({c.ReviewCount} reviews)");
            sb.AppendLine($"  warrantyMonths={c.WarrantyMonths}");
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
