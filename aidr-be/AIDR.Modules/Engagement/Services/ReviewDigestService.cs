using System.Text;
using System.Text.Json;
using AIDR.Modules.AI.Abstractions;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Modules.Engagement.Services;
using AIDR.Shared.Caching;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AIDR.Modules.Engagement.Services;

public sealed class ReviewDigestService : IReviewDigestService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly IReviewDigestRepository _repository;
    private readonly ILlmClient _llm;
    private readonly ICacheService _cache;
    private readonly ReviewDigestOptions _options;
    private readonly ILogger<ReviewDigestService> _logger;

    public ReviewDigestService(
        IReviewDigestRepository repository,
        ILlmClient llm,
        ICacheService cache,
        IOptions<ReviewDigestOptions> options,
        ILogger<ReviewDigestService> logger)
    {
        _repository = repository;
        _llm = llm;
        _cache = cache;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<ReviewDigestDto> GetDigestAsync(
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        if (productId == Guid.Empty)
            throw new AppException("Product id is required.");

        if (!await _repository.ProductExistsAsync(productId, cancellationToken))
            throw new NotFoundException("Product not found.");

        var cacheKey = ReviewDigestConstants.CacheKey(productId);
        var cached = await _cache.GetAsync<ReviewDigestDto>(cacheKey, cancellationToken);
        if (cached is not null)
            return cached;

        var reviewCount = await _repository.GetVisibleReviewCountAsync(productId, cancellationToken);
        if (reviewCount < _options.MinReviews)
        {
            var unavailable = BuildUnavailable(reviewCount);
            await _cache.SetAsync(cacheKey, unavailable, CacheTtl(), cancellationToken);
            return unavailable;
        }

        var snapshot = await _repository.GetSnapshotAsync(productId, cancellationToken);
        if (snapshot is not null && snapshot.ReviewCount == reviewCount)
        {
            var fromSnapshot = DeserializeDigest(snapshot.DigestJson, reviewCount, snapshot.Source, snapshot.GeneratedAt);
            await _cache.SetAsync(cacheKey, fromSnapshot, CacheTtl(), cancellationToken);
            return fromSnapshot;
        }

        if (!await CanRegenerateAsync(productId, cancellationToken))
        {
            if (snapshot is not null)
            {
                var stale = DeserializeDigest(snapshot.DigestJson, reviewCount, snapshot.Source, snapshot.GeneratedAt);
                await _cache.SetAsync(cacheKey, stale, CacheTtl(), cancellationToken);
                return stale;
            }

            var unavailable = BuildUnavailable(reviewCount);
            await _cache.SetAsync(cacheKey, unavailable, CacheTtl(), cancellationToken);
            return unavailable;
        }

        var reviews = await _repository.GetVisibleReviewsForDigestAsync(
            productId,
            _options.MaxReviewsInPrompt,
            cancellationToken);

        var generated = await GenerateDigestAsync(reviews, reviewCount, cancellationToken);
        var payloadJson = JsonSerializer.Serialize(generated, JsonOptions);
        var now = DateTime.UtcNow;

        await _repository.UpsertSnapshotAsync(
            productId,
            reviewCount,
            payloadJson,
            generated.Source ?? ReviewDigestConstants.SourceHeuristic,
            now,
            cancellationToken);

        await _cache.SetAsync(cacheKey, generated, CacheTtl(), cancellationToken);
        return generated;
    }

    public async Task InvalidateAsync(Guid productId, CancellationToken cancellationToken = default)
    {
        if (productId == Guid.Empty)
            return;

        await _repository.DeleteSnapshotAsync(productId, cancellationToken);
        await _cache.RemoveAsync(ReviewDigestConstants.CacheKey(productId), cancellationToken);

        if (_options.RegenerateOnInvalidate
            && await _repository.ProductExistsAsync(productId, cancellationToken))
        {
            await GetDigestAsync(productId, cancellationToken);
        }
    }

    private async Task<ReviewDigestDto> GenerateDigestAsync(
        IReadOnlyList<ReviewDigestReviewRecord> reviews,
        int reviewCount,
        CancellationToken cancellationToken)
    {
        var heuristic = BuildHeuristicDigest(reviews, reviewCount);

        if (_llm.UseMock)
            return heuristic;

        var systemPrompt =
            """
            You summarize customer product reviews for AIDR marketplace.
            Use ONLY facts from the provided reviews. Do not invent specs, warranty terms, or features.
            Output strict JSON only:
            {
              "summaryLine": "string max 200 chars",
              "pros": ["string max 80 chars"],
              "cons": ["string max 80 chars"],
              "sentiment": { "positive": 0-100, "neutral": 0-100, "negative": 0-100 }
            }
            All text must be English.
            """;
        var userPrompt = BuildReviewPrompt(reviews);

        var raw = await _llm.ChatAsync(systemPrompt, userPrompt, jsonFormat: true, cancellationToken);
        if (string.IsNullOrWhiteSpace(raw))
        {
            _logger.LogInformation("Review digest falling back to heuristic (no Groq response).");
            return heuristic;
        }

        try
        {
            var llm = JsonSerializer.Deserialize<ReviewDigestLlmPayload>(ExtractJsonObject(raw), JsonOptions);
            if (llm is null)
                return heuristic;

            return new ReviewDigestDto
            {
                Available = true,
                ReviewCount = reviewCount,
                GeneratedAt = DateTime.UtcNow,
                Source = ReviewDigestConstants.SourceGroq,
                SummaryLine = TrimOrFallback(llm.SummaryLine, heuristic.SummaryLine, 200),
                Pros = NormalizeBullets(llm.Pros, heuristic.Pros, 5, 80),
                Cons = NormalizeBullets(llm.Cons, heuristic.Cons, 3, 80),
                Sentiment = NormalizeSentiment(llm.Sentiment, heuristic.Sentiment)
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse Groq review digest JSON; using heuristic.");
            return heuristic;
        }
    }

    private static ReviewDigestDto BuildHeuristicDigest(
        IReadOnlyList<ReviewDigestReviewRecord> reviews,
        int reviewCount)
    {
        var positiveHits = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var negativeHits = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var review in reviews)
        {
            var text = $"{review.Title} {review.Content}".ToLowerInvariant();
            foreach (var word in ReviewDigestConstants.PositiveKeywords)
            {
                if (text.Contains(word, StringComparison.OrdinalIgnoreCase))
                    positiveHits[word] = positiveHits.GetValueOrDefault(word) + 1;
            }

            foreach (var word in ReviewDigestConstants.NegativeKeywords)
            {
                if (text.Contains(word, StringComparison.OrdinalIgnoreCase))
                    negativeHits[word] = negativeHits.GetValueOrDefault(word) + 1;
            }
        }

        var pros = positiveHits
            .OrderByDescending(kv => kv.Value)
            .Take(5)
            .Select(kv => CapitalizePhrase(kv.Key))
            .ToList();
        if (pros.Count == 0 && reviews.Any(r => r.Rating >= 4))
            pros.Add("Buyers generally report a positive experience.");

        var cons = negativeHits
            .OrderByDescending(kv => kv.Value)
            .Take(3)
            .Select(kv => CapitalizePhrase(kv.Key))
            .ToList();
        if (cons.Count == 0 && reviews.Any(r => r.Rating <= 3))
            cons.Add("A few buyers mention minor drawbacks.");

        var sentiment = BuildSentimentFromRatings(reviews);
        var summaryLine = pros.Count > 0 && cons.Count > 0
            ? $"Most buyers praise {pros[0].ToLowerInvariant()}; some mention {cons[0].ToLowerInvariant()}."
            : pros.Count > 0
                ? $"Most buyers highlight {pros[0].ToLowerInvariant()}."
                : "Customer feedback is mixed across recent reviews.";

        return new ReviewDigestDto
        {
            Available = true,
            ReviewCount = reviewCount,
            GeneratedAt = DateTime.UtcNow,
            Source = ReviewDigestConstants.SourceHeuristic,
            SummaryLine = summaryLine,
            Pros = pros,
            Cons = cons,
            Sentiment = sentiment
        };
    }

    private static ReviewDigestSentimentDto BuildSentimentFromRatings(IReadOnlyList<ReviewDigestReviewRecord> reviews)
    {
        if (reviews.Count == 0)
            return new ReviewDigestSentimentDto { Neutral = 100 };

        var positive = reviews.Count(r => r.Rating >= 4);
        var negative = reviews.Count(r => r.Rating <= 2);
        var neutral = reviews.Count - positive - negative;
        var total = (double)reviews.Count;

        return new ReviewDigestSentimentDto
        {
            Positive = (int)Math.Round(positive / total * 100),
            Neutral = (int)Math.Round(neutral / total * 100),
            Negative = (int)Math.Round(negative / total * 100)
        };
    }

    private static string BuildReviewPrompt(IReadOnlyList<ReviewDigestReviewRecord> reviews)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Reviews:");
        foreach (var review in reviews)
        {
            var content = review.Content;
            if (content.Length > ReviewDigestConstants.MaxReviewContentChars)
                content = content[..ReviewDigestConstants.MaxReviewContentChars];

            sb.AppendLine($"- rating={review.Rating}; title={review.Title}; content={content}");
        }

        return sb.ToString();
    }

    private static ReviewDigestDto BuildUnavailable(int reviewCount) =>
        new()
        {
            Available = false,
            ReviewCount = reviewCount,
            Pros = Array.Empty<string>(),
            Cons = Array.Empty<string>()
        };

    private ReviewDigestDto DeserializeDigest(string json, int reviewCount, string source, DateTime generatedAt)
    {
        try
        {
            var dto = JsonSerializer.Deserialize<ReviewDigestDto>(json, JsonOptions);
            if (dto is null)
                return BuildUnavailable(reviewCount);

            return new ReviewDigestDto
            {
                Available = dto.Available,
                ReviewCount = reviewCount,
                GeneratedAt = generatedAt,
                Source = source,
                SummaryLine = dto.SummaryLine,
                Pros = dto.Pros,
                Cons = dto.Cons,
                Sentiment = dto.Sentiment
            };
        }
        catch (JsonException)
        {
            return BuildUnavailable(reviewCount);
        }
    }

    private async Task<bool> CanRegenerateAsync(Guid productId, CancellationToken cancellationToken)
    {
        var counterKey = ReviewDigestConstants.RegenerationCounterKey(productId);
        var count = await _cache.GetAsync<int?>(counterKey, cancellationToken) ?? 0;
        if (count >= ReviewDigestConstants.MaxRegenerationsPerHour)
            return false;

        await _cache.SetAsync(counterKey, count + 1, TimeSpan.FromHours(1), cancellationToken);
        return true;
    }

    private TimeSpan CacheTtl() =>
        TimeSpan.FromMinutes(Math.Clamp(_options.CacheTtlMinutes, 1, 24 * 60));

    private static string ExtractJsonObject(string raw)
    {
        var start = raw.IndexOf('{');
        var end = raw.LastIndexOf('}');
        if (start >= 0 && end > start)
            return raw[start..(end + 1)];
        return raw;
    }

    private static string? TrimOrFallback(string? value, string? fallback, int maxLen)
    {
        var chosen = string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
        if (chosen is null)
            return null;
        return chosen.Length <= maxLen ? chosen : chosen[..maxLen];
    }

    private static IReadOnlyList<string> NormalizeBullets(
        IReadOnlyList<string>? values,
        IReadOnlyList<string> fallback,
        int maxItems,
        int maxLen)
    {
        var items = (values ?? Array.Empty<string>())
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Select(v => v.Trim())
            .Select(v => v.Length <= maxLen ? v : v[..maxLen])
            .Take(maxItems)
            .ToList();

        return items.Count > 0 ? items : fallback;
    }

    private static ReviewDigestSentimentDto? NormalizeSentiment(
        ReviewDigestSentimentDto? sentiment,
        ReviewDigestSentimentDto? fallback)
    {
        if (sentiment is null)
            return fallback;

        var total = sentiment.Positive + sentiment.Neutral + sentiment.Negative;
        if (total <= 0)
            return fallback;

        return sentiment;
    }

    private static string CapitalizePhrase(string phrase)
    {
        if (string.IsNullOrWhiteSpace(phrase))
            return phrase;
        return char.ToUpperInvariant(phrase[0]) + phrase[1..];
    }

    private sealed class ReviewDigestLlmPayload
    {
        public string? SummaryLine { get; set; }
        public List<string>? Pros { get; set; }
        public List<string>? Cons { get; set; }
        public ReviewDigestSentimentDto? Sentiment { get; set; }
    }
}
