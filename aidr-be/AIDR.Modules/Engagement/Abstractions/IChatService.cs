using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;

namespace AIDR.Modules.Engagement.Abstractions;

public sealed class ChatShopSnapshot
{
    public Guid ShopId { get; init; }
    public Guid OwnerUserId { get; init; }
    public string ShopName { get; init; } = null!;
    public string? LogoUrl { get; init; }
    public string Status { get; init; } = null!;
}

public sealed class ChatProductSnapshot
{
    public Guid ProductId { get; init; }
    public Guid ShopId { get; init; }
    public string Name { get; init; } = null!;
}

public sealed class ChatThreadAccess
{
    public Guid ThreadId { get; init; }
    public Guid BuyerUserId { get; init; }
    public Guid ShopId { get; init; }
    public Guid ShopOwnerUserId { get; init; }
    public Guid? ProductId { get; init; }
}

public interface IChatRepository
{
    Task<PagedResult<ChatThreadDto>> ListThreadsAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<ChatThreadDto?> GetThreadAsync(
        Guid userId,
        Guid threadId,
        CancellationToken cancellationToken = default);

    Task<ChatThreadAccess?> GetThreadAccessAsync(
        Guid threadId,
        CancellationToken cancellationToken = default);

    Task<ChatShopSnapshot?> GetShopAsync(
        Guid shopId,
        CancellationToken cancellationToken = default);

    Task<ChatProductSnapshot?> GetProductAsync(
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<ChatThreadDto> GetOrCreateThreadAsync(
        Guid buyerUserId,
        Guid shopId,
        Guid? productId,
        CancellationToken cancellationToken = default);

    Task<PagedResult<ChatMessageDto>> ListMessagesAsync(
        Guid userId,
        Guid threadId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<ChatMessageDto> SendMessageAsync(
        Guid threadId,
        Guid senderUserId,
        string content,
        string? attachmentUrl,
        CancellationToken cancellationToken = default);

    Task<int> MarkThreadReadAsync(
        Guid userId,
        Guid threadId,
        CancellationToken cancellationToken = default);
}

public interface IChatRealtimePublisher
{
    /// <summary>
    /// Fan a new message out to every connection of both participants. Each recipient gets the
    /// payload with <see cref="ChatMessageDto.IsMine"/> resolved from their own perspective.
    /// </summary>
    Task PublishMessageAsync(
        ChatMessageDto message,
        IReadOnlyCollection<Guid> recipientUserIds,
        CancellationToken cancellationToken = default);

    Task PublishThreadReadAsync(
        ChatThreadReadEvent readEvent,
        IReadOnlyCollection<Guid> recipientUserIds,
        CancellationToken cancellationToken = default);

    Task PublishTypingAsync(
        ChatTypingEvent typingEvent,
        IReadOnlyCollection<Guid> recipientUserIds,
        CancellationToken cancellationToken = default);
}

public interface IChatService
{
    Task<PagedResult<ChatThreadDto>> ListThreadsAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<ChatThreadDto> GetThreadAsync(
        Guid userId,
        Guid threadId,
        CancellationToken cancellationToken = default);

    Task<ChatThreadDto> OpenThreadAsync(
        Guid userId,
        OpenChatThreadRequest request,
        CancellationToken cancellationToken = default);

    Task<PagedResult<ChatMessageDto>> ListMessagesAsync(
        Guid userId,
        Guid threadId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<ChatMessageDto> SendMessageAsync(
        Guid userId,
        Guid threadId,
        SendChatMessageRequest request,
        CancellationToken cancellationToken = default);

    Task<MarkChatThreadReadResponse> MarkReadAsync(
        Guid userId,
        Guid threadId,
        CancellationToken cancellationToken = default);

    Task EnsureThreadParticipantAsync(
        Guid userId,
        Guid threadId,
        CancellationToken cancellationToken = default);

    /// <summary>Relay a typing signal to the other participant of the thread.</summary>
    Task NotifyTypingAsync(
        Guid userId,
        Guid threadId,
        bool isTyping,
        CancellationToken cancellationToken = default);
}
