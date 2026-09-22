using System.Globalization;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.AI;

namespace AIDR.Modules.AI.Services;

/// <summary>Follow-up act taxonomy after products were presented.</summary>
public static class AiFollowUpActs
{
    public const string ShowMore = "show_more";
    public const string RefineFilter = "refine_filter";
    public const string RefineRelative = "refine_relative";
    public const string Explain = "explain";
    public const string FocusQa = "focus_qa";
    public const string CompareSet = "compare_set";
    public const string SelectFocus = "select_focus";
    public const string TopicSwitch = "topic_switch";
    public const string Restart = "restart";
    public const string InterruptFaq = "interrupt_faq";
    public const string CompatOrBundle = "compat_or_bundle";
    public const string OutOfScope = "out_of_scope";
    public const string Ambiguous = "ambiguous";
    public const string None = "none";
}

public sealed class FollowUpDecision
{
    public string Act { get; init; } = AiFollowUpActs.None;

    public IReadOnlyList<Guid> FocusIds { get; init; } = Array.Empty<Guid>();

    /// <summary>1-based ordinals parsed from the message or quick-reply.</summary>
    public IReadOnlyList<int> Ordinals { get; init; } = Array.Empty<int>();

    public bool NeedsClarify { get; init; }

    /// <summary>cheaper | premium | rating</summary>
    public string? RelativeKind { get; init; }

    public bool ClearShown { get; init; }

    public bool StrongFilterChange { get; init; }
}

/// <summary>
/// Classifies post-present follow-up acts and parses <c>act:</c> quick-reply chips.
/// Deterministic keyword heuristics (EN + VI) — no LLM.
/// </summary>
public static class AiFollowUpResolver
{
    /// <summary>
    /// Returns true when the follow-up path should run
    /// (consult stage presented, or lastShown non-empty, or focus set).
    /// </summary>
    public static bool IsFollowUpContext(ConsultState? consult, DialogueState? dialogue)
    {
        if (dialogue is not null)
        {
            if (dialogue.LastShown.Count > 0)
                return true;
            if (dialogue.FocusProductId is Guid f && f != Guid.Empty)
                return true;
        }

        return consult is not null
               && string.Equals(consult.Stage, AiConstants.ConsultStagePresented, StringComparison.Ordinal);
    }

    /// <summary>
    /// Parse quickReplyValue starting with <c>act:</c>.
    /// Formats: act:show_more | act:refine_relative:cheaper | act:explain:ordinal:1 |
    /// act:compare:1,2 | act:focus:ordinal:2 | act:restart | act:clarify:ordinal:2 | act:topic_switch
    /// </summary>
    public static FollowUpDecision? TryParseActQuickReply(string? quickReplyValue, DialogueState? dialogue)
    {
        if (string.IsNullOrWhiteSpace(quickReplyValue))
            return null;

        var raw = quickReplyValue.Trim();
        if (!raw.StartsWith("act:", StringComparison.OrdinalIgnoreCase))
            return null;

        var body = raw["act:".Length..].Trim();
        if (body.Length == 0)
            return null;

        var parts = body.Split(':', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0)
            return null;

        var head = parts[0].ToLowerInvariant();

        switch (head)
        {
            case "show_more":
                return new FollowUpDecision { Act = AiFollowUpActs.ShowMore };

            case "restart":
                return new FollowUpDecision
                {
                    Act = AiFollowUpActs.Restart,
                    ClearShown = true
                };

            case "topic_switch":
                return new FollowUpDecision
                {
                    Act = AiFollowUpActs.TopicSwitch,
                    ClearShown = true
                };

            case "refine_relative":
            {
                var kind = parts.Length >= 2 ? NormalizeRelativeKind(parts[1]) : "cheaper";
                return new FollowUpDecision
                {
                    Act = AiFollowUpActs.RefineRelative,
                    RelativeKind = kind,
                    FocusIds = FocusFromDialogue(dialogue)
                };
            }

            case "explain":
            {
                var ordinals = ParseOrdinalParts(parts);
                var ids = AiEntityResolver.ResolveFromOrdinals(ordinals, dialogue);
                if (ids.Count == 0 && dialogue?.LastShown is { Count: > 0 })
                {
                    ordinals = [1];
                    ids = AiEntityResolver.ResolveFromOrdinals(ordinals, dialogue);
                }

                return new FollowUpDecision
                {
                    Act = AiFollowUpActs.Explain,
                    Ordinals = ordinals,
                    FocusIds = ids
                };
            }

            case "compare":
            {
                // act:compare:1,2  — second segment may be "1,2"
                var ordinals = ParseCompareOrdinals(parts);
                var ids = AiEntityResolver.ResolveFromOrdinals(ordinals, dialogue);
                var needsClarify = ids.Count < AiConstants.MinCompareProducts;
                return new FollowUpDecision
                {
                    Act = needsClarify ? AiFollowUpActs.Ambiguous : AiFollowUpActs.CompareSet,
                    Ordinals = ordinals,
                    FocusIds = ids,
                    NeedsClarify = needsClarify
                };
            }

            case "focus":
            case "clarify":
            {
                var ordinals = ParseOrdinalParts(parts);
                var ids = AiEntityResolver.ResolveFromOrdinals(ordinals, dialogue);
                if (ids.Count == 0)
                {
                    return new FollowUpDecision
                    {
                        Act = AiFollowUpActs.Ambiguous,
                        Ordinals = ordinals,
                        NeedsClarify = true
                    };
                }

                return new FollowUpDecision
                {
                    Act = AiFollowUpActs.SelectFocus,
                    Ordinals = ordinals,
                    FocusIds = ids
                };
            }

            default:
                return null;
        }
    }

