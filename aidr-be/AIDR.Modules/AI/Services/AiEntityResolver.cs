using System.Globalization;
using System.Text.RegularExpressions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.AI;

namespace AIDR.Modules.AI.Services;

/// <summary>
/// Resolves product deixis (ordinals, badges, pronouns) against <see cref="DialogueState"/>.
/// </summary>
public static class AiEntityResolver
{
    private static readonly Regex HashOrdinal = new(@"#\s*([1-9]\d?)", RegexOptions.Compiled);
    private static readonly Regex CáiThứ = new(
        @"(?:c[áa]i|con|m[áa]y|sp|s[ảa]n ph[ẩa]m)\s*th[ứu]\s*([1-9]\d?)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex TheNth = new(
        @"\bthe\s+(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex StandaloneNumber = new(
        @"\b([1-5])\b",
        RegexOptions.Compiled);
    private static readonly Regex NumberAndNumber = new(
        @"\b([1-5])\s*(?:and|,|&|v[àa]|với|voi)\s*([1-5])\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    /// <summary>Parse 1-based ordinals mentioned in free text (EN + VI).</summary>
    public static IReadOnlyList<int> ParseOrdinals(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
            return Array.Empty<int>();

        var lower = message.ToLowerInvariant();
        var found = new SortedSet<int>();

        foreach (Match m in HashOrdinal.Matches(message))
        {
            if (int.TryParse(m.Groups[1].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n)
                && n is >= 1 and <= 9)
                found.Add(n);
        }

        foreach (Match m in CáiThứ.Matches(lower))
        {
            if (int.TryParse(m.Groups[1].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n)
                && n is >= 1 and <= 9)
                found.Add(n);
        }

        foreach (Match m in TheNth.Matches(lower))
        {
            var word = m.Groups[1].Value.ToLowerInvariant();
            var n = WordToOrdinal(word);
            if (n is >= 1 and <= 9)
                found.Add(n);
        }

        foreach (Match m in NumberAndNumber.Matches(lower))
        {
            if (int.TryParse(m.Groups[1].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var a)
                && a is >= 1 and <= 9)
                found.Add(a);
            if (int.TryParse(m.Groups[2].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var b)
                && b is >= 1 and <= 9)
                found.Add(b);
        }

        // Word forms without "the"
        if (ContainsAny(lower, "first one", "the first", "con đầu", "con dau", "cái đầu", "cai dau", "đầu tiên", "dau tien"))
            found.Add(1);
        if (ContainsAny(lower, "second one", "the second", "cái thứ 2", "cai thu 2", "con thứ 2", "thứ hai", "thu hai"))
            found.Add(2);
        if (ContainsAny(lower, "third one", "the third", "cái thứ 3", "cai thu 3", "thứ ba", "thu ba"))
            found.Add(3);

        // "#1" / "number 2" / "option 3"
        foreach (Match m in Regex.Matches(lower, @"\b(?:number|option|choice|card)\s*([1-5])\b"))
        {
            if (int.TryParse(m.Groups[1].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n))
                found.Add(n);
        }

        // Bare digits when message is short compare-style ("1 and 3", "compare 1 2")
        if (found.Count == 0 && ContainsAny(lower, "compare", "vs", "versus", "so sánh", "so sanh"))
        {
            foreach (Match m in StandaloneNumber.Matches(lower))
            {
                if (int.TryParse(m.Groups[1].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n))
                    found.Add(n);
            }
        }

        return found.ToList();
    }

    /// <summary>Map 1-based ordinals to product ids via <see cref="DialogueState.LastShown"/>.</summary>
    public static IReadOnlyList<Guid> ResolveFromOrdinals(IReadOnlyList<int> ordinals, DialogueState? dialogue)
    {
        if (dialogue is null || dialogue.LastShown.Count == 0 || ordinals.Count == 0)
            return Array.Empty<Guid>();

        var byOrdinal = dialogue.LastShown
            .Where(x => x.Ordinal > 0 && x.ProductId != Guid.Empty)
            .GroupBy(x => x.Ordinal)
            .ToDictionary(g => g.Key, g => g.First().ProductId);

        // Fallback: array index if Ordinal not set
        if (byOrdinal.Count == 0)
        {
            for (var i = 0; i < dialogue.LastShown.Count; i++)
            {
                var item = dialogue.LastShown[i];
                if (item.ProductId != Guid.Empty)
                    byOrdinal[i + 1] = item.ProductId;
            }
        }

        var ids = new List<Guid>();
        foreach (var o in ordinals)
        {
            if (byOrdinal.TryGetValue(o, out var id) && id != Guid.Empty && !ids.Contains(id))
                ids.Add(id);
        }

        return ids;
    }

    /// <summary>Resolve "Best match" / "Cheaper option" / "Step up" mentions to product ids.</summary>
    public static IReadOnlyList<Guid> ResolveBadgeMentions(string lower, DialogueState? dialogue)
    {
        if (dialogue is null || dialogue.LastShown.Count == 0 || string.IsNullOrWhiteSpace(lower))
            return Array.Empty<Guid>();

        var ids = new List<Guid>();
        TryAddBadge(lower, dialogue, AiConstants.ConsultBadgeBestMatch,
            ["best match", "best option", "top pick", "lựa chọn tốt nhất", "lua chon tot nhat"], ids);
        TryAddBadge(lower, dialogue, AiConstants.ConsultBadgeCheaper,
            ["cheaper option", "cheaper one", "budget option", "rẻ hơn", "re hon", "giá rẻ", "gia re"], ids);
        TryAddBadge(lower, dialogue, AiConstants.ConsultBadgeStepUp,
            ["step up", "premium option", "cao cấp", "cao cap", "đắt hơn", "dat hon"], ids);
        return ids;
    }

    /// <summary>
    /// Resolve pronoun / deixis to a single product when discourse is unambiguous
    /// (one card, existing focus, or PDP context).
    /// </summary>
    public static Guid? ResolvePronoun(string lower, DialogueState? dialogue, AiChatContextDto? context)
    {
        if (!HasDeixis(lower))
            return null;

        if (dialogue?.FocusProductId is Guid focus && focus != Guid.Empty)
            return focus;

        if (dialogue?.LastShown is { Count: 1 } single
            && single[0].ProductId != Guid.Empty)
            return single[0].ProductId;

        if (context?.ProductId is Guid pdp && pdp != Guid.Empty
            && ContainsAny(lower,
                "this product", "this item", "this phone", "this laptop",
                "máy này", "may nay", "sp này", "sp nay"))
            return pdp;

        return null;
    }

    public static bool HasDeixis(string lower)
        => ContainsAny(lower,
            "that one", "this one", "that product", "this product", "this item",
            "this phone", "this laptop", "that phone", "that laptop",
            "cái đó", "cai do", "cái đấy", "cai day", "con đó", "con do",
            "máy này", "may nay", "máy đó", "may do", "sp này", "sp nay",
            "con này", "con nay", "cái này", "cai nay")
           || Regex.IsMatch(lower, @"\b(it|that|this)\b");

    public static bool HasProductQaWords(string lower)
        => ContainsAny(lower,
            "stock", "in stock", "available", "availability",
            "còn hàng", "con hang", "hết hàng", "het hang",
            "warranty", "bảo hành", "bao hanh",
            "specs", "specification", "specifications", "thông số", "thong so",
            "battery", "ram", "storage", "how long",
            "ship", "shipping", "delivery", "giao hàng", "giao hang");

    private static void TryAddBadge(
        string lower,
        DialogueState dialogue,
        string badge,
        string[] aliases,
        List<Guid> ids)
    {
        var hit = aliases.Any(a => lower.Contains(a, StringComparison.Ordinal))
                  || lower.Contains(badge.ToLowerInvariant(), StringComparison.Ordinal);
        if (!hit)
            return;

        var item = dialogue.LastShown.FirstOrDefault(x =>
            string.Equals(x.Badge, badge, StringComparison.OrdinalIgnoreCase));
        if (item is not null && item.ProductId != Guid.Empty && !ids.Contains(item.ProductId))
            ids.Add(item.ProductId);
    }

    private static int WordToOrdinal(string word)
        => word switch
        {
            "first" or "1st" => 1,
            "second" or "2nd" => 2,
            "third" or "3rd" => 3,
            "fourth" or "4th" => 4,
            "fifth" or "5th" => 5,
            _ => 0
        };

    private static bool ContainsAny(string haystack, params string[] needles)
        => needles.Any(n => haystack.Contains(n, StringComparison.Ordinal));
}

/// <summary>Applies relative price/rating constraints from a follow-up decision onto slots.</summary>
public static class AiRelativeConstraints
{
    public static void Apply(FollowUpDecision decision, SlotState slots, DialogueState? dialogue)
    {
        if (decision.RelativeKind is null)
            return;

        var kind = decision.RelativeKind.Trim().ToLowerInvariant();
        var anchor = ResolveAnchorPrice(decision, dialogue, slots);

        switch (kind)
        {
            case "cheaper":
                if (anchor is decimal cheapAnchor && cheapAnchor > 0)
                {
                    slots.MaxPrice = Math.Floor(cheapAnchor * 0.9m);
                    slots.Sort = DiscoveryConstants.SortPriceAsc;
                }
                else if (slots.MaxPrice is decimal existingMax)
                {
                    slots.MaxPrice = Math.Floor(existingMax * 0.9m);
                    slots.Sort = DiscoveryConstants.SortPriceAsc;
                }
                else
                {
                    slots.Sort = DiscoveryConstants.SortPriceAsc;
                }

                break;

            case "premium":
                if (anchor is decimal premiumAnchor && premiumAnchor > 0)
                    slots.MinPrice = Math.Ceiling(premiumAnchor * 1.1m);
                break;

            case "rating":
            {
                var bump = ResolveFocusRating(decision, dialogue);
                var floor = bump is decimal r && r > 0
                    ? Math.Min(5m, Math.Round(r + 0.1m, 1, MidpointRounding.AwayFromZero))
                    : 4m;
                slots.MinRating = slots.MinRating is decimal existing
                    ? Math.Max(existing, floor)
                    : floor;
                if (string.IsNullOrWhiteSpace(slots.Sort))
                    slots.Sort = DiscoveryConstants.SortRating;
                break;
            }
        }
    }

