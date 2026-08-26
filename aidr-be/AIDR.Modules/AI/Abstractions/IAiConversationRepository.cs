using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Dtos.Discovery;

namespace AIDR.Modules.AI.Abstractions;

public sealed class AiConversationRecord
{
    public Guid ConversationId { get; init; }
    public Guid UserId { get; init; }
    public string Channel { get; init; } = null!;
    public string? Title { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public sealed class AiMessageRecord
{
    public long AiMessageId { get; init; }
    public Guid ConversationId { get; init; }
    public string Role { get; init; } = null!;
    public string Content { get; init; } = null!;
    public string? MetaJson { get; init; }
    public DateTime CreatedAt { get; init; }
}

public interface IAiConversationRepository
{
    Task<PagedResult<AiConversationSummaryDto>> ListConversationsAsync(
        Guid userId,
        string channel,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<AiConversationDetailDto?> GetConversationAsync(
        Guid userId,
        Guid conversationId,
        CancellationToken cancellationToken = default);

    Task<AiConversationRecord?> GetOwnedConversationAsync(
        Guid userId,
        Guid conversationId,
        CancellationToken cancellationToken = default);

    Task<AiConversationRecord> CreateConversationAsync(
        Guid userId,
        string channel,
        string? title,
        CancellationToken cancellationToken = default);

    Task UpdateConversationTitleAsync(
        Guid conversationId,
        string title,
        CancellationToken cancellationToken = default);

    Task TouchConversationAsync(
        Guid conversationId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AiMessageRecord>> GetRecentMessagesAsync(
        Guid conversationId,
        int take,
        CancellationToken cancellationToken = default);

    Task<(AiMessageRecord User, AiMessageRecord Assistant)> AppendTurnAsync(
        Guid conversationId,
        string userContent,
        string assistantContent,
        string? assistantMetaJson,
        CancellationToken cancellationToken = default);
}
