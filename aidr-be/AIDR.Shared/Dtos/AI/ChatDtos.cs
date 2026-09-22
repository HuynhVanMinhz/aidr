namespace AIDR.Shared.Dtos.AI;

public sealed class AiChatRequest
{
    /// <summary>Existing conversation; omit to start a new one.</summary>
    public Guid? ConversationId { get; set; }

    /// <summary>Buyer message text.</summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>Optional page / selection context from the storefront widget.</summary>
    public AiChatContextDto? Context { get; set; }

    /// <summary>
    /// Set when the buyer tapped a quick-reply chip - bypasses NLU and fills the slot directly.
    /// Format: <c>key=value</c> (e.g. <c>usecase=gaming</c>, <c>budget=:15000000</c>, <c>skip=budget</c>).
    /// </summary>
    public string? QuickReplyValue { get; set; }
}

public sealed class AiChatContextDto
{
    /// <summary>Current storefront path (e.g. /products/{id}).</summary>
    public string? Path { get; set; }

    /// <summary>Product currently viewed on PDP.</summary>
    public Guid? ProductId { get; set; }

    /// <summary>Ids currently in the compare tray (0–5).</summary>
    public List<Guid>? CompareProductIds { get; set; }
}

public sealed class AiChatSlotsDto
{
    public string? Q { get; init; }
    public int? CategoryId { get; init; }
    public string? CategoryName { get; init; }
    public string? Brand { get; init; }
    public decimal? MinPrice { get; init; }
    public decimal? MaxPrice { get; init; }
    public decimal? MinRating { get; init; }

    /// <summary>newest | price_asc | price_desc | popular | rating</summary>
    public string? Sort { get; init; }
}

public sealed class AiQuickReplyDto
{
    /// <summary>category | budget | useCase | priority | skip</summary>
    public string Key { get; init; } = null!;

    /// <summary>Text shown on the chip.</summary>
    public string Label { get; init; } = null!;

    /// <summary>Opaque value echoed back as <see cref="AiChatRequest.QuickReplyValue"/>.</summary>
    public string Value { get; init; } = null!;
}

public sealed class AiConsultStateDto
{
    /// <summary>collecting | ready | presented</summary>
    public string Stage { get; init; } = null!;

    public int AskedCount { get; init; }

    public int MaxQuestions { get; init; }

    /// <summary>Question the assistant is waiting an answer for, if any.</summary>
    public string? PendingQuestion { get; init; }
}

public sealed class AiChatActionDto
{
    /// <summary>open_catalog | open_compare | open_product | open_orders | none</summary>
    public string Type { get; init; } = "none";

    public string? Label { get; init; }

    public IReadOnlyList<Guid>? ProductIds { get; init; }
}

public sealed class AiMessageDto
{
    public long AiMessageId { get; init; }
    public string Role { get; init; } = null!;
    public string Content { get; init; } = null!;
    public string? MetaJson { get; init; }
    public DateTime CreatedAt { get; init; }

    /// <summary>Hydrated from MetaJson on conversation detail / latest chat turn.</summary>
    public IReadOnlyList<AiSuggestedProductDto>? SuggestedProducts { get; init; }
}

public sealed class AiSuggestedProductDto
{
    public Guid ProductId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? Brand { get; init; }
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public decimal EffectivePrice { get; init; }
    public string Currency { get; init; } = "VND";
    public decimal AvgRating { get; init; }
    public int ReviewCount { get; init; }
    public string? PrimaryImageUrl { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;

    /// <summary>Short grounded reason for this suggestion.</summary>
    public string? Reason { get; init; }

    /// <summary>Best match | Cheaper option | Step up - set on guided-consultation results.</summary>
    public string? Badge { get; init; }
}

public sealed class AiChatResultDto
{
    public Guid ConversationId { get; init; }
    public string? Title { get; init; }
    public AiMessageDto UserMessage { get; init; } = null!;
    public AiMessageDto AssistantMessage { get; init; } = null!;
    public IReadOnlyList<AiSuggestedProductDto> SuggestedProducts { get; init; } =
        Array.Empty<AiSuggestedProductDto>();

    /// <summary>groq | heuristic</summary>
    public string Source { get; init; } = null!;

    /// <summary>recommend | refine | product_qa | compare | faq | browse | clarify | smalltalk</summary>
    public string? Intent { get; init; }

    /// <summary>Active preference slots after this turn.</summary>
    public AiChatSlotsDto? Slots { get; init; }

    public IReadOnlyList<AiChatActionDto> Actions { get; init; } = Array.Empty<AiChatActionDto>();

    /// <summary>Tap-to-answer chips for the current consultation question.</summary>
    public IReadOnlyList<AiQuickReplyDto> QuickReplies { get; init; } = Array.Empty<AiQuickReplyDto>();

    /// <summary>Guided-consultation progress, when a consultation round is active.</summary>
    public AiConsultStateDto? Consult { get; init; }

    /// <summary>Follow-up act applied this turn (show_more, explain, …), when any.</summary>
    public string? FollowUpAct { get; init; }

    /// <summary>Product the dialogue is currently focused on.</summary>
    public Guid? FocusProductId { get; init; }

    /// <summary>Cards shown on the last present turn (ordinal / badge / price).</summary>
    public IReadOnlyList<AiDialogueLastShownDto>? LastShown { get; init; }
}

public sealed class AiDialogueLastShownDto
{
    public Guid ProductId { get; init; }
    public string? Badge { get; init; }
    public decimal Price { get; init; }
    public int Ordinal { get; init; }
}

public sealed class AiConversationSummaryDto
{
    public Guid ConversationId { get; init; }
    public string Channel { get; init; } = null!;
    public string? Title { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public string? LastMessagePreview { get; init; }
    public int MessageCount { get; init; }
}

public sealed class AiConversationDetailDto
{
    public Guid ConversationId { get; init; }
    public string Channel { get; init; } = null!;
    public string? Title { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public IReadOnlyList<AiMessageDto> Messages { get; init; } = Array.Empty<AiMessageDto>();
}