    private static decimal? ResolveAnchorPrice(
        FollowUpDecision decision,
        DialogueState? dialogue,
        SlotState slots)
    {
        if (dialogue is null)
            return slots.MaxPrice;

        // Prefer focus product price from lastShown
        Guid? focusId = decision.FocusIds.Count > 0
            ? decision.FocusIds[0]
            : dialogue.FocusProductId;

        if (focusId is Guid fid && fid != Guid.Empty)
        {
            var focused = dialogue.LastShown.FirstOrDefault(x => x.ProductId == fid);
            if (focused is not null && focused.Price > 0)
                return focused.Price;
        }

        if (dialogue.LastShown.Count > 0)
        {
            var minShown = dialogue.LastShown.Where(x => x.Price > 0).Select(x => x.Price).DefaultIfEmpty().Min();
            if (minShown > 0)
                return minShown;
        }

        if (dialogue.AnchorPrice is decimal a && a > 0)
            return a;

        return slots.MaxPrice;
    }

    private static decimal? ResolveFocusRating(FollowUpDecision decision, DialogueState? dialogue)
    {
        if (dialogue is null)
            return null;

        Guid? focusId = decision.FocusIds.Count > 0
            ? decision.FocusIds[0]
            : dialogue.FocusProductId;

        if (focusId is Guid fid && fid != Guid.Empty)
        {
            var focused = dialogue.LastShown.FirstOrDefault(x => x.ProductId == fid);
            if (focused?.AvgRating is decimal r)
                return r;
        }

        return dialogue.LastShown
            .Where(x => x.AvgRating is not null)
            .Select(x => x.AvgRating!.Value)
            .DefaultIfEmpty()
            .Max();
    }
}

/// <summary>Contextual quick-reply chips after present / ambiguous clarify.</summary>
public static class AiDialogueQuickReplies
{
    public static IReadOnlyList<AiQuickReplyDto> AfterPresent(DialogueState dialogue)
    {
        var chips = new List<AiQuickReplyDto>
        {
            new()
            {
                Key = "act",
                Label = "Cheaper",
                Value = $"act:{AiFollowUpActs.RefineRelative}:cheaper"
            },
            new()
            {
                Key = "act",
                Label = "Other options",
                Value = $"act:{AiFollowUpActs.ShowMore}"
            }
        };

        if (dialogue.LastShown.Count >= 2)
        {
            chips.Add(new AiQuickReplyDto
            {
                Key = "act",
                Label = "Compare top 2",
                Value = $"act:compare:1,2"
            });
        }

        var hasBest = dialogue.LastShown.Any(x =>
            x.Ordinal == 1
            || string.Equals(x.Badge, AiConstants.ConsultBadgeBestMatch, StringComparison.OrdinalIgnoreCase));
        if (hasBest)
        {
            chips.Add(new AiQuickReplyDto
            {
                Key = "act",
                Label = "Why best match?",
                Value = $"act:{AiFollowUpActs.Explain}:ordinal:1"
            });
        }

        return chips;
    }

    public static IReadOnlyList<AiQuickReplyDto> AmbiguousClarify(DialogueState dialogue)
    {
        var chips = new List<AiQuickReplyDto>();
        foreach (var item in dialogue.LastShown.OrderBy(x => x.Ordinal))
        {
            var ordinal = item.Ordinal > 0 ? item.Ordinal : chips.Count + 1;
            var label = !string.IsNullOrWhiteSpace(item.Badge)
                ? $"#{ordinal} {item.Badge}"
                : $"#{ordinal}";
            chips.Add(new AiQuickReplyDto
            {
                Key = "act",
                Label = label,
                Value = $"act:clarify:ordinal:{ordinal.ToString(CultureInfo.InvariantCulture)}"
            });
        }

        return chips;
    }
}
