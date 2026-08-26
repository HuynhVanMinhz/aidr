namespace AIDR.Shared.Dtos.AI;

public sealed class AiChatRequest
{
    /// <summary>Existing conversation; omit to start a new one.</summary>
    public Guid? ConversationId { get; set; }

    /// <summary>Buyer message text.</summary>
    public string Message { get; set; } = string.Empty;
}

public sealed class AiMessageDto
{
    public long AiMessageId { get; init; }
    public string Role { get; init; } = null!;
    public string Content { get; init; } = null!;
    public string? MetaJson { get; init; }
    public DateTime CreatedAt { get; init; }
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
