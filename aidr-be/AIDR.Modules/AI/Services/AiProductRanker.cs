using System.Text;
using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Constants;

namespace AIDR.Modules.AI.Services;

public sealed class RankedProduct
{
    public AiCompareProductRecord Product { get; init; } = null!;
    public double Score { get; init; }
    public string? Badge { get; set; }
    public string Reason { get; init; } = string.Empty;
}

/// <summary>
/// Scores a candidate pool against what the buyer told us, then picks a small structured set
/// (best match / cheaper / step up) instead of dumping look-alike results.
/// </summary>
public static class AiProductRanker
{
    private const double RatingPrior = 4.0;
    private const int RatingPriorWeight = 5;
    private const int MaxPerBrand = 2;
    private const int MaxPerShop = 2;

    public static IReadOnlyList<RankedProduct> Rank(
        IReadOnlyList<AiCompareProductRecord> pool,
        SlotState slots,
        ConsultState? consult,
        string? group,
        int take)
    {
        if (pool.Count == 0 || take <= 0)
            return Array.Empty<RankedProduct>();

        var useCase = AiConsultQuestionBank.FindChoice(
            group,
            AiConstants.ConsultQuestionUseCase,
            consult?.Answers.GetValueOrDefault(AiConstants.ConsultQuestionUseCase));
        var priority = AiConsultQuestionBank.FindChoice(
            group,
            AiConstants.ConsultQuestionPriority,
            consult?.Answers.GetValueOrDefault(AiConstants.ConsultQuestionPriority));

        var prices = pool.Select(EffectivePrice).OrderBy(p => p).ToList();
        var median = prices[prices.Count / 2];
        var maxSold = pool.Max(p => p.SoldCount);

        var scored = pool
            .Select(p =>
            {
                var haystack = BuildHaystack(p);
                var useCaseHits = MatchKeywords(haystack, useCase?.Keywords);
                var priorityHits = MatchKeywords(haystack, priority?.Keywords);

                var score =
                    0.25 * PriceFit(EffectivePrice(p), slots, priority, median, prices[0])
                    + 0.25 * Ratio(useCaseHits.Count, useCase?.Keywords.Count ?? 0)
                    + 0.15 * PriorityScore(priority, priorityHits.Count, p, prices)
                    + 0.20 * Quality(p)
                    + 0.10 * Popularity(p, maxSold)
                    + 0.05 * WarrantyBonus(p);

                // Out of stock stays visible but must not win a slot from a buyable item.
                if (Available(p) <= 0)
                    score *= 0.2;

                return new RankedProduct
                {
                    Product = p,
                    Score = score,
                    Reason = BuildReason(p, slots, useCase, priority, useCaseHits, priorityHits)
                };
            })
            .OrderByDescending(x => x.Score)
            .ThenByDescending(x => x.Product.AvgRating)
            .ToList();

        var diverse = ApplyDiversity(scored, take);
        return AssignBadges(diverse, scored, take);
    }

    /// <summary>Keep at most two items per brand / shop so the picks are actually different.</summary>
    private static List<RankedProduct> ApplyDiversity(List<RankedProduct> scored, int take)
    {
        var byBrand = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var byShop = new Dictionary<Guid, int>();
        var kept = new List<RankedProduct>();

        foreach (var item in scored)
        {
            if (kept.Count >= Math.Max(take * 2, take))
                break;

            var brand = item.Product.Brand?.Trim() ?? string.Empty;
            if (brand.Length > 0 && byBrand.GetValueOrDefault(brand) >= MaxPerBrand)
                continue;
            if (byShop.GetValueOrDefault(item.Product.ShopId) >= MaxPerShop)
                continue;

            if (brand.Length > 0)
                byBrand[brand] = byBrand.GetValueOrDefault(brand) + 1;
            byShop[item.Product.ShopId] = byShop.GetValueOrDefault(item.Product.ShopId) + 1;
            kept.Add(item);
        }

        // Diversity must never leave us with fewer picks than the pool can fill.
        if (kept.Count < take)
        {
            foreach (var item in scored)
            {
                if (kept.Count >= take)
                    break;
                if (!kept.Contains(item))
                    kept.Add(item);
            }
        }

        return kept;
    }

    /// <summary>Best match, then a cheaper alternative and a step up when the pool allows it.</summary>
    private static IReadOnlyList<RankedProduct> AssignBadges(
        List<RankedProduct> candidates,
        List<RankedProduct> scored,
        int take)
    {
        if (candidates.Count == 0)
            return Array.Empty<RankedProduct>();

        var best = candidates[0];
        best.Badge = AiConstants.ConsultBadgeBestMatch;
        var picked = new List<RankedProduct> { best };

        if (take > 1)
        {
            var bestPrice = EffectivePrice(best.Product);

            var cheaper = candidates
                .Skip(1)
                .FirstOrDefault(x => EffectivePrice(x.Product) <= bestPrice * 0.85m);
            if (cheaper is not null)
            {
                cheaper.Badge = AiConstants.ConsultBadgeCheaper;
                picked.Add(cheaper);
            }

            var stepUp = candidates
                .Skip(1)
                .FirstOrDefault(x => !picked.Contains(x) && EffectivePrice(x.Product) > bestPrice);
            if (stepUp is not null && picked.Count < take)
            {
                stepUp.Badge = AiConstants.ConsultBadgeStepUp;
                picked.Add(stepUp);
            }

            // Fill any remaining slot by plain rank.
            foreach (var item in candidates)
            {
                if (picked.Count >= take)
                    break;
                if (!picked.Contains(item))
                    picked.Add(item);
            }

            foreach (var item in scored)
            {
                if (picked.Count >= take)
                    break;
                if (!picked.Contains(item))
                    picked.Add(item);
            }
        }

        return picked.Take(take).ToList();
    }

