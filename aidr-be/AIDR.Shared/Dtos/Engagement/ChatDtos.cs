namespace AIDR.Shared.Dtos.Engagement;

public sealed class ChatThreadDto
{
    public Guid ThreadId { get; init; }
    public Guid BuyerUserId { get; init; }
    public string BuyerFullName { get; init; } = null!;
    public string? BuyerAvatarUrl { get; init; }
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string? ShopLogoUrl { get; init; }
    public Guid ShopOwnerUserId { get; init; }
    public Guid? ProductId { get; init; }
    public string? ProductName { get; init; }
    public string? LastMessagePreview { get; init; }
    public DateTime? LastMessageAt { get; init; }
    public int UnreadCount { get; init; }
    public string MyRole { get; init; } = null!;
    public DateTime CreatedAt { get; init; }
}

public sealed class ChatMessageDto
{
    public Guid MessageId { get; init; }
    public Guid ThreadId { get; init; }
    public Guid SenderUserId { get; init; }
    public string SenderFullName { get; init; } = null!;
    public string? SenderAvatarUrl { get; init; }
    public string Content { get; init; } = null!;
    public string? AttachmentUrl { get; init; }
    public bool IsRead { get; init; }
    public bool IsMine { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class OpenChatThreadRequest
{
    public Guid ShopId { get; init; }
    public Guid? ProductId { get; init; }
}

public sealed class SendChatMessageRequest
{
    public string? Content { get; init; }
    public string? AttachmentUrl { get; init; }
}

public sealed class MarkChatThreadReadResponse
{
    public Guid ThreadId { get; init; }
    public int UpdatedCount { get; init; }
}
