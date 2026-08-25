using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;

namespace AIDR.Modules.Engagement.Services;

public sealed class ChatService : IChatService
{
    private readonly IChatRepository _chats;
    private readonly IChatRealtimePublisher _realtime;
    private readonly INotificationService _notifications;
    private readonly ILogger<ChatService> _logger;

    public ChatService(
        IChatRepository chats,
        IChatRealtimePublisher realtime,
        INotificationService notifications,
        ILogger<ChatService> logger)
    {
        _chats = chats;
        _realtime = realtime;
        _notifications = notifications;
        _logger = logger;
    }

    public Task<PagedResult<ChatThreadDto>> ListThreadsAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId);
        var (normalizedPage, normalizedSize) = ChatConstants.NormalizeThreadPaging(page, pageSize);
        return _chats.ListThreadsAsync(userId, normalizedPage, normalizedSize, cancellationToken);
    }

    public async Task<ChatThreadDto> GetThreadAsync(
        Guid userId,
        Guid threadId,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId);
        EnsureThreadId(threadId);

        return await _chats.GetThreadAsync(userId, threadId, cancellationToken)
            ?? throw new NotFoundException("Chat thread not found.");
    }

    public async Task<ChatThreadDto> OpenThreadAsync(
        Guid userId,
        OpenChatThreadRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId);
        if (request is null)
            throw new AppException("Chat thread body is required.");
        if (request.ShopId == Guid.Empty)
            throw new AppException("Shop id is required.");

        var shop = await _chats.GetShopAsync(request.ShopId, cancellationToken)
            ?? throw new NotFoundException("Shop not found.");

        if (!string.Equals(shop.Status, ChatConstants.ActiveShopStatus, StringComparison.OrdinalIgnoreCase))
            throw new AppException("Shop is not available.");

        if (shop.OwnerUserId == userId)
            throw new AppException("You cannot chat with your own shop.");

        Guid? productId = null;
        if (request.ProductId is { } pid)
        {
            if (pid == Guid.Empty)
                throw new AppException("Product id is invalid.");

            var product = await _chats.GetProductAsync(pid, cancellationToken)
                ?? throw new NotFoundException("Product not found.");

            if (product.ShopId != shop.ShopId)
                throw new AppException("Product does not belong to this shop.");

            productId = product.ProductId;
        }

        return await _chats.GetOrCreateThreadAsync(userId, shop.ShopId, productId, cancellationToken);
    }

    public async Task<PagedResult<ChatMessageDto>> ListMessagesAsync(
        Guid userId,
        Guid threadId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId);
        EnsureThreadId(threadId);
        await EnsureThreadParticipantAsync(userId, threadId, cancellationToken);

        var (normalizedPage, normalizedSize) = ChatConstants.NormalizeMessagePaging(page, pageSize);
        return await _chats.ListMessagesAsync(
            userId,
            threadId,
            normalizedPage,
            normalizedSize,
            cancellationToken);
    }

    public async Task<ChatMessageDto> SendMessageAsync(
        Guid userId,
        Guid threadId,
        SendChatMessageRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId);
        EnsureThreadId(threadId);
        if (request is null)
            throw new AppException("Message body is required.");

        var access = await GetThreadAccessForParticipantAsync(userId, threadId, cancellationToken);
        var (content, attachmentUrl) = NormalizeMessagePayload(request);

        var message = await _chats.SendMessageAsync(
            threadId,
            userId,
            content,
            attachmentUrl,
            cancellationToken);

        try
        {
            await _realtime.PublishMessageAsync(threadId, message, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to push chat message {MessageId} to thread {ThreadId} over SignalR",
                message.MessageId,
                threadId);
        }

        var recipientUserId = access.BuyerUserId == userId
            ? access.ShopOwnerUserId
            : access.BuyerUserId;

        await NotifyRecipientAsync(recipientUserId, access, message, cancellationToken);

        return message;
    }

    public async Task<MarkChatThreadReadResponse> MarkReadAsync(
        Guid userId,
        Guid threadId,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(userId);
        EnsureThreadId(threadId);
        await EnsureThreadParticipantAsync(userId, threadId, cancellationToken);

        var updatedCount = await _chats.MarkThreadReadAsync(userId, threadId, cancellationToken);
        return new MarkChatThreadReadResponse
        {
            ThreadId = threadId,
            UpdatedCount = updatedCount
        };
    }

    public async Task EnsureThreadParticipantAsync(
        Guid userId,
        Guid threadId,
        CancellationToken cancellationToken = default)
    {
        await GetThreadAccessForParticipantAsync(userId, threadId, cancellationToken);
    }

    private async Task<ChatThreadAccess> GetThreadAccessForParticipantAsync(
        Guid userId,
        Guid threadId,
        CancellationToken cancellationToken)
    {
        var access = await _chats.GetThreadAccessAsync(threadId, cancellationToken)
            ?? throw new NotFoundException("Chat thread not found.");

        if (access.BuyerUserId != userId && access.ShopOwnerUserId != userId)
            throw new ForbiddenAppException("You are not a participant of this chat thread.");

        return access;
    }

    private async Task NotifyRecipientAsync(
        Guid recipientUserId,
        ChatThreadAccess access,
        ChatMessageDto message,
        CancellationToken cancellationToken)
    {
        if (recipientUserId == Guid.Empty || recipientUserId == message.SenderUserId)
            return;

        var preview = string.IsNullOrWhiteSpace(message.Content)
            ? "Sent an attachment."
            : message.Content.Trim();

        if (preview.Length > 160)
            preview = preview[..160];

        try
        {
            await _notifications.CreateAsync(
                new CreateNotificationRequest
                {
                    UserId = recipientUserId,
                    Title = "New chat message",
                    Body = $"{message.SenderFullName}: {preview}",
                    Type = NotificationConstants.TypeChat,
                    ReferenceType = NotificationConstants.RefChatThread,
                    ReferenceId = access.ThreadId
                },
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to create chat notification for user {UserId} on thread {ThreadId}",
                recipientUserId,
                access.ThreadId);
        }
    }

    private static (string Content, string? AttachmentUrl) NormalizeMessagePayload(
        SendChatMessageRequest request)
    {
        var content = request.Content?.Trim() ?? string.Empty;
        string? attachmentUrl = null;

        if (!string.IsNullOrWhiteSpace(request.AttachmentUrl))
        {
            attachmentUrl = request.AttachmentUrl.Trim();
            if (attachmentUrl.Length > ChatConstants.MaxAttachmentUrlLength)
            {
                throw new AppException(
                    $"Attachment url must not exceed {ChatConstants.MaxAttachmentUrlLength} characters.");
            }
        }

        if (content.Length == 0 && attachmentUrl is null)
            throw new AppException("Message content or attachment is required.");

        if (content.Length > ChatConstants.MaxContentLength)
        {
            throw new AppException(
                $"Message content must not exceed {ChatConstants.MaxContentLength} characters.");
        }

        return (content, attachmentUrl);
    }

    private static void EnsureUserId(Guid userId)
    {
        if (userId == Guid.Empty)
            throw new AppException("User id is required.");
    }

    private static void EnsureThreadId(Guid threadId)
    {
        if (threadId == Guid.Empty)
            throw new AppException("Thread id is required.");
    }
}