    private static double PriceFit(
        decimal price,
        SlotState slots,
        ConsultChoice? priority,
        decimal median,
        decimal cheapest)
    {
        // Buyers want the most product their budget allows — peak just under the ceiling.
        decimal target;
        if (slots.MaxPrice is decimal max && max > 0)
            target = max * 0.85m;
        else if (slots.MinPrice is decimal min && min > 0)
            target = min * 1.15m;
        else if (priority?.Sort == DiscoveryConstants.SortPriceAsc)
            // They asked for the best price and set no ceiling — do not pull them to the middle.
            target = cheapest;
        else
            target = median;

        if (target <= 0)
            return 0.5;

        var distance = Math.Abs(price - target) / target;
        return Math.Max(0d, 1d - (double)distance);
    }

    private static double PriorityScore(
        ConsultChoice? priority,
        int hits,
        AiCompareProductRecord product,
        List<decimal> prices)
    {
        if (priority is null)
            return 0d;

        // "Best price" has no keywords — score it on relative cheapness inside the pool.
        if (priority.Keywords.Count == 0 && priority.Sort == DiscoveryConstants.SortPriceAsc)
        {
            var min = prices[0];
            var max = prices[^1];
            if (max <= min)
                return 1d;
            return 1d - (double)((EffectivePrice(product) - min) / (max - min));
        }

        if (priority.Keywords.Count == 0)
            return Quality(product);

        return Ratio(hits, priority.Keywords.Count);
    }

    private static double Quality(AiCompareProductRecord p)
    {
        var bayesian =
            ((double)p.AvgRating * p.ReviewCount + RatingPrior * RatingPriorWeight)
            / (p.ReviewCount + RatingPriorWeight);
        return Math.Clamp(bayesian / 5d, 0d, 1d);
    }

    private static double Popularity(AiCompareProductRecord p, int maxSold)
    {
        if (maxSold <= 0)
            return 0d;
        return Math.Log(1 + p.SoldCount) / Math.Log(1 + maxSold);
    }

    private static double WarrantyBonus(AiCompareProductRecord p)
        => p.WarrantyMonths is int months && months > 0
            ? Math.Min(1d, months / 24d)
            : 0d;

    private static double Ratio(int hits, int total)
        => total <= 0 ? 0d : Math.Clamp((double)hits / total, 0d, 1d);

    private static string BuildHaystack(AiCompareProductRecord p)
    {
        var sb = new StringBuilder();
        sb.Append(p.Name).Append(' ');
        if (!string.IsNullOrWhiteSpace(p.ShortDescription)) sb.Append(p.ShortDescription).Append(' ');
        if (!string.IsNullOrWhiteSpace(p.TagsJson)) sb.Append(p.TagsJson).Append(' ');
        if (!string.IsNullOrWhiteSpace(p.SpecsJson)) sb.Append(p.SpecsJson).Append(' ');
        if (!string.IsNullOrWhiteSpace(p.ModelNumber)) sb.Append(p.ModelNumber);
        return sb.ToString().ToLowerInvariant();
    }

    private static List<string> MatchKeywords(string haystack, IReadOnlyList<string>? keywords)
    {
        if (keywords is null || keywords.Count == 0)
            return [];
        return keywords
            .Where(k => haystack.Contains(k.ToLowerInvariant(), StringComparison.Ordinal))
            .ToList();
    }

    /// <summary>Every clause traces back to a catalog field — nothing here is generated prose.</summary>
    private static string BuildReason(
        AiCompareProductRecord p,
        SlotState slots,
        ConsultChoice? useCase,
        ConsultChoice? priority,
        List<string> useCaseHits,
        List<string> priorityHits)
    {
        var bits = new List<string>();

        // Only claim a use-case fit when a catalog field actually backs it. Saying "fits gaming"
        // about an office laptop that matched no keyword is an unsupported claim.
        var specHits = useCaseHits.Concat(priorityHits).Distinct(StringComparer.OrdinalIgnoreCase).Take(2).ToList();
        if (specHits.Count > 0)
            bits.Add(string.Join(", ", specHits));

        if (slots.MaxPrice is decimal max && EffectivePrice(p) <= max)
            bits.Add("within budget");
        else if (priority?.Sort == DiscoveryConstants.SortPriceAsc)
            bits.Add("lowest price in this set");

        // Rating / review count are rendered as their own line on the product card, so
        // repeating them here would show the same numbers twice.

        if (p.WarrantyMonths is int months && months >= 12)
            bits.Add($"{months}-month warranty");

        if (Available(p) <= 0)
            bits.Insert(0, "Out of stock");

        return string.Join(" · ", bits.Take(3));
    }

    private static int Available(AiCompareProductRecord p)
        => Math.Max(0, p.StockQuantity - p.ReservedQuantity);

    private static decimal EffectivePrice(AiCompareProductRecord p)
        => p.SalePrice is decimal sale && sale > 0 && sale < p.BasePrice ? sale : p.BasePrice;
}