    /// <summary>Classify follow-up act from free text when already in follow-up context.</summary>
    public static FollowUpDecision Classify(
        string message,
        DialogueState? dialogue,
        AiChatContextDto? context,
        SlotState slots,
        SlotState? previousSlots,
        bool categoryChanged)
    {
        var lower = (message ?? string.Empty).ToLowerInvariant();
        var ordinals = AiEntityResolver.ParseOrdinals(message ?? string.Empty);
        var badgeIds = AiEntityResolver.ResolveBadgeMentions(lower, dialogue);
        var fromOrdinals = AiEntityResolver.ResolveFromOrdinals(ordinals, dialogue);
        var resolved = MergeIds(fromOrdinals, badgeIds);
        var pronoun = AiEntityResolver.ResolvePronoun(lower, dialogue, context);
        if (pronoun is Guid p && p != Guid.Empty && resolved.Count == 0)
            resolved = [p];

        // 1. restart
        if (ContainsAny(lower, "start over", "bắt đầu lại", "bat dau lai", "reset", "start again", "làm lại từ đầu", "lam lai tu dau"))
        {
            return new FollowUpDecision
            {
                Act = AiFollowUpActs.Restart,
                ClearShown = true
            };
        }

        // 2. out_of_scope (orders)
        if (ContainsAny(lower,
                "my order", "đơn hàng", "don hang", "where is my order", "track order",
                "order status", "theo dõi đơn", "theo doi don", "kiểm tra đơn", "kiem tra don"))
        {
            return new FollowUpDecision { Act = AiFollowUpActs.OutOfScope };
        }

        // 3. topic_switch
        if (categoryChanged
            || ContainsAny(lower,
                "instead find", "thôi tìm", "thoi tim", "khác hẳn", "khac han",
                "switch to headphones", "switch to phone", "switch to laptop", "switch to tablet",
                "tìm tai nghe", "tim tai nghe", "tìm điện thoại", "tim dien thoai",
                "something completely different", "khác đi", "khac di"))
        {
            return new FollowUpDecision
            {
                Act = AiFollowUpActs.TopicSwitch,
                ClearShown = true
            };
        }

        // 4. interrupt_faq — FAQ keywords without needing product focus
        if (LooksLikeFaq(lower) && !AiEntityResolver.HasDeixis(lower) && ordinals.Count == 0)
        {
            return new FollowUpDecision { Act = AiFollowUpActs.InterruptFaq };
        }

        // 5. compat_or_bundle
        if (ContainsAny(lower,
                "bundle", "buy with", "mua kèm", "mua kem", "compatible", "compatibility",
                "hợp với", "hop voi", "accessory", "accessories", "phụ kiện", "phu kien",
                "đi kèm", "di kem", "combo"))
        {
            var focus = resolved.Count > 0
                ? resolved
                : FocusFromDialogue(dialogue, context);
            return new FollowUpDecision
            {
                Act = AiFollowUpActs.CompatOrBundle,
                FocusIds = focus,
                Ordinals = ordinals,
                NeedsClarify = focus.Count == 0
            };
        }

        // 6. compare
        if (ContainsAny(lower, "compare", "vs", "versus", "so sánh", "so sanh", "which is better", "nên chọn", "nen chon"))
        {
            var compareIds = resolved.Count >= 2
                ? resolved
                : resolved.Count == 1 && dialogue?.FocusProductId is Guid f && f != Guid.Empty && f != resolved[0]
                    ? MergeIds(resolved, [f])
                    : ResolveCompareFallback(dialogue, context, resolved);

            if (compareIds.Count < AiConstants.MinCompareProducts
                && (dialogue?.LastShown.Count ?? 0) >= 2
                && ordinals.Count == 0
                && !AiEntityResolver.HasDeixis(lower)
                && ContainsAny(lower, "these", "them", "các cái này", "cac cai nay", "top 2", "hai cái", "hai cai"))
            {
                compareIds = AiEntityResolver.ResolveFromOrdinals([1, 2], dialogue);
                ordinals = [1, 2];
            }

            if (compareIds.Count < AiConstants.MinCompareProducts)
            {
                return new FollowUpDecision
                {
                    Act = AiFollowUpActs.Ambiguous,
                    Ordinals = ordinals,
                    FocusIds = compareIds,
                    NeedsClarify = true
                };
            }

            return new FollowUpDecision
            {
                Act = AiFollowUpActs.CompareSet,
                Ordinals = ordinals,
                FocusIds = compareIds.Take(AiConstants.MaxCompareProducts).ToList()
            };
        }

        // 7. explain
        if (ContainsAny(lower,
                "why", "sao chọn", "sao chon", "why this", "why best", "why the first",
                "why recommend", "vì sao", "vi sao", "tại sao chọn", "tai sao chon",
                "explain", "giải thích", "giai thich"))
        {
            var focus = resolved.Count > 0
                ? resolved
                : FocusFromDialogue(dialogue, context);
            if (focus.Count == 0 && (dialogue?.LastShown.Count ?? 0) > 0)
                focus = AiEntityResolver.ResolveFromOrdinals([1], dialogue);

            return new FollowUpDecision
            {
                Act = AiFollowUpActs.Explain,
                Ordinals = ordinals.Count > 0 ? ordinals : (focus.Count > 0 ? [1] : Array.Empty<int>()),
                FocusIds = focus
            };
        }

        // 8. select_focus
        if (LooksLikeSelectFocus(lower) || (ordinals.Count == 1 && ContainsAny(lower,
                "show me", "cho xem", "i like", "pick", "chọn", "chon", "xem", "open")))
        {
            if (resolved.Count == 1)
            {
                return new FollowUpDecision
                {
                    Act = AiFollowUpActs.SelectFocus,
                    Ordinals = ordinals,
                    FocusIds = resolved
                };
            }

            if (ordinals.Count > 0 && resolved.Count == 0)
            {
                // Out-of-range ordinal → clarify
                return new FollowUpDecision
                {
                    Act = AiFollowUpActs.Ambiguous,
                    Ordinals = ordinals,
                    NeedsClarify = true
                };
            }
        }

        // 9. show_more
        if (ContainsAny(lower,
                "other options", "còn cái khác", "con cai khac", "show more", "next options",
                "anything else", "còn lựa chọn", "con lua chon", "more options", "khác nữa", "khac nua",
                "còn gì nữa", "con gi nua", "see more", "thêm lựa chọn", "them lua chon"))
        {
            return new FollowUpDecision { Act = AiFollowUpActs.ShowMore };
        }

        // 10. refine_relative
        if (ContainsAny(lower, "cheaper", "rẻ hơn", "re hon", "cheapest", "giá thấp hơn", "gia thap hon", "rẻ nữa", "re nua"))
        {
            return new FollowUpDecision
            {
                Act = AiFollowUpActs.RefineRelative,
                RelativeKind = "cheaper",
                FocusIds = resolved.Count > 0 ? resolved : FocusFromDialogue(dialogue, context)
            };
        }

        if (ContainsAny(lower,
                "more expensive", "premium", "cao cấp", "cao cap", "đắt hơn", "dat hon",
                "step up", "higher end", "xịn hơn", "xin hon"))
        {
            return new FollowUpDecision
            {
                Act = AiFollowUpActs.RefineRelative,
                RelativeKind = "premium",
                FocusIds = resolved.Count > 0 ? resolved : FocusFromDialogue(dialogue, context)
            };
        }

        if (ContainsAny(lower,
                "higher rating", "better rating", "more stars", "từ 4 sao", "tu 4 sao",
                "rating cao", "đánh giá cao", "danh gia cao", "4 sao", "5 sao"))
        {
            return new FollowUpDecision
            {
                Act = AiFollowUpActs.RefineRelative,
                RelativeKind = "rating",
                FocusIds = resolved.Count > 0 ? resolved : FocusFromDialogue(dialogue, context)
            };
        }

        // 11. focus_qa
        if (AiEntityResolver.HasProductQaWords(lower)
            && (resolved.Count > 0
                || dialogue?.FocusProductId is not null
                || context?.ProductId is not null
                || AiEntityResolver.HasDeixis(lower)))
        {
            var focus = resolved.Count > 0
                ? resolved
                : FocusFromDialogue(dialogue, context);

            if (focus.Count == 0 && (dialogue?.LastShown.Count ?? 0) > 1 && AiEntityResolver.HasDeixis(lower))
            {
                return new FollowUpDecision
                {
                    Act = AiFollowUpActs.Ambiguous,
                    NeedsClarify = true
                };
            }

            if (focus.Count > 0)
            {
                return new FollowUpDecision
                {
                    Act = AiFollowUpActs.FocusQa,
                    Ordinals = ordinals,
                    FocusIds = focus
                };
            }
        }

        // Also FAQ-with-deixis → focus_qa if we can resolve, else interrupt_faq later skipped
        if (LooksLikeFaq(lower) && (resolved.Count > 0 || dialogue?.FocusProductId is not null))
        {
            return new FollowUpDecision
            {
                Act = AiFollowUpActs.FocusQa,
                FocusIds = resolved.Count > 0 ? resolved : FocusFromDialogue(dialogue, context),
                Ordinals = ordinals
            };
        }

        // 12. refine_filter — slot delta looks like hard filter refine
        var strong = IsStrongFilterChange(slots, previousSlots, categoryChanged);
        if (LooksLikeRefineFilter(lower, slots, previousSlots))
        {
            return new FollowUpDecision
            {
                Act = AiFollowUpActs.RefineFilter,
                StrongFilterChange = strong,
                ClearShown = strong
            };
        }

        // 13. deixis without clear act
        if (AiEntityResolver.HasDeixis(lower))
        {
            var shownCount = dialogue?.LastShown.Count ?? 0;
            var hasFocus = dialogue?.FocusProductId is Guid gf && gf != Guid.Empty;

            if (shownCount == 1 || hasFocus || resolved.Count == 1)
            {
                var focus = resolved.Count > 0
                    ? resolved
                    : FocusFromDialogue(dialogue, context);

                if (AiEntityResolver.HasProductQaWords(lower))
                {
                    return new FollowUpDecision
                    {
                        Act = AiFollowUpActs.FocusQa,
                        FocusIds = focus,
                        Ordinals = ordinals
                    };
                }

                return new FollowUpDecision
                {
                    Act = AiFollowUpActs.SelectFocus,
                    FocusIds = focus,
                    Ordinals = ordinals
                };
            }

            if (shownCount > 1 && ordinals.Count == 0 && resolved.Count == 0)
            {
                return new FollowUpDecision
                {
                    Act = AiFollowUpActs.Ambiguous,
                    NeedsClarify = true
                };
            }
        }

        // Out-of-range ordinal alone
        if (ordinals.Count > 0 && resolved.Count == 0 && (dialogue?.LastShown.Count ?? 0) > 0)
        {
            return new FollowUpDecision
            {
                Act = AiFollowUpActs.Ambiguous,
                Ordinals = ordinals,
                NeedsClarify = true
            };
        }

        // 14. none — caller falls back to normal intent
        return new FollowUpDecision { Act = AiFollowUpActs.None };
    }

