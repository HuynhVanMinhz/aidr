using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;

namespace AIDR.Modules.AI.Services;

public sealed class AiShoppingAssistantService : IAiShoppingAssistantService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly ILlmClient _llm;
    private readonly IAiCatalogRepository _catalog;
    private readonly IAiConversationRepository _conversations;
    private readonly IAiNlFilterService _nlFilter;
    private readonly IRecommendationService _recommendations;
    private readonly IAiCompareService _compare;
    private readonly ILogger<AiShoppingAssistantService> _logger;

    /// <summary>Cap on products remembered per round for "show me other options".</summary>
    private const int MaxTrackedShownIds = 30;

    public AiShoppingAssistantService(
        ILlmClient llm,
        IAiCatalogRepository catalog,
        IAiConversationRepository conversations,
        IAiNlFilterService nlFilter,
        IRecommendationService recommendations,
        IAiCompareService compare,
        ILogger<AiShoppingAssistantService> logger)
    {
        _llm = llm;
        _catalog = catalog;
        _conversations = conversations;
        _nlFilter = nlFilter;
        _recommendations = recommendations;
        _compare = compare;
        _logger = logger;
    }

    public async Task<AiChatResultDto> ChatAsync(
        Guid userId,
        AiChatRequest request,
        CancellationToken cancellationToken = default)
    {
        var message = (request.Message ?? string.Empty).Trim();
        if (message.Length < AiConstants.MinChatMessageLength)
            throw new AppException("Message is required.");
        if (message.Length > AiConstants.MaxChatMessageLength)
            throw new AppException($"Message must be at most {AiConstants.MaxChatMessageLength} characters.");

        var context = NormalizeContext(request.Context);

        AiConversationRecord conversation;
        if (request.ConversationId is Guid existingId && existingId != Guid.Empty)
        {
            var owned = await _conversations.GetOwnedConversationAsync(userId, existingId, cancellationToken);
            if (owned is null)
                throw new NotFoundException("Conversation was not found.");
            if (!string.Equals(owned.Channel, AiConstants.ChannelShoppingAssistant, StringComparison.Ordinal))
                throw new AppException("Conversation channel is not supported for chat.");
            conversation = owned;
        }
        else
        {
            conversation = await _conversations.CreateConversationAsync(
                userId,
                AiConstants.ChannelShoppingAssistant,
                BuildTitle(message),
                cancellationToken);
        }

        var history = await _conversations.GetRecentMessagesAsync(
            conversation.ConversationId,
            AiConstants.MaxChatHistoryMessages,
            cancellationToken);

        var previousMeta = FindLastAssistantMeta(history);
        var previousSlots = FromSlotsDto(previousMeta?.Slots);
        var previousProductIds = previousMeta?.ProductIds ?? Array.Empty<Guid>();

        var categories = await _catalog.GetActiveCategoriesAsync(cancellationToken);
        var consult = previousMeta?.Consult;

        // A tapped chip is authoritative - it never goes through NLU, and its label must not
        // be re-read as free text ("Not sure" skips one slot, it does not end the round).
        var quickReply = AiConsultQuestionBank.ParseQuickReply(request.QuickReplyValue);

        SlotState slots;
        if (quickReply is null)
        {
            var nl = await _nlFilter.ParseAsync(new NlFilterRequest { Query = message }, cancellationToken);
            slots = MergeSlots(previousSlots, nl, message, previousProductIds);
        }
        else
        {
            // Carry the remembered filters forward untouched: parsing the chip's own label
            // would let "Gaming" drag a laptop shopper over to Gaming Gear.
            slots = previousSlots is null ? new SlotState() : CloneSlots(previousSlots);
        }

        bool skipRequested;
        if (quickReply is not null)
        {
            consult ??= new ConsultState();
            skipRequested = ApplyQuickReply(quickReply.Value, slots, consult, categories);
        }
        else
        {
            skipRequested = LooksLikeSkipQuestions(message);
        }

        await PromoteToStockedCategoryAsync(slots, categories, cancellationToken);
        var group = AiConsultQuestionBank.ResolveGroup(slots.CategoryId, categories);

        var intent = quickReply is not null
            ? AiConstants.IntentRecommend
            : ClassifyIntent(message, context, previousSlots, slots, previousProductIds);
        if (intent == AiConstants.IntentClarify && HasUsefulSlots(slots))
            intent = AiConstants.IntentRecommend;

        // A support question is not a product keyword - keep it out of the remembered filters.
        if (intent is AiConstants.IntentFaq or AiConstants.IntentSmalltalk)
            slots.Q = previousSlots?.Q;

        // Interruption: the buyer asked something else mid-consultation. Answer it, then
        // resume the pending question at the end of the same reply without spending budget.
        var pendingQuestion = intent is AiConstants.IntentFaq
            or AiConstants.IntentProductQa
            or AiConstants.IntentSmalltalk
            ? await RebuildPendingQuestionAsync(consult, slots, group, categories, cancellationToken)
            : null;

        ConsultDecision? decision = null;
        if (pendingQuestion is null && AiConsultPlanner.IsEligibleIntent(intent))
        {
            var categoryChanged = quickReply is null
                                  && HasSwitchedShelf(previousSlots?.CategoryId, slots.CategoryId, categories);

            // Clear the old shelf's slots before planning, so the count and the price bands
            // below describe the shelf the buyer just moved to.
            if (categoryChanged)
            {
                ClearCategoryBoundSlots(slots);
                await DropBudgetIfItDoesNotFitShelfAsync(slots, consult, cancellationToken);
                group = AiConsultQuestionBank.ResolveGroup(slots.CategoryId, categories);
            }

            var candidateCount = await _catalog.CountApprovedProductsAsync(
                ToShelfQuery(slots),
                cancellationToken);

            var bands = AiConsultPlanner.MayAskBudget(consult, slots)
                ? await _catalog.GetPriceBandsAsync(ToBandScope(slots), cancellationToken)
                : AiPriceBands.Empty;

            decision = AiConsultPlanner.Plan(new ConsultPlanInput
            {
                Previous = consult,
                Slots = slots,
                SkipRequested = skipRequested,
                CategoryChanged = categoryChanged,
                FocusedOnProduct = context?.ProductId is not null
                                   && LooksLikeAlternatives(message.ToLowerInvariant()),
                CandidateCount = candidateCount,
                Group = group,
                Bands = bands,
                Categories = categories
            });

            consult = decision.State;
        }

        if (decision is { ShouldAsk: true, Question: not null })
        {
            var (questionReply, questionSource) = await BuildQuestionReplyAsync(
                decision.Question,
                slots,
                history,
                message,
                cancellationToken);

            return await PersistTurnAsync(
                conversation,
                message,
                questionReply,
                AiConstants.IntentClarify,
                slots,
                consult,
                Array.Empty<AiSuggestedProductDto>(),
                new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase),
                Array.Empty<AiChatActionDto>(),
                AiConsultPlanner.ToQuickReplies(decision.Question),
                questionSource,
                cancellationToken);
        }

        var pack = await BuildGroundedPackAsync(
            userId,
            intent,
            message,
            slots,
            context,
            previousProductIds,
            categories,
            cancellationToken);

        // After a consultation, present a small structured set (best / cheaper / step up)
        // instead of a flat result list, and let the LLM cite only those.
        IReadOnlyList<RankedProduct> ranked = Array.Empty<RankedProduct>();
        if (decision is { ShouldAsk: false }
            && pack.Products.Count > 0
            && intent is AiConstants.IntentRecommend or AiConstants.IntentRefine or AiConstants.IntentBrowse)
        {
            // A consultation answers with a structured trio; open-ended browsing keeps breadth.
            var presentCount = intent == AiConstants.IntentBrowse
                ? AiConstants.MaxSuggestedProducts
                : AiConstants.ConsultPresentCount;

            ranked = AiProductRanker.Rank(
                pack.Products,
                slots,
                consult,
                group,
                presentCount);
            if (ranked.Count > 0)
                pack = pack.WithProducts(ranked.Select(r => r.Product).ToList());
        }

        string reply;
        string source;
        IReadOnlyList<AiCompareProductRecord> suggested;
        Dictionary<string, string> reasons;
        IReadOnlyList<AiChatActionDto> actions;

        // With nothing to cite, a shopping turn must say the catalog is empty - left to the
        // model it answers with generic buying advice that reads like a recommendation.
        var nothingToRecommend = pack.Products.Count == 0
            && intent is AiConstants.IntentRecommend
                or AiConstants.IntentRefine
                or AiConstants.IntentBrowse;

        if (_llm.UseMock || nothingToRecommend)
        {
            (reply, suggested, reasons, actions) = BuildHeuristicOutcome(intent, message, pack, slots, context);
            source = AiConstants.SourceHeuristic;
        }
        else
        {
            var llmResult = await TryLlmReplyAsync(message, history, intent, slots, consult, pack, cancellationToken);
            if (llmResult is null)
            {
                _logger.LogInformation("Shopping assistant falling back to heuristic (no Groq response).");
                (reply, suggested, reasons, actions) = BuildHeuristicOutcome(intent, message, pack, slots, context);
                source = AiConstants.SourceHeuristic;
            }
            else
            {
                reply = llmResult.Value.Reply;
                source = AiConstants.SourceGroq;
                suggested = ResolveSuggestedProducts(llmResult.Value.ProductIds, pack.Products);
                if (suggested.Count == 0
                    && pack.Products.Count > 0
                    && intent is AiConstants.IntentRecommend
                        or AiConstants.IntentRefine
                        or AiConstants.IntentBrowse
                        or AiConstants.IntentProductQa
                        or AiConstants.IntentCompare)
                {
                    suggested = pack.Products.Take(AiConstants.MaxSuggestedProducts).ToList();
                }

                reasons = FilterReasons(llmResult.Value.Reasons, suggested);
                actions = SanitizeActions(llmResult.Value.Actions, suggested, slots, intent);
                if (actions.Count == 0)
                    actions = DefaultActions(intent, suggested, slots);
            }
        }

        if (intent is AiConstants.IntentFaq or AiConstants.IntentClarify or AiConstants.IntentSmalltalk)
        {
            if (intent != AiConstants.IntentProductQa)
                suggested = Array.Empty<AiCompareProductRecord>();
        }

        // On a consultation turn the ranker already chose the structured set (best / cheaper /
        // step up) and every pick is grounded. The model writes the prose, not the shortlist -
        // otherwise two questions can end in a single card.
        if (ranked.Count > 0 && suggested.Count < ranked.Count && intent != AiConstants.IntentBrowse)
            suggested = ranked.Select(r => r.Product).ToList();

        var rankedById = ranked.ToDictionary(r => r.Product.ProductId);
        var suggestedDtos = suggested
            .Select(p =>
            {
                var key = p.ProductId.ToString("D");
                rankedById.TryGetValue(p.ProductId, out var rank);
                // The ranker's reason is assembled from catalog fields, so it beats both the
                // model's prose and the generic heuristic line whenever the product was ranked.
                var reason = !string.IsNullOrWhiteSpace(rank?.Reason)
                    ? rank!.Reason
                    : reasons.GetValueOrDefault(key);
                return MapSuggested(p, reason, rank?.Badge);
            })
            .ToList();

        // Persist ranker reasons too, so reopening the conversation keeps them.
        foreach (var dto in suggestedDtos)
        {
            if (!string.IsNullOrWhiteSpace(dto.Reason))
                reasons[dto.ProductId.ToString("D")] = dto.Reason!;
        }

        // Never silently return results that miss the buyer's stated constraints.
        if (pack.Relaxed.Count > 0)
            reply = BuildRelaxNote(pack.Relaxed) + Environment.NewLine + Environment.NewLine + reply;

        IReadOnlyList<AiQuickReplyDto> quickReplies = Array.Empty<AiQuickReplyDto>();
        if (pendingQuestion is not null && consult is not null)
        {
            reply = reply.TrimEnd()
                    + Environment.NewLine + Environment.NewLine
                    + "Back to your search - " + pendingQuestion.Text;
            quickReplies = AiConsultPlanner.ToQuickReplies(pendingQuestion);
        }

        if (consult is not null)
        {
            consult.Relaxed = pack.Relaxed.ToList();
            foreach (var dto in suggestedDtos)
            {
                if (!consult.ShownIds.Contains(dto.ProductId))
                    consult.ShownIds.Add(dto.ProductId);
            }

            if (consult.ShownIds.Count > MaxTrackedShownIds)
                consult.ShownIds = consult.ShownIds.TakeLast(MaxTrackedShownIds).ToList();
        }

        return await PersistTurnAsync(
            conversation,
            message,
            reply,
            intent,
            slots,
            consult,
            suggestedDtos,
            reasons,
            actions,
            quickReplies,
            source,
            cancellationToken);
    }

    /// <summary>Single exit point for a chat turn: build meta, append, title, map result.</summary>
    private async Task<AiChatResultDto> PersistTurnAsync(
        AiConversationRecord conversation,
        string message,
        string reply,
        string intent,
        SlotState slots,
        ConsultState? consult,
        IReadOnlyList<AiSuggestedProductDto> suggested,
        Dictionary<string, string> reasons,
        IReadOnlyList<AiChatActionDto> actions,
        IReadOnlyList<AiQuickReplyDto> quickReplies,
        string source,
        CancellationToken cancellationToken)
    {
        var metaJson = BuildMetaJson(intent, slots, consult, suggested, reasons, actions, quickReplies, source);
        var (userMsg, assistantMsg) = await _conversations.AppendTurnAsync(
            conversation.ConversationId,
            message,
            reply,
            metaJson,
            cancellationToken);

        var title = conversation.Title;
        if (string.IsNullOrWhiteSpace(title))
        {
            title = BuildTitle(message);
            await _conversations.UpdateConversationTitleAsync(
                conversation.ConversationId,
                title,
                cancellationToken);
        }

        return new AiChatResultDto
        {
            ConversationId = conversation.ConversationId,
            Title = title,
            UserMessage = MapMessage(userMsg),
            AssistantMessage = MapMessage(assistantMsg, suggested),
            SuggestedProducts = suggested,
            Source = source,
            Intent = intent,
            Slots = ToSlotsDto(slots),
            Actions = actions,
            QuickReplies = quickReplies,
            Consult = consult is null ? null : AiConsultPlanner.ToDto(consult)
        };
    }

    public Task<PagedResult<AiConversationSummaryDto>> ListConversationsAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var (p, size) = AiConstants.NormalizeConversationPaging(page, pageSize);
        return _conversations.ListConversationsAsync(
            userId,
            AiConstants.ChannelShoppingAssistant,
            p,
            size,
            cancellationToken);
    }

    public async Task<AiConversationDetailDto> GetConversationAsync(
        Guid userId,
        Guid conversationId,
        CancellationToken cancellationToken = default)
    {
        var detail = await _conversations.GetConversationAsync(userId, conversationId, cancellationToken);
        if (detail is null)
            throw new NotFoundException("Conversation was not found.");

        var productIds = new HashSet<Guid>();
        var metaByMessage = new Dictionary<long, ChatMetaPayload>();
        foreach (var m in detail.Messages)
        {
            if (m.Role != AiConstants.RoleAssistant || string.IsNullOrWhiteSpace(m.MetaJson))
                continue;
            var meta = TryParseMeta(m.MetaJson);
            if (meta is null)
                continue;
            metaByMessage[m.AiMessageId] = meta;
            foreach (var id in meta.ProductIds ?? Array.Empty<Guid>())
                productIds.Add(id);
        }

        IReadOnlyDictionary<Guid, AiCompareProductRecord> byId =
            productIds.Count == 0
                ? new Dictionary<Guid, AiCompareProductRecord>()
                : (await _catalog.GetApprovedProductsByIdsAsync(productIds.ToList(), cancellationToken))
                    .ToDictionary(p => p.ProductId);

        var hydrated = detail.Messages.Select(m =>
        {
            if (!metaByMessage.TryGetValue(m.AiMessageId, out var meta) || meta.ProductIds is null)
                return m;

            var products = meta.ProductIds
                .Where(id => byId.ContainsKey(id))
                .Select(id =>
                {
                    var key = id.ToString("D");
                    var reason = meta.Reasons != null && meta.Reasons.TryGetValue(key, out var r)
                        ? r
                        : null;
                    var badge = meta.Badges != null && meta.Badges.TryGetValue(key, out var b)
                        ? b
                        : null;
                    return MapSuggested(byId[id], reason, badge);
                })
                .ToList();

            return new AiMessageDto
            {
                AiMessageId = m.AiMessageId,
                Role = m.Role,
                Content = m.Content,
                MetaJson = m.MetaJson,
                CreatedAt = m.CreatedAt,
                SuggestedProducts = products
            };
        }).ToList();

        return new AiConversationDetailDto
        {
            ConversationId = detail.ConversationId,
            Channel = detail.Channel,
            Title = detail.Title,
            CreatedAt = detail.CreatedAt,
            UpdatedAt = detail.UpdatedAt,
            Messages = hydrated
        };
    }

    private async Task<GroundedPack> BuildGroundedPackAsync(
        Guid userId,
        string intent,
        string message,
        SlotState slots,
        AiChatContextDto? context,
        IReadOnlyList<Guid> previousProductIds,
        IReadOnlyList<AiCategoryLookup> categories,
        CancellationToken cancellationToken)
    {
        var products = new List<AiCompareProductRecord>();
        var relaxed = (IReadOnlyList<string>)Array.Empty<string>();
        string? faqTopic = null;
        string? faqText = null;
        string? compareSummary = null;
        IReadOnlyList<string> compareHighlights = Array.Empty<string>();
        string? focusNotes = null;

        switch (intent)
        {
            case AiConstants.IntentFaq:
                faqTopic = DetectFaqTopic(message);
                faqText = ResolveFaqText(faqTopic);
                break;

            case AiConstants.IntentProductQa:
            {
                var focusId = context?.ProductId;
                if (focusId is Guid pid && pid != Guid.Empty)
                {
                    products = (await _catalog.GetApprovedProductsByIdsAsync([pid], cancellationToken)).ToList();
                    if (products.Count > 0)
                        focusNotes = BuildProductQaNotes(products[0]);
                }

                if (products.Count == 0 && LooksLikeAlternatives(message) && context?.ProductId is Guid sid)
                {
                    var similar = await _recommendations.GetSimilarProductsAsync(
                        sid,
                        new SimilarProductsQueryRequest { Limit = AiConstants.CatalogContextProductLimit },
                        cancellationToken);
                    var ids = similar.Select(s => s.ProductId).ToList();
                    products = (await _catalog.GetApprovedProductsByIdsAsync(ids, cancellationToken)).ToList();
                }

                break;
            }

            case AiConstants.IntentCompare:
            {
                var compareIds = ResolveCompareIds(message, context, previousProductIds);
                if (compareIds.Count >= AiConstants.MinCompareProducts)
                {
                    try
                    {
                        var compareResult = await _compare.CompareAsync(
                            new CompareProductsRequest { ProductIds = compareIds.ToList() },
                            cancellationToken);
                        compareSummary = compareResult.Summary;
                        compareHighlights = compareResult.Highlights;
                        products = (await _catalog.GetApprovedProductsByIdsAsync(
                            compareResult.Products.Select(p => p.ProductId).ToList(),
                            cancellationToken)).ToList();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogInformation(ex, "Compare tool failed; falling back to catalog ids.");
                        products = (await _catalog.GetApprovedProductsByIdsAsync(compareIds, cancellationToken))
                            .ToList();
                    }
                }
                else if (previousProductIds.Count > 0)
                {
                    products = (await _catalog.GetApprovedProductsByIdsAsync(
                        previousProductIds.Take(AiConstants.MaxSuggestedProducts).ToList(),
                        cancellationToken)).ToList();
                }

                break;
            }

            case AiConstants.IntentBrowse:
            {
                var recs = await _recommendations.GetRecommendationsAsync(
                    userId,
                    new RecommendationQueryRequest { Page = 1, PageSize = AiConstants.CatalogContextProductLimit },
                    cancellationToken);
                var ids = recs.Items.Select(i => i.ProductId).ToList();
                products = (await _catalog.GetApprovedProductsByIdsAsync(ids, cancellationToken)).ToList();
                break;
            }

            case AiConstants.IntentClarify:
            case AiConstants.IntentSmalltalk:
                break;

            default:
            {
                // recommend / refine
                if (LooksLikeAlternatives(message) && context?.ProductId is Guid similarOf)
                {
                    var similar = await _recommendations.GetSimilarProductsAsync(
                        similarOf,
                        new SimilarProductsQueryRequest { Limit = AiConstants.CatalogContextProductLimit },
                        cancellationToken);
                    products = (await _catalog.GetApprovedProductsByIdsAsync(
                        similar.Select(s => s.ProductId).ToList(),
                        cancellationToken)).ToList();
                }
                else if (HasUsefulSlots(slots))
                {
                    var search = await SearchWithRelaxAsync(slots, categories, cancellationToken);
                    products = search.Products.ToList();
                    relaxed = search.Relaxed;
                }
                else
                {
                    var recs = await _recommendations.GetRecommendationsAsync(
                        userId,
                        new RecommendationQueryRequest
                        {
                            Page = 1,
                            PageSize = AiConstants.CatalogContextProductLimit
                        },
                        cancellationToken);
                    products = (await _catalog.GetApprovedProductsByIdsAsync(
                        recs.Items.Select(i => i.ProductId).ToList(),
                        cancellationToken)).ToList();
                }

                break;
            }
        }

        return new GroundedPack
        {
            Products = products,
            Relaxed = relaxed,
            FaqTopic = faqTopic,
            FaqText = faqText,
            CompareSummary = compareSummary,
            CompareHighlights = compareHighlights,
            FocusNotes = focusNotes
        };
    }

    /// <summary>
    /// Search by slots, relaxing one constraint at a time when nothing matches, and reporting
    /// what was dropped so the reply can say it out loud instead of silently returning misfits.
    /// </summary>
    private async Task<(IReadOnlyList<AiCompareProductRecord> Products, IReadOnlyList<string> Relaxed)>
        SearchWithRelaxAsync(
            SlotState slots,
            IReadOnlyList<AiCategoryLookup> categories,
            CancellationToken cancellationToken)
    {
        // Relax INFERRED constraints before STATED ones. The NL parser guesses the keyword and
        // often over-narrows the category (a "Samsung phone" query lands on an empty "Samsung
        // Galaxy" shelf); those guesses must give way before we throw out the brand or the
        // budget the buyer actually typed.
        var current = CloneSlots(slots);
        var relaxed = new List<string>();

        var hits = await SearchAsync(current, cancellationToken);
        if (hits.Count > 0)
            return (hits, relaxed);

        // 1. Minimum rating - the weakest stated preference.
        if (current.MinRating is not null)
        {
            current.MinRating = null;
            relaxed.Add("the minimum rating");
            hits = await SearchAsync(current, cancellationToken);
            if (hits.Count > 0)
                return (hits, relaxed);
        }

        // 2. Derived keyword - dropped silently, the buyer never stated it.
        if (!string.IsNullOrWhiteSpace(current.Q))
        {
            current.Q = null;
            hits = await SearchAsync(current, cancellationToken);
            if (hits.Count > 0)
                return (hits, relaxed);
        }

        // 3. Widen up the category tree. Never clear it outright: someone shopping for gaming
        //    laptops may be shown laptops, but must never be shown phones.
        var node = categories.FirstOrDefault(c => c.CategoryId == current.CategoryId);
        var guard = 0;
        while (node?.ParentId is int parentId && guard++ < 4)
        {
            var parent = categories.FirstOrDefault(c => c.CategoryId == parentId);
            if (parent is null)
                break;

            relaxed.Add($"the {node.Name} filter, showing all {parent.Name}");
            current.CategoryId = parent.CategoryId;
            current.CategoryName = parent.Name;
            node = parent;

            hits = await SearchAsync(current, cancellationToken);
            if (hits.Count > 0)
                return (hits, relaxed);
        }

        // 4. Budget - stated, so widen rather than drop, and say by how much. The floor goes
        //    entirely: a minimum price is a hint, never a requirement, and an inherited one
        //    can make a whole shelf unmatchable.
        if (current.MaxPrice is decimal max && max > 0)
        {
            current.MaxPrice = Math.Round(max * 1.2m, 0, MidpointRounding.AwayFromZero);
            current.MinPrice = null;
            relaxed.Add(string.Format(
                CultureInfo.InvariantCulture, "the budget up to {0:#,0} VND", current.MaxPrice));
            hits = await SearchAsync(current, cancellationToken);
            if (hits.Count > 0)
                return (hits, relaxed);
        }
        else if (current.MinPrice is not null)
        {
            current.MinPrice = null;
            relaxed.Add("the minimum price");
            hits = await SearchAsync(current, cancellationToken);
            if (hits.Count > 0)
                return (hits, relaxed);
        }

        // 5. Brand - the strongest stated preference, given up last.
        if (!string.IsNullOrWhiteSpace(current.Brand))
        {
            relaxed.Add($"the {current.Brand} brand filter");
            current.Brand = null;
            hits = await SearchAsync(current, cancellationToken);
            if (hits.Count > 0)
                return (hits, relaxed);
        }

        // Nothing at any width - say so honestly rather than reporting phantom relaxations.
        return (Array.Empty<AiCompareProductRecord>(), Array.Empty<string>());
    }

    private Task<IReadOnlyList<AiCompareProductRecord>> SearchAsync(
        SlotState slots,
        CancellationToken cancellationToken)
        => _catalog.SearchApprovedProductsAsync(
            ToProductQuery(slots),
            AiConstants.CatalogContextProductLimit,
            cancellationToken);

    private static string BuildRelaxNote(IReadOnlyList<string> relaxed)
        => $"Nothing matched every requirement, so I relaxed {string.Join(", ", relaxed)}.";

    private static SlotState CloneSlots(
        SlotState source,
        bool clearCategory = false,
        bool clearBrand = false,
        bool clearRating = false,
        bool clearQuery = false)
        => new()
        {
            Q = clearQuery ? null : source.Q,
            CategoryId = clearCategory ? null : source.CategoryId,
            CategoryName = clearCategory ? null : source.CategoryName,
            Brand = clearBrand ? null : source.Brand,
            MinPrice = source.MinPrice,
            MaxPrice = source.MaxPrice,
            MinRating = clearRating ? null : source.MinRating,
            Sort = source.Sort
        };

    /// <summary>Free-text escape hatch: the buyer wants results, not more questions.</summary>
    private static bool LooksLikeSkipQuestions(string message)
    {
        var lower = message.ToLowerInvariant();
        return ContainsAny(lower,
            "just show me", "show me anything", "show me options", "skip the question", "skip question",
            "no preference", "whatever", "anything is fine", "don't know", "dont know", "not sure",
            "sao cung duoc", "gi cung duoc", "bat ky", "xem luon", "khong biet",
            "sao cũng được", "gì cũng được", "bất kỳ", "xem luôn", "không biết");
    }

    /// <summary>Apply a tapped chip straight onto the slots - no NLU in the loop.</summary>
    private static bool ApplyQuickReply(
        (string Key, string Value) reply,
        SlotState slots,
        ConsultState consult,
        IReadOnlyList<AiCategoryLookup> categories)
    {
        if (string.Equals(reply.Key, AiConsultQuestionBank.SkipValue, StringComparison.Ordinal))
        {
            if (string.Equals(reply.Value, AiConsultQuestionBank.SkipAllTarget, StringComparison.OrdinalIgnoreCase))
                return true;

            // Slot-level skip: mark it answered so the planner moves on and never re-asks.
            consult.Answers[reply.Value] = AiConsultQuestionBank.SkippedAnswer;
            if (!consult.Asked.Contains(reply.Value, StringComparer.OrdinalIgnoreCase))
                consult.Asked.Add(reply.Value);
            consult.PendingQuestion = null;
            return false;
        }

        var group = AiConsultQuestionBank.ResolveGroup(slots.CategoryId, categories);

        switch (reply.Key)
        {
            case AiConstants.ConsultQuestionCategory:
            {
                if (int.TryParse(reply.Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
                {
                    var match = categories.FirstOrDefault(c => c.CategoryId == id);
                    if (match is not null)
                    {
                        slots.CategoryId = match.CategoryId;
                        slots.CategoryName = match.Name;
                        consult.Answers[reply.Key] = match.Name;
                    }
                }

                break;
            }

            case AiConstants.ConsultQuestionBudget:
            {
                if (AiConsultQuestionBank.ParseBudgetValue(reply.Value) is { } band)
                {
                    slots.MinPrice = band.Min;
                    slots.MaxPrice = band.Max;
                    consult.Answers[reply.Key] = reply.Value;
                }

                break;
            }

            case AiConstants.ConsultQuestionUseCase:
            {
                consult.Answers[reply.Key] = reply.Value;
                var choice = AiConsultQuestionBank.FindChoice(group, reply.Key, reply.Value);

                // Narrow into the child shelf when the catalog has one. Keywords stay out of
                // the search query on purpose: Discovery matches a single substring, so a spec
                // term would over-constrain. They feed ranking instead.
                if (choice?.ChildCategorySlug is string slug)
                {
                    var child = categories.FirstOrDefault(c =>
                        string.Equals(c.Slug, slug, StringComparison.OrdinalIgnoreCase));
                    if (child is not null)
                    {
                        slots.CategoryId = child.CategoryId;
                        slots.CategoryName = child.Name;
                    }
                }

                break;
            }

            case AiConstants.ConsultQuestionPriority:
            {
                consult.Answers[reply.Key] = reply.Value;
                var choice = AiConsultQuestionBank.FindChoice(group, reply.Key, reply.Value);
                if (!string.IsNullOrWhiteSpace(choice?.Sort))
                    slots.Sort = choice.Sort;
                if (choice?.MinRating is decimal minRating)
                    slots.MinRating = minRating;
                break;
            }
        }

        consult.PendingQuestion = null;
        return false;
    }

    /// <summary>
    /// Both the NL parser and the use-case chips can land on a leaf shelf that carries no
    /// products of its own (a catalogue often files everything on the parent). Planning
    /// against an empty shelf makes the assistant conclude there is nothing left to narrow
    /// and stop asking, then relax noisily right back out. Promote to the nearest ancestor
    /// that actually stocks something before anything else looks at the category.
    /// </summary>
    private async Task PromoteToStockedCategoryAsync(
        SlotState slots,
        IReadOnlyList<AiCategoryLookup> categories,
        CancellationToken cancellationToken)
    {
        var guard = 0;
        while (slots.CategoryId is int categoryId && guard++ < 4)
        {
            var stocked = await _catalog.CountApprovedProductsAsync(
                new ProductQueryRequest { CategoryId = categoryId },
                cancellationToken);
            if (stocked > 0)
                return;

            var node = categories.FirstOrDefault(c => c.CategoryId == categoryId);
            if (node?.ParentId is not int parentId)
                return;

            var parent = categories.FirstOrDefault(c => c.CategoryId == parentId);
            if (parent is null)
                return;

            slots.CategoryId = parent.CategoryId;
            slots.CategoryName = parent.Name;
        }
    }

    /// <summary>
    /// A budget is category-relative: "22-30M" means a mid-range laptop, not an absurdly
    /// expensive pair of headphones. Carry it to the new shelf only if that shelf really
    /// stocks the band; otherwise forget it so the planner can ask again.
    /// </summary>
    private async Task DropBudgetIfItDoesNotFitShelfAsync(
        SlotState slots,
        ConsultState? consult,
        CancellationToken cancellationToken)
    {
        if (slots.MinPrice is null && slots.MaxPrice is null)
            return;

        if (await _catalog.CountApprovedProductsAsync(ToShelfQuery(slots), cancellationToken) > 0)
            return;

        slots.MinPrice = null;
        slots.MaxPrice = null;
        consult?.Answers.Remove(AiConstants.ConsultQuestionBudget);
    }

    /// <summary>
    /// A real topic switch means a different top-level shelf (laptops -> headphones).
    /// Moving between a category and its own child is narrowing, not switching.
    /// </summary>
    private static bool HasSwitchedShelf(
        int? previousCategoryId,
        int? nextCategoryId,
        IReadOnlyList<AiCategoryLookup> categories)
    {
        if (previousCategoryId is not int previous || nextCategoryId is not int next || previous == next)
            return false;

        return RootCategoryId(previous, categories) != RootCategoryId(next, categories);
    }

    private static int? RootCategoryId(int categoryId, IReadOnlyList<AiCategoryLookup> categories)
    {
        var node = categories.FirstOrDefault(c => c.CategoryId == categoryId);
        var guard = 0;
        while (node?.ParentId is int parentId && guard++ < 5)
        {
            var parent = categories.FirstOrDefault(c => c.CategoryId == parentId);
            if (parent is null)
                break;
            node = parent;
        }

        return node?.CategoryId ?? categoryId;
    }

    /// <summary>New round after a topic switch: budget follows the person, the rest followed the old shelf.</summary>
    private static void ClearCategoryBoundSlots(SlotState slots)
    {
        slots.Q = null;
        slots.Brand = null;
        slots.MinRating = null;
        slots.Sort = null;
    }

    private async Task<ConsultQuestion?> RebuildPendingQuestionAsync(
        ConsultState? consult,
        SlotState slots,
        string? group,
        IReadOnlyList<AiCategoryLookup> categories,
        CancellationToken cancellationToken)
    {
        if (consult?.PendingQuestion is not string key
            || !string.Equals(consult.Stage, AiConstants.ConsultStageCollecting, StringComparison.Ordinal))
            return null;

        return key switch
        {
            AiConstants.ConsultQuestionCategory =>
                AiConsultQuestionBank.BuildCategoryQuestion(categories),
            AiConstants.ConsultQuestionUseCase =>
                AiConsultQuestionBank.BuildUseCaseQuestion(group),
            AiConstants.ConsultQuestionPriority =>
                AiConsultQuestionBank.BuildPriorityQuestion(group),
            AiConstants.ConsultQuestionBudget =>
                AiConsultQuestionBank.BuildBudgetQuestion(
                    await _catalog.GetPriceBandsAsync(ToBandScope(slots), cancellationToken)),
            _ => null
        };
    }

    /// <summary>
    /// Ask turn. The question itself comes from the rule bank; the LLM may only rephrase it,
    /// so consultation keeps working when Groq is mocked or down.
    /// </summary>
    private async Task<(string Reply, string Source)> BuildQuestionReplyAsync(
        ConsultQuestion question,
        SlotState slots,
        IReadOnlyList<AiMessageRecord> history,
        string message,
        CancellationToken cancellationToken)
    {
        if (_llm.UseMock)
            return (question.Text, AiConstants.SourceHeuristic);

        var systemPrompt =
            """
            You are AIDR shopping assistant, guiding a buyer to the right product.
            Rewrite the given question naturally in ONE sentence of clear English.
            Ask exactly ONE question. Never add a second question.
            Do not mention products, prices, ids, or options beyond the provided choices.
            You may acknowledge what the buyer already told you in at most one short clause.
            Return ONLY JSON: { "reply": string }
            """;

        var turns = new List<LlmChatMessage>();
        foreach (var m in history.TakeLast(4))
        {
            if (m.Role is AiConstants.RoleUser or AiConstants.RoleAssistant)
                turns.Add(new LlmChatMessage { Role = m.Role, Content = m.Content });
        }

        turns.Add(new LlmChatMessage
        {
            Role = AiConstants.RoleUser,
            Content =
                $"""
                Question to ask: {question.Text}
                Answer choices offered as buttons: {string.Join(" | ", question.Choices.Select(c => c.Label))}
                Already known: {JsonSerializer.Serialize(ToSlotsDto(slots), JsonOptions)}

                Buyer message:
                {message}
                """
        });

        try
        {
            var raw = await _llm.ChatAsync(systemPrompt, turns, jsonFormat: true, cancellationToken);
            if (!string.IsNullOrWhiteSpace(raw))
            {
                var payload = JsonSerializer.Deserialize<ChatLlmPayload>(ExtractJsonObject(raw), JsonOptions);
                var cleaned = EnforceSingleQuestion(payload?.Reply, question.Text);
                if (cleaned is not null)
                    return (cleaned, AiConstants.SourceGroq);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to rephrase consultation question; using the bank wording.");
        }

        return (question.Text, AiConstants.SourceHeuristic);
    }

    /// <summary>
    /// Models like to tack on extra questions. Keep the first one and drop the rest;
    /// anything that is not a question at all falls back to the bank wording.
    /// </summary>
    private static string? EnforceSingleQuestion(string? reply, string fallback)
    {
        var text = reply?.Trim();
        if (string.IsNullOrWhiteSpace(text) || text.Length > 400)
            return null;

        var first = text.IndexOf('?');
        if (first < 0)
            return null;

        var trimmed = text[..(first + 1)].Trim();
        return trimmed.Length == 0 ? fallback : trimmed;
    }

    /// <summary>
    /// Shelf size for planning, and the scope behind budget chips. Both deliberately ignore
    /// <see cref="SlotState.Q"/>: it is a keyword the NL parser derived, not a constraint the
    /// buyer stated, and the search relaxes it anyway. Counting with it made the planner
    /// believe an empty shelf and stop asking.
    /// </summary>
    private static ProductQueryRequest ToShelfQuery(SlotState slots)
        => new()
        {
            CategoryId = slots.CategoryId,
            Brand = slots.Brand,
            MinPrice = slots.MinPrice,
            MaxPrice = slots.MaxPrice,
            MinRating = slots.MinRating,
            Page = 1,
            PageSize = AiConstants.CatalogContextProductLimit
        };

    private static ProductQueryRequest ToBandScope(SlotState slots)
        => new()
        {
            CategoryId = slots.CategoryId,
            Brand = slots.Brand,
            Page = 1,
            PageSize = AiConstants.PriceBandSampleSize
        };

    private static string? BuildConsultNotes(ConsultState? consult)
    {
        if (consult is null || consult.Answers.Count == 0)
            return null;

        var parts = consult.Answers
            .Where(kv => !string.Equals(kv.Value, AiConsultQuestionBank.SkippedAnswer, StringComparison.Ordinal))
            .Select(kv => $"{kv.Key}={kv.Value}")
            .ToList();

        return parts.Count == 0 ? null : string.Join("; ", parts);
    }

    private async Task<(string Reply, IReadOnlyList<Guid> ProductIds, Dictionary<string, string> Reasons, IReadOnlyList<AiChatActionDto> Actions)?> TryLlmReplyAsync(
        string message,
        IReadOnlyList<AiMessageRecord> history,
        string intent,
        SlotState slots,
        ConsultState? consult,
        GroundedPack pack,
        CancellationToken cancellationToken)
    {
        var systemPrompt =
            """
            You are AIDR shopping assistant for a multi-vendor consumer electronics marketplace.
            Help buyers with product advice and shopping FAQs (shipping, payment, returns, vouchers, warranty).
            Reply in clear English. Be concise (2-5 short paragraphs or bullets). Ask at most one clarifying question.
            Use ONLY grounded context below. Never invent product ids, prices, stock, or policies.
            When FAQ text is provided, paraphrase it - do not add new policy rules.
            Return ONLY JSON:
            {
              "reply": string,
              "productIds": string[],
              "reasons": { "<productId>": "short why" },
              "actions": [ { "type": "open_catalog|open_compare|open_product|none", "label": string, "productIds": string[] } ]
            }
            productIds must be empty for FAQ/clarify/smalltalk unless context products are explicitly discussed.
            Max 5 productIds, all from catalog context.
            """;

        var turns = new List<LlmChatMessage>();
        foreach (var m in history)
        {
            if (m.Role is not (AiConstants.RoleUser or AiConstants.RoleAssistant))
                continue;
            turns.Add(new LlmChatMessage { Role = m.Role, Content = m.Content });
        }

        var consultNotes = BuildConsultNotes(consult);
        turns.Add(new LlmChatMessage
        {
            Role = AiConstants.RoleUser,
            Content =
                $"""
                Intent: {intent}
                Active slots: {JsonSerializer.Serialize(ToSlotsDto(slots), JsonOptions)}
                {(consultNotes is null
                    ? string.Empty
                    : $"Buyer answered: {consultNotes}. Open with one sentence tying the picks to those answers. Ask no new question.")}
                Grounded context:
                {BuildGroundedContext(pack)}

                Buyer message:
                {message}
                """
        });

        var raw = await _llm.ChatAsync(systemPrompt, turns, jsonFormat: true, cancellationToken);
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        try
        {
            var payload = JsonSerializer.Deserialize<ChatLlmPayload>(ExtractJsonObject(raw), JsonOptions);
            var reply = payload?.Reply?.Trim();
            if (string.IsNullOrWhiteSpace(reply))
                return null;

            var ids = new List<Guid>();
            if (payload?.ProductIds is { Length: > 0 })
            {
                foreach (var rawId in payload.ProductIds)
                {
                    if (Guid.TryParse(rawId, out var id) && id != Guid.Empty)
                        ids.Add(id);
                }
            }

            var reasons = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (payload?.Reasons is not null)
            {
                foreach (var kv in payload.Reasons)
                {
                    if (!string.IsNullOrWhiteSpace(kv.Key) && !string.IsNullOrWhiteSpace(kv.Value))
                        reasons[kv.Key.Trim()] = kv.Value.Trim();
                }
            }

            var actions = new List<AiChatActionDto>();
            if (payload?.Actions is { Length: > 0 })
            {
                foreach (var a in payload.Actions)
                {
                    if (a is null || string.IsNullOrWhiteSpace(a.Type))
                        continue;
                    var actionIds = new List<Guid>();
                    if (a.ProductIds is { Length: > 0 })
                    {
                        foreach (var rawId in a.ProductIds)
                        {
                            if (Guid.TryParse(rawId, out var id) && id != Guid.Empty)
                                actionIds.Add(id);
                        }
                    }

                    actions.Add(new AiChatActionDto
                    {
                        Type = a.Type.Trim().ToLowerInvariant(),
                        Label = string.IsNullOrWhiteSpace(a.Label) ? null : a.Label.Trim(),
                        ProductIds = actionIds
                    });
                }
            }

            return (reply, ids, reasons, actions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse Groq shopping-assistant JSON.");
            return null;
        }
    }

    private static (
        string Reply,
        IReadOnlyList<AiCompareProductRecord> Products,
        Dictionary<string, string> Reasons,
        IReadOnlyList<AiChatActionDto> Actions)
        BuildHeuristicOutcome(
            string intent,
            string message,
            GroundedPack pack,
            SlotState slots,
            AiChatContextDto? context)
    {
        var reasons = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var products = pack.Products.Take(AiConstants.MaxSuggestedProducts).ToList();

        if (intent == AiConstants.IntentFaq)
        {
            var text = pack.FaqText ?? ResolveFaqText(DetectFaqTopic(message));
            return (text, Array.Empty<AiCompareProductRecord>(), reasons, Array.Empty<AiChatActionDto>());
        }

        if (intent == AiConstants.IntentClarify)
        {
            return (
                "I can help narrow it down. What category are you shopping for (phone, laptop, accessories), and what is your max budget in VND?",
                Array.Empty<AiCompareProductRecord>(),
                reasons,
                Array.Empty<AiChatActionDto>());
        }

        if (intent == AiConstants.IntentSmalltalk)
        {
            return (
                "Hi! I can recommend products, refine by brand/budget, answer shopping FAQs, or compare a few items. What are you looking for?",
                Array.Empty<AiCompareProductRecord>(),
                reasons,
                Array.Empty<AiChatActionDto>());
        }

        if (intent == AiConstants.IntentProductQa && products.Count > 0)
        {
            var p = products[0];
            var price = EffectivePrice(p);
            var available = Math.Max(0, p.StockQuantity - p.ReservedQuantity);
            var sb = new StringBuilder();
            sb.Append(CultureInfo.InvariantCulture,
                $"{p.Name} ({p.Brand ?? "-"}) is listed at {price:0} {p.Currency}");
            if (p.WarrantyMonths is int w)
                sb.Append(CultureInfo.InvariantCulture, $", with {w} months warranty");
            sb.Append(CultureInfo.InvariantCulture, $". Rating {p.AvgRating:0.0} from {p.ReviewCount} reviews. ");
            sb.Append(available > 0 ? "In stock." : "Currently out of stock.");
            if (!string.IsNullOrWhiteSpace(pack.FocusNotes))
                sb.Append(' ').Append(pack.FocusNotes);
            reasons[p.ProductId.ToString("D")] = "Currently viewing this product";
            return (sb.ToString(), products, reasons, DefaultActions(intent, products, slots));
        }

        if (intent == AiConstants.IntentCompare)
        {
            var sb = new StringBuilder();
            if (!string.IsNullOrWhiteSpace(pack.CompareSummary))
                sb.AppendLine(pack.CompareSummary);
            foreach (var h in pack.CompareHighlights.Take(4))
                sb.AppendLine($"- {h}");
            if (sb.Length == 0 && products.Count >= 2)
            {
                sb.AppendLine("Here is a quick side-by-side of the selected products:");
                foreach (var p in products)
                {
                    sb.AppendLine(CultureInfo.InvariantCulture,
                        $"- {p.Name}: {EffectivePrice(p):0} {p.Currency}, rating {p.AvgRating:0.0}");
                }
            }

            if (sb.Length == 0)
            {
                return (
                    "Select 2–5 products (or ask me to compare the ones I just suggested) and I will summarize the differences.",
                    Array.Empty<AiCompareProductRecord>(),
                    reasons,
                    Array.Empty<AiChatActionDto>());
            }

            foreach (var p in products)
                reasons[p.ProductId.ToString("D")] = "Included in comparison";

            return (sb.ToString().Trim(), products, reasons, DefaultActions(intent, products, slots));
        }

        if (products.Count > 0)
        {
            var sb = new StringBuilder();
            sb.AppendLine(intent == AiConstants.IntentBrowse
                ? "Based on your activity, here are products you may like:"
                : "Here are Approved products that match your preferences:");
            foreach (var p in products)
            {
                var price = EffectivePrice(p);
                var reason = BuildHeuristicReason(p, slots);
                reasons[p.ProductId.ToString("D")] = reason;
                sb.AppendLine(CultureInfo.InvariantCulture,
                    $"- {p.Name} ({p.Brand ?? "-"}) - {price:0} {p.Currency}, rating {p.AvgRating:0.0}");
            }

            sb.Append("Open a product for specs and reviews, or ask me to refine by brand, budget, or rating.");
            return (sb.ToString().Trim(), products, reasons, DefaultActions(intent, products, slots));
        }

        if (context?.ProductId is not null)
        {
            return (
                "I could not load that product right now. Try opening it again from the catalog, or describe what you need (brand, category, budget).",
                Array.Empty<AiCompareProductRecord>(),
                reasons,
                Array.Empty<AiChatActionDto>());
        }

        if (HasUsefulSlots(slots))
        {
            var bits = new List<string>();
            if (!string.IsNullOrWhiteSpace(slots.Brand)) bits.Add(slots.Brand);
            if (!string.IsNullOrWhiteSpace(slots.CategoryName)) bits.Add(slots.CategoryName);
            if (slots.MaxPrice is decimal max)
                bits.Add($"under {max:0} VND");
            var filterHint = bits.Count > 0 ? string.Join(" · ", bits) : "your filters";
            return (
                $"I understood {filterHint}, but no Approved products matched right now. " +
                "Try widening the budget, clearing preferences (Clear), or asking without a brand.",
                Array.Empty<AiCompareProductRecord>(),
                reasons,
                DefaultActions(AiConstants.IntentRecommend, Array.Empty<AiCompareProductRecord>(), slots));
        }

        return (
            "I can help with product recommendations and shopping FAQs (shipping, payment, returns, vouchers, warranty). " +
            "Try asking for a brand/category and budget (e.g. \"Samsung phone under 15 million\").",
            Array.Empty<AiCompareProductRecord>(),
            reasons,
            Array.Empty<AiChatActionDto>());
    }

    private static string ClassifyIntent(
        string message,
        AiChatContextDto? context,
        SlotState? previousSlots,
        SlotState slots,
        IReadOnlyList<Guid> previousProductIds)
    {
        var lower = message.ToLowerInvariant();

        if (DetectFaqTopic(lower) is not null && !LooksLikeProductQaOnPdp(lower, context))
            return AiConstants.IntentFaq;

        if (IsSmalltalk(lower))
            return AiConstants.IntentSmalltalk;

        if (IsCompareIntent(lower, context, previousProductIds))
            return AiConstants.IntentCompare;

        if (LooksLikeProductQaOnPdp(lower, context) || (context?.ProductId is not null && LooksLikeAlternatives(lower)))
            return AiConstants.IntentProductQa;

        if (IsRefineIntent(lower) && previousSlots is not null && HasUsefulSlots(previousSlots))
            return AiConstants.IntentRefine;

        if (IsBrowseIntent(lower) && !HasUsefulSlots(slots) && previousSlots is null)
            return AiConstants.IntentBrowse;

        if (LooksLikeProductIntent(lower) || HasUsefulSlots(slots))
        {
            if (!HasUsefulSlots(slots) && previousSlots is null && !HasBudgetOrCategorySignal(lower))
                return AiConstants.IntentClarify;
            return IsRefineIntent(lower) && previousSlots is not null
                ? AiConstants.IntentRefine
                : AiConstants.IntentRecommend;
        }

        if (context?.ProductId is not null)
            return AiConstants.IntentProductQa;

        return AiConstants.IntentClarify;
    }

    private static SlotState MergeSlots(
        SlotState? previous,
        NlFilterResultDto nl,
        string message,
        IReadOnlyList<Guid> previousProductIds)
    {
        var lower = message.ToLowerInvariant();
        var next = previous is null
            ? new SlotState()
            : new SlotState
            {
                Q = previous.Q,
                CategoryId = previous.CategoryId,
                CategoryName = previous.CategoryName,
                Brand = previous.Brand,
                MinPrice = previous.MinPrice,
                MaxPrice = previous.MaxPrice,
                MinRating = previous.MinRating,
                Sort = previous.Sort
            };

        if (!string.IsNullOrWhiteSpace(nl.Brand))
            next.Brand = nl.Brand;
        if (nl.CategoryId is > 0)
        {
            next.CategoryId = nl.CategoryId;
            next.CategoryName = nl.CategoryName;
        }

        // Drop leaf category that conflicts with an explicit brand (e.g. Samsung + Apple iPhone).
        if (!string.IsNullOrWhiteSpace(next.Brand)
            && !string.IsNullOrWhiteSpace(next.CategoryName)
            && IsBrandCategoryConflict(next.Brand, next.CategoryName))
        {
            next.CategoryId = null;
            next.CategoryName = null;
        }

        if (nl.MinPrice is not null)
            next.MinPrice = nl.MinPrice;
        if (nl.MaxPrice is not null)
            next.MaxPrice = nl.MaxPrice;
        if (nl.MinRating is not null)
            next.MinRating = nl.MinRating;
        if (!string.IsNullOrWhiteSpace(nl.Sort))
            next.Sort = nl.Sort;
        if (!string.IsNullOrWhiteSpace(nl.Q))
            next.Q = nl.Q;

        if (IsCheaperIntent(lower))
        {
            next.Sort = DiscoveryConstants.SortPriceAsc;
            if (next.MaxPrice is decimal max)
                next.MaxPrice = Math.Round(max * 0.85m, 0, MidpointRounding.AwayFromZero);
            else if (previousProductIds.Count > 0)
            {
                // Soft hint only - exact prices come from catalog search sort.
            }
        }

        return next;
    }

    private static bool IsBrandCategoryConflict(string brand, string categoryName)
    {
        var b = brand.Trim().ToLowerInvariant();
        var c = categoryName.Trim().ToLowerInvariant();
        string[] brands = ["samsung", "apple", "xiaomi", "oppo", "vivo", "realme", "asus", "dell", "hp", "lenovo", "sony"];
        foreach (var other in brands)
        {
            if (other.Equals(b, StringComparison.Ordinal) || b.Contains(other, StringComparison.Ordinal))
                continue;
            if (c.Contains(other, StringComparison.Ordinal))
                return true;
        }

        return false;
    }

    private static ProductQueryRequest ToProductQuery(SlotState slots)
        => new()
        {
            Q = slots.Q,
            CategoryId = slots.CategoryId,
            Brand = slots.Brand,
            MinPrice = slots.MinPrice,
            MaxPrice = slots.MaxPrice,
            MinRating = slots.MinRating,
            Sort = slots.Sort ?? DiscoveryConstants.SortPopular,
            Page = 1,
            PageSize = AiConstants.CatalogContextProductLimit
        };

    private static IReadOnlyList<Guid> ResolveCompareIds(
        string message,
        AiChatContextDto? context,
        IReadOnlyList<Guid> previousProductIds)
    {
        var ids = new List<Guid>();
        if (context?.CompareProductIds is { Count: > 0 })
            ids.AddRange(context.CompareProductIds.Where(id => id != Guid.Empty));

        foreach (Match match in Regex.Matches(message, @"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"))
        {
            if (Guid.TryParse(match.Value, out var id) && id != Guid.Empty)
                ids.Add(id);
        }

        if (ids.Count < AiConstants.MinCompareProducts && previousProductIds.Count >= AiConstants.MinCompareProducts)
            ids.AddRange(previousProductIds);

        if (ids.Count < AiConstants.MinCompareProducts
            && context?.ProductId is Guid focus
            && focus != Guid.Empty
            && previousProductIds.Count > 0)
        {
            ids.Add(focus);
            ids.AddRange(previousProductIds);
        }

        return ids.Distinct().Take(AiConstants.MaxCompareProducts).ToList();
    }

    private static AiChatContextDto? NormalizeContext(AiChatContextDto? context)
    {
        if (context is null)
            return null;

        var compare = context.CompareProductIds?
            .Where(id => id != Guid.Empty)
            .Distinct()
            .Take(AiConstants.MaxCompareProducts)
            .ToList();

        return new AiChatContextDto
        {
            Path = string.IsNullOrWhiteSpace(context.Path) ? null : context.Path.Trim(),
            ProductId = context.ProductId is Guid p && p != Guid.Empty ? p : null,
            CompareProductIds = compare is { Count: > 0 } ? compare : null
        };
    }

    private static ChatMetaPayload? FindLastAssistantMeta(IReadOnlyList<AiMessageRecord> history)
    {
        for (var i = history.Count - 1; i >= 0; i--)
        {
            var m = history[i];
            if (m.Role != AiConstants.RoleAssistant || string.IsNullOrWhiteSpace(m.MetaJson))
                continue;
            var meta = TryParseMeta(m.MetaJson);
            if (meta is not null)
                return meta;
        }

        return null;
    }

    private static ChatMetaPayload? TryParseMeta(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;
        try
        {
            return JsonSerializer.Deserialize<ChatMetaPayload>(json, JsonOptions);
        }
        catch
        {
            return null;
        }
    }

    private static string BuildMetaJson(
        string intent,
        SlotState slots,
        ConsultState? consult,
        IReadOnlyList<AiSuggestedProductDto> products,
        Dictionary<string, string> reasons,
        IReadOnlyList<AiChatActionDto> actions,
        IReadOnlyList<AiQuickReplyDto> quickReplies,
        string source)
    {
        var badges = products
            .Where(p => !string.IsNullOrWhiteSpace(p.Badge))
            .ToDictionary(p => p.ProductId.ToString("D"), p => p.Badge!, StringComparer.OrdinalIgnoreCase);

        var payload = new ChatMetaPayload
        {
            Source = source,
            Intent = intent,
            Slots = ToSlotsDto(slots),
            Consult = consult,
            ProductIds = products.Select(p => p.ProductId).ToArray(),
            Reasons = reasons.Count == 0 ? null : reasons,
            Badges = badges.Count == 0 ? null : badges,
            Actions = actions.Count == 0 ? null : actions.ToArray(),
            // Persisted so reopening a half-finished consultation restores its chips.
            QuickReplies = quickReplies.Count == 0 ? null : quickReplies.ToArray()
        };
        return JsonSerializer.Serialize(payload, JsonOptions);
    }

    private static AiChatSlotsDto? ToSlotsDto(SlotState? slots)
    {
        if (slots is null || !HasUsefulSlots(slots))
            return HasAnySlot(slots) ? new AiChatSlotsDto
            {
                Q = slots?.Q,
                CategoryId = slots?.CategoryId,
                CategoryName = slots?.CategoryName,
                Brand = slots?.Brand,
                MinPrice = slots?.MinPrice,
                MaxPrice = slots?.MaxPrice,
                MinRating = slots?.MinRating,
                Sort = slots?.Sort
            } : null;

        return new AiChatSlotsDto
        {
            Q = slots.Q,
            CategoryId = slots.CategoryId,
            CategoryName = slots.CategoryName,
            Brand = slots.Brand,
            MinPrice = slots.MinPrice,
            MaxPrice = slots.MaxPrice,
            MinRating = slots.MinRating,
            Sort = slots.Sort
        };
    }

    private static bool HasAnySlot(SlotState? slots)
        => slots is not null
           && (slots.Q is not null
               || slots.CategoryId is not null
               || slots.Brand is not null
               || slots.MinPrice is not null
               || slots.MaxPrice is not null
               || slots.MinRating is not null
               || slots.Sort is not null);

    private static bool HasUsefulSlots(SlotState? slots)
        => slots is not null
           && (slots.CategoryId is not null
               || !string.IsNullOrWhiteSpace(slots.Brand)
               || slots.MinPrice is not null
               || slots.MaxPrice is not null
               || slots.MinRating is not null
               || !string.IsNullOrWhiteSpace(slots.Q));

    private static IReadOnlyList<AiCompareProductRecord> ResolveSuggestedProducts(
        IReadOnlyList<Guid> productIds,
        IReadOnlyList<AiCompareProductRecord> pack)
    {
        if (productIds.Count == 0)
            return Array.Empty<AiCompareProductRecord>();

        var byId = pack.ToDictionary(p => p.ProductId);
        var result = new List<AiCompareProductRecord>();
        foreach (var id in productIds.Distinct().Take(AiConstants.MaxSuggestedProducts))
        {
            if (byId.TryGetValue(id, out var product))
                result.Add(product);
        }

        return result;
    }

    private static Dictionary<string, string> FilterReasons(
        Dictionary<string, string> reasons,
        IReadOnlyList<AiCompareProductRecord> suggested)
    {
        var allowed = new HashSet<string>(
            suggested.Select(p => p.ProductId.ToString("D")),
            StringComparer.OrdinalIgnoreCase);
        return reasons
            .Where(kv => allowed.Contains(kv.Key))
            .ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.OrdinalIgnoreCase);
    }

    private static IReadOnlyList<AiChatActionDto> SanitizeActions(
        IReadOnlyList<AiChatActionDto> actions,
        IReadOnlyList<AiCompareProductRecord> suggested,
        SlotState slots,
        string intent)
    {
        var allowedIds = suggested.Select(p => p.ProductId).ToHashSet();
        var result = new List<AiChatActionDto>();
        foreach (var a in actions)
        {
            var type = (a.Type ?? string.Empty).Trim().ToLowerInvariant();
            if (type is not (
                AiConstants.ActionOpenCatalog
                or AiConstants.ActionOpenCompare
                or AiConstants.ActionOpenProduct
                or AiConstants.ActionNone))
                continue;

            var ids = (a.ProductIds ?? Array.Empty<Guid>())
                .Where(id => allowedIds.Contains(id))
                .Distinct()
                .Take(AiConstants.MaxSuggestedProducts)
                .ToList();

            if (type == AiConstants.ActionOpenCompare && ids.Count < AiConstants.MinCompareProducts)
                continue;
            if (type == AiConstants.ActionOpenCatalog && !HasUsefulSlots(slots) && suggested.Count == 0)
                continue;

            result.Add(new AiChatActionDto
            {
                Type = type,
                Label = string.IsNullOrWhiteSpace(a.Label) ? DefaultActionLabel(type) : a.Label,
                ProductIds = ids
            });
        }

        return result.Count > 0 ? result : DefaultActions(intent, suggested, slots);
    }

    private static IReadOnlyList<AiChatActionDto> DefaultActions(
        string intent,
        IReadOnlyList<AiCompareProductRecord> suggested,
        SlotState slots)
    {
        var actions = new List<AiChatActionDto>();
        if (HasUsefulSlots(slots)
            && intent is AiConstants.IntentRecommend or AiConstants.IntentRefine or AiConstants.IntentBrowse)
        {
            actions.Add(new AiChatActionDto
            {
                Type = AiConstants.ActionOpenCatalog,
                Label = "See all matching products",
                ProductIds = Array.Empty<Guid>()
            });
        }

        if (suggested.Count >= AiConstants.MinCompareProducts
            || intent == AiConstants.IntentCompare)
        {
            actions.Add(new AiChatActionDto
            {
                Type = AiConstants.ActionOpenCompare,
                Label = "Compare these",
                ProductIds = suggested.Take(AiConstants.MaxCompareProducts).Select(p => p.ProductId).ToList()
            });
        }
        else if (suggested.Count == 1
                 && intent is AiConstants.IntentProductQa or AiConstants.IntentRecommend)
        {
            actions.Add(new AiChatActionDto
            {
                Type = AiConstants.ActionOpenProduct,
                Label = "View product",
                ProductIds = [suggested[0].ProductId]
            });
        }

        return actions;
    }

    private static string DefaultActionLabel(string type)
        => type switch
        {
            AiConstants.ActionOpenCatalog => "See all matching products",
            AiConstants.ActionOpenCompare => "Compare these",
            AiConstants.ActionOpenProduct => "View product",
            _ => "Continue"
        };

    private static string BuildGroundedContext(GroundedPack pack)
    {
        var sb = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(pack.FaqText))
            sb.AppendLine($"FAQ ({pack.FaqTopic}): {pack.FaqText}");
        if (!string.IsNullOrWhiteSpace(pack.FocusNotes))
            sb.AppendLine($"Focus product notes: {pack.FocusNotes}");
        if (!string.IsNullOrWhiteSpace(pack.CompareSummary))
            sb.AppendLine($"Compare summary: {pack.CompareSummary}");
        foreach (var h in pack.CompareHighlights)
            sb.AppendLine($"Compare highlight: {h}");

        if (pack.Products.Count == 0)
        {
            sb.AppendLine("Catalog products: (none)");
            return sb.ToString().TrimEnd();
        }

        sb.AppendLine("Catalog products:");
        foreach (var p in pack.Products)
        {
            var price = EffectivePrice(p);
            var available = Math.Max(0, p.StockQuantity - p.ReservedQuantity);
            sb.AppendLine(CultureInfo.InvariantCulture,
                $"id={p.ProductId}; name={p.Name}; brand={p.Brand}; category={p.CategoryName}; " +
                $"price={price:0} {p.Currency}; rating={p.AvgRating:0.0}; reviews={p.ReviewCount}; " +
                $"warrantyMonths={p.WarrantyMonths}; stock={available}; slug={p.Slug}");
        }

        return sb.ToString().TrimEnd();
    }

    private static string BuildProductQaNotes(AiCompareProductRecord p)
    {
        var sb = new StringBuilder();
        sb.Append(CultureInfo.InvariantCulture,
            $"WarrantyMonths={p.WarrantyMonths?.ToString(CultureInfo.InvariantCulture) ?? "n/a"}; ");
        sb.Append(CultureInfo.InvariantCulture,
            $"Condition={p.ConditionType}; Origin={p.OriginCountry ?? "n/a"}; ");
        if (!string.IsNullOrWhiteSpace(p.ShortDescription))
            sb.Append($"ShortDescription={p.ShortDescription}; ");
        if (!string.IsNullOrWhiteSpace(p.SpecsJson) && p.SpecsJson.Length <= 800)
            sb.Append($"SpecsJson={p.SpecsJson}");
        return sb.ToString();
    }

    private static string BuildHeuristicReason(AiCompareProductRecord p, SlotState slots)
    {
        var bits = new List<string>();
        if (!string.IsNullOrWhiteSpace(slots.Brand)
            && string.Equals(p.Brand, slots.Brand, StringComparison.OrdinalIgnoreCase))
            bits.Add(slots.Brand);
        if (slots.CategoryName is not null)
            bits.Add(slots.CategoryName);
        if (slots.MaxPrice is decimal max && EffectivePrice(p) <= max)
            bits.Add("within budget");
        if (p.AvgRating >= 4m)
            bits.Add("4★+");
        if (bits.Count == 0)
            bits.Add($"rating {p.AvgRating:0.0}");
        return string.Join(" · ", bits);
    }

    private static SlotState? FromSlotsDto(AiChatSlotsDto? dto)
    {
        if (dto is null)
            return null;
        return new SlotState
        {
            Q = dto.Q,
            CategoryId = dto.CategoryId,
            CategoryName = dto.CategoryName,
            Brand = dto.Brand,
            MinPrice = dto.MinPrice,
            MaxPrice = dto.MaxPrice,
            MinRating = dto.MinRating,
            Sort = dto.Sort
        };
    }

    private static string? DetectFaqTopic(string message)
    {
        var lower = message.ToLowerInvariant();
        if (ContainsAny(lower, "return", "refund", "trả hàng", "tra hang", "hoàn tiền", "hoan tien"))
            return AiConstants.FaqTopicReturn;
        if (ContainsAny(lower, "shipping", "delivery", "ship", "vận chuyển", "van chuyen", "giao hàng", "giao hang"))
            return AiConstants.FaqTopicShipping;
        if (ContainsAny(lower, "payment", "payos", "thanh toán", "thanh toan", "checkout")
            && !ContainsAny(lower, "voucher", "coupon"))
            return AiConstants.FaqTopicPayment;
        if (ContainsAny(lower, "voucher", "coupon", "discount", "mã giảm", "ma giam", "khuyến mãi", "khuyen mai"))
            return AiConstants.FaqTopicVoucher;
        if (ContainsAny(lower, "warranty policy", "bảo hành như", "bao hanh nhu", "how does warranty")
            || (ContainsAny(lower, "warranty", "bảo hành", "bao hanh")
                && ContainsAny(lower, "how", "policy", "work", "như thế", "nhu the")))
            return AiConstants.FaqTopicWarranty;
        return null;
    }

    private static string ResolveFaqText(string? topic)
        => topic switch
        {
            AiConstants.FaqTopicReturn =>
                "You can request a return & refund or an exchange from your order detail after delivery " +
                "(or while the order is shipping/delivered/completed). " +
                "Upload unboxing and testing video evidence. Admin reviews first, then the seller confirms handling, " +
                "inspects the returned goods, and Admin completes the refund or exchange.",
            AiConstants.FaqTopicShipping =>
                "After payment, the seller prepares and ships your order. Track status under My Orders " +
                "(Paid → Processing → Shipped → Delivered). Confirm received when the package arrives.",
            AiConstants.FaqTopicPayment =>
                "Checkout creates a payOS payment link. Complete payment in the secure payOS window; " +
                "your order becomes Paid when the webhook confirms success. Unpaid orders can be cancelled from My Orders.",
            AiConstants.FaqTopicVoucher =>
                "Apply available system or shop vouchers on the cart/checkout screen before creating the order. " +
                "Each voucher has min-order, expiry, and usage limits - invalid codes are rejected automatically.",
            AiConstants.FaqTopicWarranty =>
                "Warranty months are shown on each product page. For seller-specific warranty claims, " +
                "contact the shop via Chat from the product or order detail.",
            _ =>
                "I can help with shipping, payment (payOS), returns/refunds, vouchers, and warranty. Which topic do you need?"
        };

    private static bool LooksLikeProductQaOnPdp(string lower, AiChatContextDto? context)
    {
        if (context?.ProductId is null)
            return false;
        return ContainsAny(lower,
            "this product", "this item", "this phone", "this laptop", "máy này", "may nay", "sp này", "sp nay",
            "warranty", "bảo hành", "bao hanh", "specs", "specification", "battery", "ram", "storage",
            "how long", "in stock", "còn hàng", "con hang");
    }

    private static bool LooksLikeAlternatives(string lower)
        => ContainsAny(lower,
            "similar", "alternative", "alternatives", "other options", "tương tự", "tuong tu",
            "khác", "khac", "instead");

    private static bool IsCompareIntent(
        string lower,
        AiChatContextDto? context,
        IReadOnlyList<Guid> previousProductIds)
    {
        if (ContainsAny(lower, "compare", "vs", "versus", "so sánh", "so sanh", "which is better", "nên chọn", "nen chon"))
            return true;
        return context?.CompareProductIds is { Count: >= 2 }
               && ContainsAny(lower, "better", "difference", "khác nhau", "khac nhau");
    }

    private static bool IsRefineIntent(string lower)
        => ContainsAny(lower,
            "cheaper", "rẻ hơn", "re hon", "under", "dưới", "duoi", "instead", "switch to",
            "only", "chỉ", "chi", "higher rating", "từ", "from", "more expensive", "đắt hơn");

    private static bool IsCheaperIntent(string lower)
        => ContainsAny(lower, "cheaper", "rẻ hơn", "re hon", "cheapest", "rẻ nhất", "re nhat", "giá thấp", "gia thap");

    private static bool IsBrowseIntent(string lower)
        => ContainsAny(lower,
            "for me", "recommend something", "gợi ý", "goi y", "what should i buy", "có gì hay", "co gi hay",
            "surprise me", "popular", "trending");

    private static bool IsSmalltalk(string lower)
    {
        var t = lower.Trim();
        return t is "hi" or "hello" or "hey" or "thanks" or "thank you" or "xin chào" or "chào" or "cảm ơn" or "cam on"
            || ContainsAny(t, "good morning", "good evening");
    }

    private static bool HasBudgetOrCategorySignal(string lower)
        => ContainsAny(lower,
            "phone", "laptop", "tablet", "headphone", "watch", "điện thoại", "dien thoai", "máy tính",
            "under", "dưới", "duoi", "triệu", "trieu", "budget", "ngân sách", "ngan sach",
            "samsung", "apple", "xiaomi", "asus");

    private static bool LooksLikeProductIntent(string message)
    {
        var lower = message.ToLowerInvariant();
        return ContainsAny(lower,
            "recommend", "suggest", "buy", "phone", "laptop", "tablet", "watch", "headphone",
            "samsung", "apple", "iphone", "xiaomi", "asus", "macbook", "gợi ý", "goi y",
            "mua", "điện thoại", "dien thoai", "máy tính", "may tinh", "tai nghe", "đồng hồ", "dong ho",
            "under", "dưới", "duoi", "triệu", "trieu", "looking for", "tìm", "tim");
    }

    private static string BuildTitle(string message)
    {
        var title = Regex.Replace(message.Trim(), @"\s+", " ");
        if (title.Length > AiConstants.MaxChatTitleLength)
            title = title[..AiConstants.MaxChatTitleLength].TrimEnd() + "…";
        return title;
    }

    private static decimal EffectivePrice(AiCompareProductRecord p)
        => p.SalePrice is decimal sale && sale > 0 && sale < p.BasePrice ? sale : p.BasePrice;

    private static AiMessageDto MapMessage(
        AiMessageRecord m,
        IReadOnlyList<AiSuggestedProductDto>? suggestedProducts = null)
        => new()
        {
            AiMessageId = m.AiMessageId,
            Role = m.Role,
            Content = m.Content,
            MetaJson = m.MetaJson,
            CreatedAt = m.CreatedAt,
            SuggestedProducts = suggestedProducts
        };

    private static AiSuggestedProductDto MapSuggested(
        AiCompareProductRecord p,
        string? reason,
        string? badge = null)
    {
        var effective = EffectivePrice(p);
        return new AiSuggestedProductDto
        {
            ProductId = p.ProductId,
            Name = p.Name,
            Slug = p.Slug,
            Brand = p.Brand,
            BasePrice = p.BasePrice,
            SalePrice = p.SalePrice,
            EffectivePrice = effective,
            Currency = p.Currency,
            AvgRating = p.AvgRating,
            ReviewCount = p.ReviewCount,
            PrimaryImageUrl = p.PrimaryImageUrl,
            CategoryId = p.CategoryId,
            CategoryName = p.CategoryName,
            ShopId = p.ShopId,
            ShopName = p.ShopName,
            Reason = reason,
            Badge = badge
        };
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

    private sealed class GroundedPack
    {
        /// <summary>Filters dropped to find results - stated verbatim in the reply.</summary>
        public IReadOnlyList<string> Relaxed { get; init; } = Array.Empty<string>();

        public GroundedPack WithProducts(IReadOnlyList<AiCompareProductRecord> products)
            => new()
            {
                Products = products,
                Relaxed = Relaxed,
                FaqTopic = FaqTopic,
                FaqText = FaqText,
                CompareSummary = CompareSummary,
                CompareHighlights = CompareHighlights,
                FocusNotes = FocusNotes
            };

        public IReadOnlyList<AiCompareProductRecord> Products { get; init; } =
            Array.Empty<AiCompareProductRecord>();
        public string? FaqTopic { get; init; }
        public string? FaqText { get; init; }
        public string? CompareSummary { get; init; }
        public IReadOnlyList<string> CompareHighlights { get; init; } = Array.Empty<string>();
        public string? FocusNotes { get; init; }
    }

    private sealed class ChatMetaPayload
    {
        public string? Source { get; set; }
        public string? Intent { get; set; }
        public AiChatSlotsDto? Slots { get; set; }
        public Guid[]? ProductIds { get; set; }
        public Dictionary<string, string>? Reasons { get; set; }
        public Dictionary<string, string>? Badges { get; set; }
        public AiChatActionDto[]? Actions { get; set; }
        public ConsultState? Consult { get; set; }
        public AiQuickReplyDto[]? QuickReplies { get; set; }
    }

    private sealed class ChatLlmPayload
    {
        public string? Reply { get; set; }
        public string[]? ProductIds { get; set; }
        public Dictionary<string, string>? Reasons { get; set; }
        public ChatLlmAction[]? Actions { get; set; }
    }

    private sealed class ChatLlmAction
    {
        public string? Type { get; set; }
        public string? Label { get; set; }
        public string[]? ProductIds { get; set; }
    }
}
