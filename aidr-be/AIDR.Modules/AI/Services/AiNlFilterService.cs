using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;

namespace AIDR.Modules.AI.Services;

public sealed class AiNlFilterService : IAiNlFilterService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly ILlmClient _llm;
    private readonly IAiCatalogRepository _catalog;
    private readonly ILogger<AiNlFilterService> _logger;

    public AiNlFilterService(
        ILlmClient llm,
        IAiCatalogRepository catalog,
        ILogger<AiNlFilterService> logger)
    {
        _llm = llm;
        _catalog = catalog;
        _logger = logger;
    }

    public async Task<NlFilterResultDto> ParseAsync(
        NlFilterRequest request,
        CancellationToken cancellationToken = default)
    {
        var query = (request.Query ?? string.Empty).Trim();
        if (query.Length < AiConstants.MinNlQueryLength)
            throw new AppException("Query is required.");
        if (query.Length > AiConstants.MaxNlQueryLength)
            throw new AppException($"Query must be at most {AiConstants.MaxNlQueryLength} characters.");

        var categories = await _catalog.GetActiveCategoriesAsync(cancellationToken);
        var heuristic = ParseHeuristic(query, categories);

        if (_llm.UseMock)
            return heuristic;

        var categoryHints = string.Join(
            ", ",
            categories.Select(c => $"{c.CategoryId}:{c.Name} ({c.Slug})"));

        var systemPrompt =
            """
            You convert shopping natural-language queries into a strict JSON filter for an electronics marketplace.
            Return ONLY JSON with these optional fields:
            q (string keyword), categoryId (int), categoryName (string), brand (string),
            minPrice (number VND), maxPrice (number VND), minRating (number 0-5),
            sort (one of: newest, price_asc, price_desc, popular, rating), confidence (0-1).
            Prices are Vietnamese Dong integers. Omit unknown fields. Do not invent categoryId values outside the provided list.
            """;

        var userPrompt =
            $"""
            Available categories: {categoryHints}
            User query: {query}
            """;

        var raw = await _llm.ChatAsync(systemPrompt, userPrompt, jsonFormat: true, cancellationToken);
        if (string.IsNullOrWhiteSpace(raw))
        {
            _logger.LogInformation("NL filter falling back to heuristic (no Groq response).");
            return heuristic;
        }

        try
        {
            var llm = JsonSerializer.Deserialize<NlFilterLlmPayload>(ExtractJsonObject(raw), JsonOptions);
            if (llm is null)
                return heuristic;

            var sanitized = Sanitize(llm, query, categories, AiConstants.SourceGroq);
            // Prefer heuristic category/brand when LLM left them empty but heuristic found signals.
            return MergeWithHeuristic(sanitized, heuristic);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse Groq NL filter JSON; using heuristic.");
            return heuristic;
        }
    }

    private static NlFilterResultDto MergeWithHeuristic(NlFilterResultDto llm, NlFilterResultDto heuristic)
    {
        return new NlFilterResultDto
        {
            Q = FirstNonEmpty(llm.Q, heuristic.Q),
            ShopId = llm.ShopId ?? heuristic.ShopId,
            CategoryId = llm.CategoryId ?? heuristic.CategoryId,
            CategoryName = FirstNonEmpty(llm.CategoryName, heuristic.CategoryName),
            Brand = FirstNonEmpty(llm.Brand, heuristic.Brand),
            MinPrice = llm.MinPrice ?? heuristic.MinPrice,
            MaxPrice = llm.MaxPrice ?? heuristic.MaxPrice,
            MinRating = llm.MinRating ?? heuristic.MinRating,
            Sort = FirstNonEmpty(llm.Sort, heuristic.Sort),
            InterpretedQuery = llm.InterpretedQuery,
            Confidence = Math.Max(llm.Confidence, heuristic.Confidence),
            Source = llm.Source
        };
    }

    private static string? FirstNonEmpty(string? a, string? b)
        => !string.IsNullOrWhiteSpace(a) ? a : b;

    private static NlFilterResultDto Sanitize(
        NlFilterLlmPayload payload,
        string query,
        IReadOnlyList<AiCategoryLookup> categories,
        string source)
    {
        string? brand = NormalizeBrand(payload.Brand);
        string? q = string.IsNullOrWhiteSpace(payload.Q) ? null : payload.Q.Trim();
        if (q is { Length: > DiscoveryConstants.MaxSearchQueryLength })
            q = q[..DiscoveryConstants.MaxSearchQueryLength];

        decimal? minPrice = NormalizePrice(payload.MinPrice);
        decimal? maxPrice = NormalizePrice(payload.MaxPrice);
        if (minPrice is not null && maxPrice is not null && minPrice > maxPrice)
            (minPrice, maxPrice) = (maxPrice, minPrice);

        decimal? minRating = payload.MinRating is null
            ? null
            : Math.Clamp(payload.MinRating.Value, 0m, 5m);

        string? sort = null;
        if (!string.IsNullOrWhiteSpace(payload.Sort) && AiConstants.AllowedSorts.Contains(payload.Sort))
            sort = payload.Sort.Trim().ToLowerInvariant();

        int? categoryId = null;
        string? categoryName = null;
        if (payload.CategoryId is > 0)
        {
            var byId = categories.FirstOrDefault(c => c.CategoryId == payload.CategoryId.Value);
            if (byId is not null)
            {
                categoryId = byId.CategoryId;
                categoryName = byId.Name;
            }
        }

        if (categoryId is null)
        {
            var matched = MatchCategory(payload.CategoryName ?? q ?? query, categories);
            if (matched is not null)
            {
                categoryId = matched.CategoryId;
                categoryName = matched.Name;
            }
        }

        var confidence = payload.Confidence is null
            ? 0.7m
            : Math.Clamp(payload.Confidence.Value, 0m, 1m);

        return new NlFilterResultDto
        {
            Q = q,
            CategoryId = categoryId,
            CategoryName = categoryName,
            Brand = brand,
            MinPrice = minPrice,
            MaxPrice = maxPrice,
            MinRating = minRating,
            Sort = sort,
            InterpretedQuery = query,
            Confidence = confidence,
            Source = source
        };
    }

    private static NlFilterResultDto ParseHeuristic(string query, IReadOnlyList<AiCategoryLookup> categories)
    {
        var lower = query.ToLowerInvariant();
        var confidence = 0.35m;

        string? brand = DetectBrand(lower);
        if (brand is not null) confidence += 0.15m;

        var category = MatchCategory(query, categories);
        if (category is not null) confidence += 0.2m;

        var (minPrice, maxPrice, priceHit) = DetectPriceRange(lower);
        if (priceHit) confidence += 0.2m;

        var sort = DetectSort(lower);
        if (sort is not null) confidence += 0.1m;

        decimal? minRating = null;
        var ratingMatch = Regex.Match(lower, @"(?:từ\s+|from\s+|>=\s*)?(\d(?:[.,]\d)?)\s*(?:sao|stars?)");
        if (ratingMatch.Success
            && decimal.TryParse(ratingMatch.Groups[1].Value.Replace(',', '.'), NumberStyles.Number, CultureInfo.InvariantCulture, out var rating))
        {
            minRating = Math.Clamp(rating, 0m, 5m);
            confidence += 0.1m;
        }

        // Keyword leftover: strip known brand/category tokens for optional free-text search.
        var q = BuildKeyword(query, brand, category);

        return new NlFilterResultDto
        {
            Q = q,
            CategoryId = category?.CategoryId,
            CategoryName = category?.Name,
            Brand = brand,
            MinPrice = minPrice,
            MaxPrice = maxPrice,
            MinRating = minRating,
            Sort = sort,
            InterpretedQuery = query,
            Confidence = Math.Min(confidence, 0.95m),
            Source = AiConstants.SourceHeuristic
        };
    }

    private static string? BuildKeyword(string query, string? brand, AiCategoryLookup? category)
    {
        var tokens = Regex.Split(query, @"\s+")
            .Where(t => t.Length > 1)
            .Where(t => brand is null || !t.Equals(brand, StringComparison.OrdinalIgnoreCase))
            .Where(t => category is null
                        || (!queryContainsToken(t, category.Name) && !queryContainsToken(t, category.Slug)))
            .Where(t => !IsNoiseToken(t))
            .ToList();

        if (tokens.Count == 0)
            return null;

        var joined = string.Join(' ', tokens);
        return joined.Length > DiscoveryConstants.MaxSearchQueryLength
            ? joined[..DiscoveryConstants.MaxSearchQueryLength]
            : joined;

        static bool queryContainsToken(string token, string haystack)
            => haystack.Contains(token, StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsNoiseToken(string token)
    {
        var t = token.ToLowerInvariant().Trim(',', '.', '!', '?');
        return t is "tìm" or "tim" or "mua" or "muốn" or "muon" or "cho" or "tôi" or "toi"
            or "sản" or "san" or "phẩm" or "pham" or "sp" or "với" or "voi" or "cần" or "can"
            or "find" or "looking" or "for" or "want" or "with" or "under" or "above" or "from"
            or "to" or "dưới" or "duoi" or "trên" or "tren" or "từ" or "tu" or "đến" or "den"
            or "giá" or "gia" or "triệu" or "trieu" or "đồng" or "dong" or "vnd" or "k" or "tr"
            or "rẻ" or "re" or "nhất" or "nhat" or "đắt" or "dat" or "sort" or "lọc" or "loc";
    }

    private static string? DetectBrand(string lower)
    {
        string[] brands =
        [
            "samsung", "apple", "iphone", "xiaomi", "asus", "dell", "hp", "lenovo",
            "sony", "oppo", "vivo", "realme", "google", "microsoft", "acer", "msi", "huawei"
        ];

        foreach (var b in brands)
        {
            if (lower.Contains(b, StringComparison.Ordinal))
            {
                if (b is "iphone") return "Apple";
                return CultureInfo.InvariantCulture.TextInfo.ToTitleCase(b);
            }
        }

        return null;
    }

    private static string? NormalizeBrand(string? brand)
    {
        if (string.IsNullOrWhiteSpace(brand))
            return null;
        var trimmed = brand.Trim();
        if (trimmed.Length > DiscoveryConstants.MaxBrandLength)
            trimmed = trimmed[..DiscoveryConstants.MaxBrandLength];
        return trimmed;
    }

    private static decimal? NormalizePrice(decimal? value)
    {
        if (value is null) return null;
        if (value < 0) return null;
        // Cap absurd LLM prices (100 billion VND).
        if (value > 100_000_000_000m) return null;
        return Math.Round(value.Value, 0, MidpointRounding.AwayFromZero);
    }

    private static AiCategoryLookup? MatchCategory(string? text, IReadOnlyList<AiCategoryLookup> categories)
    {
        if (string.IsNullOrWhiteSpace(text) || categories.Count == 0)
            return null;

        var lower = text.ToLowerInvariant();

        // Exact / contains slug or name.
        foreach (var c in categories.OrderByDescending(c => c.Name.Length))
        {
            if (lower.Contains(c.Name.ToLowerInvariant()) || lower.Contains(c.Slug.ToLowerInvariant()))
                return c;
        }

        // Synonyms for common storefront roots.
        var synonyms = new (string Needle, string SlugHint)[]
        {
            ("điện thoại", "dien-thoai"),
            ("dien thoai", "dien-thoai"),
            ("smartphone", "dien-thoai"),
            ("phone", "dien-thoai"),
            ("laptop", "laptop"),
            ("máy tính", "laptop"),
            ("may tinh", "laptop"),
            ("macbook", "laptop"),
            ("phụ kiện", "phu-kien"),
            ("phu kien", "phu-kien"),
            ("accessory", "phu-kien"),
            ("tai nghe", "phu-kien"),
            ("watch", "phu-kien"),
            ("đồng hồ", "phu-kien")
        };

        foreach (var (needle, slugHint) in synonyms)
        {
            if (!lower.Contains(needle, StringComparison.Ordinal))
                continue;
            var hit = categories.FirstOrDefault(c =>
                c.Slug.Equals(slugHint, StringComparison.OrdinalIgnoreCase)
                || c.Slug.Contains(slugHint, StringComparison.OrdinalIgnoreCase)
                || c.Name.Contains(needle, StringComparison.OrdinalIgnoreCase));
            if (hit is not null)
                return hit;
        }

        return null;
    }

    private static (decimal? Min, decimal? Max, bool Hit) DetectPriceRange(string lower)
    {
        // "từ X đến Y triệu"
        var rangeTrieu = Regex.Match(
            lower,
            @"(?:từ|from)\s*(\d+(?:[.,]\d+)?)\s*(?:triệu|trieu|tr|triệu đồng)?\s*(?:đến|toi|to|-)\s*(\d+(?:[.,]\d+)?)\s*(?:triệu|trieu|tr)?");
        if (rangeTrieu.Success)
        {
            var a = ParseMillion(rangeTrieu.Groups[1].Value);
            var b = ParseMillion(rangeTrieu.Groups[2].Value);
            if (a is not null && b is not null)
                return (Math.Min(a.Value, b.Value), Math.Max(a.Value, b.Value), true);
        }

        // "dưới / under X triệu"
        var under = Regex.Match(
            lower,
            @"(?:dưới|duoi|under|<=|max)\s*(\d+(?:[.,]\d+)?)\s*(?:triệu|trieu|tr|m)?");
        if (under.Success)
        {
            var max = ParseMillion(under.Groups[1].Value);
            if (max is not null) return (null, max, true);
        }

        // "trên / above X triệu"
        var over = Regex.Match(
            lower,
            @"(?:trên|tren|above|>=|min|từ)\s*(\d+(?:[.,]\d+)?)\s*(?:triệu|trieu|tr|m)");
        if (over.Success)
        {
            var min = ParseMillion(over.Groups[1].Value);
            if (min is not null) return (min, null, true);
        }

        // Absolute VND like "10000000"
        var absolute = Regex.Match(lower, @"(?:dưới|duoi|under|<=)\s*(\d{6,})");
        if (absolute.Success && decimal.TryParse(absolute.Groups[1].Value, out var absMax))
            return (null, absMax, true);

        return (null, null, false);
    }

    private static decimal? ParseMillion(string raw)
    {
        if (!decimal.TryParse(raw.Replace(',', '.'), NumberStyles.Number, CultureInfo.InvariantCulture, out var n))
            return null;
        // Values like 10 mean 10 triệu; values already huge stay as-is.
        if (n < 1000m)
            return Math.Round(n * 1_000_000m, 0, MidpointRounding.AwayFromZero);
        return Math.Round(n, 0, MidpointRounding.AwayFromZero);
    }

    private static string? DetectSort(string lower)
    {
        if (ContainsAny(lower, "rẻ nhất", "re nhat", "giá thấp", "gia thap", "price asc", "cheapest", "lowest price"))
            return DiscoveryConstants.SortPriceAsc;
        if (ContainsAny(lower, "đắt nhất", "dat nhat", "giá cao", "gia cao", "price desc", "most expensive"))
            return DiscoveryConstants.SortPriceDesc;
        if (ContainsAny(lower, "bán chạy", "ban chay", "popular", "best seller", "bestseller"))
            return DiscoveryConstants.SortPopular;
        if (ContainsAny(lower, "đánh giá cao", "danh gia cao", "rating", "top rated"))
            return DiscoveryConstants.SortRating;
        if (ContainsAny(lower, "mới nhất", "moi nhat", "newest", "latest"))
            return DiscoveryConstants.SortNewest;
        return null;
    }

    private static bool ContainsAny(string haystack, params string[] needles)
        => needles.Any(n => haystack.Contains(n, StringComparison.Ordinal));

    private static string ExtractJsonObject(string raw)
    {
        var start = raw.IndexOf('{');
        var end = raw.LastIndexOf('}');
        if (start >= 0 && end > start)
            return raw[start..(end + 1)];
        return raw;
    }

    private sealed class NlFilterLlmPayload
    {
        public string? Q { get; set; }
        public int? CategoryId { get; set; }
        public string? CategoryName { get; set; }
        public string? Brand { get; set; }
        public decimal? MinPrice { get; set; }
        public decimal? MaxPrice { get; set; }
        public decimal? MinRating { get; set; }
        public string? Sort { get; set; }
        public decimal? Confidence { get; set; }
    }
}