    // --- helpers ---

    private static IReadOnlyList<int> ParseOrdinalParts(string[] parts)
    {
        // act:explain:ordinal:1  or act:focus:ordinal:2
        for (var i = 0; i < parts.Length; i++)
        {
            if (parts[i].Equals("ordinal", StringComparison.OrdinalIgnoreCase)
                && i + 1 < parts.Length
                && int.TryParse(parts[i + 1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var n)
                && n > 0)
            {
                return [n];
            }
        }

        // trailing number
        if (parts.Length >= 2
            && int.TryParse(parts[^1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var last)
            && last > 0)
        {
            return [last];
        }

        return Array.Empty<int>();
    }

    private static IReadOnlyList<int> ParseCompareOrdinals(string[] parts)
    {
        if (parts.Length < 2)
            return Array.Empty<int>();

        var segment = string.Join(":", parts.Skip(1));
        var found = new SortedSet<int>();
        foreach (var token in segment.Split([',', '&', ' ', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (int.TryParse(token, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) && n > 0)
                found.Add(n);
        }

        return found.ToList();
    }

    private static string NormalizeRelativeKind(string raw)
    {
        var k = raw.Trim().ToLowerInvariant();
        return k switch
        {
            "cheaper" or "cheap" or "budget" => "cheaper",
            "premium" or "expensive" or "stepup" or "step_up" => "premium",
            "rating" or "stars" or "score" => "rating",
            _ => "cheaper"
        };
    }

    private static IReadOnlyList<Guid> FocusFromDialogue(
        DialogueState? dialogue,
        AiChatContextDto? context = null)
    {
        if (dialogue?.FocusProductId is Guid f && f != Guid.Empty)
            return [f];
        if (dialogue?.LastShown is { Count: 1 } one && one[0].ProductId != Guid.Empty)
            return [one[0].ProductId];
        if (context?.ProductId is Guid pdp && pdp != Guid.Empty)
            return [pdp];
        return Array.Empty<Guid>();
    }

    private static IReadOnlyList<Guid> ResolveCompareFallback(
        DialogueState? dialogue,
        AiChatContextDto? context,
        IReadOnlyList<Guid> resolved)
    {
        var ids = new List<Guid>(resolved);
        if (context?.CompareProductIds is { Count: > 0 } tray)
        {
            foreach (var id in tray.Where(x => x != Guid.Empty))
            {
                if (!ids.Contains(id))
                    ids.Add(id);
            }
        }

        if (ids.Count < AiConstants.MinCompareProducts && dialogue?.CompareCandidateIds is { Count: > 0 } cands)
        {
            foreach (var id in cands.Where(x => x != Guid.Empty))
            {
                if (!ids.Contains(id))
                    ids.Add(id);
            }
        }

        if (ids.Count < AiConstants.MinCompareProducts && dialogue?.LastShown is { Count: >= 2 } shown)
        {
            foreach (var item in shown.OrderBy(x => x.Ordinal).Take(AiConstants.MaxCompareProducts))
            {
                if (item.ProductId != Guid.Empty && !ids.Contains(item.ProductId))
                    ids.Add(item.ProductId);
            }
        }

        return ids;
    }

    private static IReadOnlyList<Guid> MergeIds(IReadOnlyList<Guid> a, IReadOnlyList<Guid> b)
    {
        var list = new List<Guid>();
        foreach (var id in a.Concat(b))
        {
            if (id != Guid.Empty && !list.Contains(id))
                list.Add(id);
        }

        return list;
    }

    private static bool LooksLikeSelectFocus(string lower)
        => ContainsAny(lower,
            "show me the second", "show me the first", "show me the third",
            "cho xem cái thứ", "cho xem cai thu", "i like #", "i like the",
            "pick the first", "pick the second", "pick #",
            "tôi thích cái", "toi thich cai", "xem máy đó", "xem may do",
            "focus on", "chọn cái thứ", "chon cai thu");

    private static bool LooksLikeFaq(string lower)
    {
        if (ContainsAny(lower, "return", "refund", "trả hàng", "tra hang", "hoàn tiền", "hoan tien"))
            return true;
        if (ContainsAny(lower, "shipping", "delivery", "vận chuyển", "van chuyen", "giao hàng", "giao hang")
            && !ContainsAny(lower, "còn hàng", "con hang", "in stock"))
            return true;
        if (ContainsAny(lower, "payment", "payos", "thanh toán", "thanh toan", "checkout")
            && !ContainsAny(lower, "voucher", "coupon"))
            return true;
        if (ContainsAny(lower, "voucher", "coupon", "discount", "mã giảm", "ma giam", "khuyến mãi", "khuyen mai"))
            return true;
        if (ContainsAny(lower, "warranty policy", "bảo hành như", "bao hanh nhu", "how does warranty")
            || (ContainsAny(lower, "warranty", "bảo hành", "bao hanh")
                && ContainsAny(lower, "how", "policy", "work", "như thế", "nhu the", "đổi trả", "doi tra")))
            return true;
        return false;
    }

    private static bool LooksLikeRefineFilter(string lower, SlotState slots, SlotState? previousSlots)
    {
        if (previousSlots is null)
            return false;

        var brandChanged = !string.Equals(slots.Brand, previousSlots.Brand, StringComparison.OrdinalIgnoreCase)
                           && !string.IsNullOrWhiteSpace(slots.Brand);
        var priceChanged = slots.MinPrice != previousSlots.MinPrice || slots.MaxPrice != previousSlots.MaxPrice;
        var ratingChanged = slots.MinRating != previousSlots.MinRating;
        var categoryChanged = slots.CategoryId != previousSlots.CategoryId;

        if (brandChanged || priceChanged || ratingChanged || categoryChanged)
            return true;

        return ContainsAny(lower,
            "only", "chỉ", "chi", "under", "dưới", "duoi", "above", "trên", "tren",
            "from", "từ", "tu", "brand", "hãng", "hang", "filter", "lọc", "loc");
    }

    private static bool IsStrongFilterChange(SlotState slots, SlotState? previousSlots, bool categoryChanged)
    {
        if (categoryChanged)
            return true;
        if (previousSlots is null)
            return false;

        if (!string.Equals(slots.Brand ?? string.Empty, previousSlots.Brand ?? string.Empty, StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(slots.Brand))
            return true;

        if (slots.CategoryId != previousSlots.CategoryId && slots.CategoryId is not null)
            return true;

        // Large budget swing (>30% on max)
        if (slots.MaxPrice is decimal nextMax && previousSlots.MaxPrice is decimal prevMax && prevMax > 0)
        {
            var ratio = nextMax / prevMax;
            if (ratio < 0.7m || ratio > 1.3m)
                return true;
        }

        if (slots.MaxPrice is not null && previousSlots.MaxPrice is null && slots.MinPrice is null)
            return false; // soft first budget — still may clear via relative path

        return false;
    }

    private static bool ContainsAny(string haystack, params string[] needles)
        => needles.Any(n => haystack.Contains(n, StringComparison.Ordinal));
}
