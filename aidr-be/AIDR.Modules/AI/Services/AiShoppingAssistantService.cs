using System.Globalization;
using System.Text;
using System.Text.Json;
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
        PropertyNameCaseInsensitive = true
    };

    private readonly ILlmClient _llm;
    private readonly IAiCatalogRepository _catalog;
    private readonly IAiConversationRepository _conversations;
    private readonly ILogger<AiShoppingAssistantService> _logger;

    public AiShoppingAssistantService(
        ILlmClient llm,
        IAiCatalogRepository catalog,
        IAiConversationRepository conversations,
        ILogger<AiShoppingAssistantService> logger)
    {
        _llm = llm;
        _catalog = catalog;
        _conversations = conversations;
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

        var searchQuery = ExtractSearchQuery(message);
        var catalogHits = await _catalog.SearchApprovedProductsAsync(
            searchQuery,
            AiConstants.CatalogContextProductLimit,
            cancellationToken);

        var heuristic = BuildHeuristicReply(message, catalogHits);

        string reply;
        string source;
        IReadOnlyList<AiCompareProductRecord> suggested;

        if (_llm.UseMock)
        {
            reply = heuristic.Reply;
            source = AiConstants.SourceHeuristic;
            suggested = heuristic.Products;
        }
        else
        {
            var llmResult = await TryLlmReplyAsync(message, history, catalogHits, cancellationToken);
            if (llmResult is null)
            {
                _logger.LogInformation("Shopping assistant falling back to heuristic (no Groq response).");
                reply = heuristic.Reply;
                source = AiConstants.SourceHeuristic;
                suggested = heuristic.Products;
            }
            else
            {
                reply = llmResult.Value.Reply;
                source = AiConstants.SourceGroq;
                suggested = ResolveSuggestedProducts(llmResult.Value.ProductIds, catalogHits);
                if (suggested.Count == 0 && catalogHits.Count > 0 && LooksLikeProductIntent(message))
                    suggested = catalogHits.Take(AiConstants.MaxSuggestedProducts).ToList();
            }
        }

        var metaJson = BuildMetaJson(suggested, source);
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
            AssistantMessage = MapMessage(assistantMsg),
            SuggestedProducts = suggested.Select(MapSuggested).ToList(),
            Source = source
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
        return detail;
    }

    private async Task<(string Reply, IReadOnlyList<Guid> ProductIds)?> TryLlmReplyAsync(
        string message,
        IReadOnlyList<AiMessageRecord> history,
        IReadOnlyList<AiCompareProductRecord> catalogHits,
        CancellationToken cancellationToken)
    {
        var systemPrompt =
            """
            You are AIDR shopping assistant for a multi-vendor consumer electronics marketplace.
            Help buyers with product advice and shopping FAQs (shipping, payment, returns, vouchers, warranty).
            Reply in clear English. Be concise (2-5 short paragraphs or bullets).
            Use ONLY the catalog products provided in context when recommending; never invent product ids or prices.
            Return ONLY JSON: { "reply": string, "productIds": string[] }
            productIds may be empty when the question is FAQ-only. Max 5 productIds from the catalog context.
            """;

        var contextBlock = BuildCatalogContext(catalogHits);
        var turns = new List<LlmChatMessage>();
        foreach (var m in history)
        {
            if (m.Role is not (AiConstants.RoleUser or AiConstants.RoleAssistant))
                continue;
            turns.Add(new LlmChatMessage { Role = m.Role, Content = m.Content });
        }

        turns.Add(new LlmChatMessage
        {
            Role = AiConstants.RoleUser,
            Content =
                $"""
                Catalog context (JSON lines):
                {contextBlock}

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

            return (reply, ids);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse Groq shopping-assistant JSON.");
            return null;
        }
    }

    private static IReadOnlyList<AiCompareProductRecord> ResolveSuggestedProducts(
        IReadOnlyList<Guid> productIds,
        IReadOnlyList<AiCompareProductRecord> catalogHits)
    {
        if (productIds.Count == 0)
            return Array.Empty<AiCompareProductRecord>();

        var byId = catalogHits.ToDictionary(p => p.ProductId);
        var result = new List<AiCompareProductRecord>();
        foreach (var id in productIds.Distinct().Take(AiConstants.MaxSuggestedProducts))
        {
            if (byId.TryGetValue(id, out var product))
                result.Add(product);
        }

        return result;
    }

    private static (string Reply, IReadOnlyList<AiCompareProductRecord> Products) BuildHeuristicReply(
        string message,
        IReadOnlyList<AiCompareProductRecord> catalogHits)
    {
        var lower = message.ToLowerInvariant();
        var products = LooksLikeProductIntent(message)
            ? catalogHits.Take(AiConstants.MaxSuggestedProducts).ToList()
            : new List<AiCompareProductRecord>();

        if (ContainsAny(lower, "return", "refund", "trả hàng", "tra hang", "hoàn tiền", "hoan tien"))
        {
            return (
                "You can request a return with full refund from your order detail after delivery. " +
                "Upload unboxing/testing video evidence; our team reviews requests manually. " +
                "AIDR does not offer same-item exchange — after a refund you can place a new order.",
                products);
        }

        if (ContainsAny(lower, "shipping", "delivery", "ship", "vận chuyển", "van chuyen", "giao hàng", "giao hang"))
        {
            return (
                "After payment, the seller prepares and ships your order. Track status under My Orders " +
                "(Paid → Processing → Shipped → Delivered). Confirm received when the package arrives.",
                products);
        }

        if (ContainsAny(lower, "payment", "payos", "pay", "thanh toán", "thanh toan", "checkout"))
        {
            return (
                "Checkout creates a payOS payment link. Complete payment in the secure payOS window; " +
                "your order becomes Paid when the webhook confirms success. Unpaid orders can be cancelled from My Orders.",
                products);
        }

        if (ContainsAny(lower, "voucher", "coupon", "discount", "mã giảm", "ma giam", "khuyến mãi", "khuyen mai"))
        {
            return (
                "Apply available system or shop vouchers on the cart/checkout screen before creating the order. " +
                "Each voucher has min-order, expiry, and usage limits — invalid codes are rejected automatically.",
                products);
        }

        if (ContainsAny(lower, "warranty", "bảo hành", "bao hanh"))
        {
            return (
                "Warranty months are shown on each product page. For seller-specific warranty claims, " +
                "contact the shop via Chat from the product or order detail.",
                products);
        }

        if (products.Count > 0)
        {
            var sb = new StringBuilder();
            sb.AppendLine("Here are some Approved products that match your request:");
            foreach (var p in products)
            {
                var price = EffectivePrice(p);
                sb.AppendLine(CultureInfo.InvariantCulture,
                    $"- {p.Name} ({p.Brand ?? "—"}) — {price:0} {p.Currency}, rating {p.AvgRating:0.0}");
            }

            sb.Append("Open a product for specs, reviews, and Add to cart. You can also compare 2–5 products from the catalog.");
            return (sb.ToString().Trim(), products);
        }

        return (
            "I can help with product recommendations and shopping FAQs (shipping, payment, returns, vouchers, warranty). " +
            "Try asking for a brand/category (e.g. \"Samsung phone under 15 million\") or a policy question.",
            products);
    }

    private static bool LooksLikeProductIntent(string message)
    {
        var lower = message.ToLowerInvariant();
        return ContainsAny(lower,
            "recommend", "suggest", "buy", "phone", "laptop", "tablet", "watch", "headphone",
            "samsung", "apple", "iphone", "xiaomi", "asus", "macbook", "gợi ý", "goi y",
            "mua", "điện thoại", "dien thoai", "máy tính", "may tinh", "tai nghe", "đồng hồ", "dong ho",
            "laptop", "tablet", "under", "dưới", "duoi", "triệu", "trieu");
    }

    private static string ExtractSearchQuery(string message)
    {
        // Prefer brand/category-ish tokens; fall back to trimmed message.
        var cleaned = Regex.Replace(message, @"[^\p{L}\p{N}\s\-]", " ");
        cleaned = Regex.Replace(cleaned, @"\s+", " ").Trim();
        if (cleaned.Length > 80)
            cleaned = cleaned[..80];
        return cleaned;
    }

    private static string BuildCatalogContext(IReadOnlyList<AiCompareProductRecord> products)
    {
        if (products.Count == 0)
            return "(no matching Approved products)";

        var sb = new StringBuilder();
        foreach (var p in products)
        {
            var price = EffectivePrice(p);
            sb.AppendLine(CultureInfo.InvariantCulture,
                $"id={p.ProductId}; name={p.Name}; brand={p.Brand}; category={p.CategoryName}; " +
                $"price={price:0} {p.Currency}; rating={p.AvgRating:0.0}; reviews={p.ReviewCount}; slug={p.Slug}");
        }

        return sb.ToString().TrimEnd();
    }

    private static string? BuildMetaJson(IReadOnlyList<AiCompareProductRecord> products, string source)
    {
        var payload = new
        {
            productIds = products.Select(p => p.ProductId).ToArray(),
            source
        };
        return JsonSerializer.Serialize(payload);
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

    private static AiMessageDto MapMessage(AiMessageRecord m) => new()
    {
        AiMessageId = m.AiMessageId,
        Role = m.Role,
        Content = m.Content,
        MetaJson = m.MetaJson,
        CreatedAt = m.CreatedAt
    };

    private static AiSuggestedProductDto MapSuggested(AiCompareProductRecord p)
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
            ShopName = p.ShopName
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

    private sealed class ChatLlmPayload
    {
        public string? Reply { get; set; }
        public string[]? ProductIds { get; set; }
    }
}
