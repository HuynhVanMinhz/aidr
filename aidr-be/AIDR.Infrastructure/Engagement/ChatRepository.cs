using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Engagement;

public sealed class ChatRepository : IChatRepository
{
    private readonly AidrDbContext _db;

    public ChatRepository(AidrDbContext db) => _db = db;

    public async Task<PagedResult<ChatThreadDto>> ListThreadsAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _db.ChatThreads
            .AsNoTracking()
            .Where(t => t.BuyerUserId == userId || t.Shop.OwnerUserId == userId);

        var totalCount = await query.CountAsync(cancellationToken);

        var rows = await query
            .OrderByDescending(t => t.LastMessageAt ?? t.CreatedAt)
            .ThenByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.ThreadId,
                t.BuyerUserId,
                BuyerFullName = t.Buyer.FullName,
                BuyerAvatarUrl = t.Buyer.AvatarUrl,
                t.ShopId,
                ShopName = t.Shop.ShopName,
                ShopLogoUrl = t.Shop.LogoUrl,
                ShopOwnerUserId = t.Shop.OwnerUserId,
                t.ProductId,
                ProductName = t.Product != null ? t.Product.Name : null,
                t.LastMessageAt,
                t.CreatedAt,
                LastMessage = t.Messages
                    .OrderByDescending(m => m.CreatedAt)
                    .ThenByDescending(m => m.MessageId)
                    .Select(m => new
                    {
                        m.Content,
                        m.AttachmentUrl,
                        m.SenderUserId
                    })
                    .FirstOrDefault(),
                UnreadCount = t.Messages.Count(m => !m.IsRead && m.SenderUserId != userId)
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(t => new ChatThreadDto
        {
            ThreadId = t.ThreadId,
            BuyerUserId = t.BuyerUserId,
            BuyerFullName = t.BuyerFullName,
            BuyerAvatarUrl = t.BuyerAvatarUrl,
            ShopId = t.ShopId,
            ShopName = t.ShopName,
            ShopLogoUrl = t.ShopLogoUrl,
            ShopOwnerUserId = t.ShopOwnerUserId,
            ProductId = t.ProductId,
            ProductName = t.ProductName,
            LastMessagePreview = BuildPreview(t.LastMessage?.Content, t.LastMessage?.AttachmentUrl),
            LastMessageIsMine = t.LastMessage != null && t.LastMessage.SenderUserId == userId,
            LastMessageAt = t.LastMessageAt,
            UnreadCount = t.UnreadCount,
            MyRole = t.BuyerUserId == userId ? ChatConstants.RoleBuyer : ChatConstants.RoleSeller,
            CreatedAt = t.CreatedAt
        }).ToList();

        return new PagedResult<ChatThreadDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<ChatThreadDto?> GetThreadAsync(
        Guid userId,
        Guid threadId,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.ChatThreads
            .AsNoTracking()
            .Where(t => t.ThreadId == threadId
                        && (t.BuyerUserId == userId || t.Shop.OwnerUserId == userId))
            .Select(t => new
            {
                t.ThreadId,
                t.BuyerUserId,
                BuyerFullName = t.Buyer.FullName,
                BuyerAvatarUrl = t.Buyer.AvatarUrl,
                t.ShopId,
                ShopName = t.Shop.ShopName,
                ShopLogoUrl = t.Shop.LogoUrl,
                ShopOwnerUserId = t.Shop.OwnerUserId,
                t.ProductId,
                ProductName = t.Product != null ? t.Product.Name : null,
                t.LastMessageAt,
                t.CreatedAt,
                LastMessage = t.Messages
                    .OrderByDescending(m => m.CreatedAt)
                    .ThenByDescending(m => m.MessageId)
                    .Select(m => new
                    {
                        m.Content,
                        m.AttachmentUrl,
                        m.SenderUserId
                    })
                    .FirstOrDefault(),
                UnreadCount = t.Messages.Count(m => !m.IsRead && m.SenderUserId != userId)
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (row is null)
            return null;

        return new ChatThreadDto
        {
            ThreadId = row.ThreadId,
            BuyerUserId = row.BuyerUserId,
            BuyerFullName = row.BuyerFullName,
            BuyerAvatarUrl = row.BuyerAvatarUrl,
            ShopId = row.ShopId,
            ShopName = row.ShopName,
            ShopLogoUrl = row.ShopLogoUrl,
            ShopOwnerUserId = row.ShopOwnerUserId,
            ProductId = row.ProductId,
            ProductName = row.ProductName,
            LastMessagePreview = BuildPreview(row.LastMessage?.Content, row.LastMessage?.AttachmentUrl),
            LastMessageIsMine = row.LastMessage != null && row.LastMessage.SenderUserId == userId,
            LastMessageAt = row.LastMessageAt,
            UnreadCount = row.UnreadCount,
            MyRole = row.BuyerUserId == userId ? ChatConstants.RoleBuyer : ChatConstants.RoleSeller,
            CreatedAt = row.CreatedAt
        };
    }

    public Task<ChatThreadAccess?> GetThreadAccessAsync(
        Guid threadId,
        CancellationToken cancellationToken = default)
        => _db.ChatThreads
            .AsNoTracking()
            .Where(t => t.ThreadId == threadId)
            .Select(t => new ChatThreadAccess
            {
                ThreadId = t.ThreadId,
                BuyerUserId = t.BuyerUserId,
                ShopId = t.ShopId,
                ShopOwnerUserId = t.Shop.OwnerUserId,
                ProductId = t.ProductId
            })
            .FirstOrDefaultAsync(cancellationToken);

    public Task<ChatShopSnapshot?> GetShopAsync(
        Guid shopId,
        CancellationToken cancellationToken = default)
        => _db.Shops
            .AsNoTracking()
            .Where(s => s.ShopId == shopId)
            .Select(s => new ChatShopSnapshot
            {
                ShopId = s.ShopId,
                OwnerUserId = s.OwnerUserId,
                ShopName = s.ShopName,
                LogoUrl = s.LogoUrl,
                Status = s.Status
            })
            .FirstOrDefaultAsync(cancellationToken);

    public Task<ChatProductSnapshot?> GetProductAsync(
        Guid productId,
        CancellationToken cancellationToken = default)
        => _db.Products
            .AsNoTracking()
            .Where(p => p.ProductId == productId)
            .Select(p => new ChatProductSnapshot
            {
                ProductId = p.ProductId,
                ShopId = p.ShopId,
                Name = p.Name
            })
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<ChatThreadDto> GetOrCreateThreadAsync(
        Guid buyerUserId,
        Guid shopId,
        Guid? productId,
        CancellationToken cancellationToken = default)
    {
        var existing = await _db.ChatThreads
            .FirstOrDefaultAsync(
                t => t.BuyerUserId == buyerUserId && t.ShopId == shopId,
                cancellationToken);

        if (existing is not null)
        {
            if (productId is { } pid && existing.ProductId != pid)
            {
                existing.ProductId = pid;
                await _db.SaveChangesAsync(cancellationToken);
            }

            return (await GetThreadAsync(buyerUserId, existing.ThreadId, cancellationToken))!;
        }

        var entity = new ChatThread
        {
            ThreadId = Guid.NewGuid(),
            BuyerUserId = buyerUserId,
            ShopId = shopId,
            ProductId = productId,
            CreatedAt = DateTime.UtcNow
        };

        _db.ChatThreads.Add(entity);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            _db.Entry(entity).State = EntityState.Detached;
            var raced = await _db.ChatThreads
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    t => t.BuyerUserId == buyerUserId && t.ShopId == shopId,
                    cancellationToken)
                ?? throw new ConflictException("Unable to open chat thread.");

            return (await GetThreadAsync(buyerUserId, raced.ThreadId, cancellationToken))!;
        }

        return (await GetThreadAsync(buyerUserId, entity.ThreadId, cancellationToken))!;
    }

    public async Task<PagedResult<ChatMessageDto>> ListMessagesAsync(
        Guid userId,
        Guid threadId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _db.ChatMessages
            .AsNoTracking()
            .Where(m => m.ThreadId == threadId);

        var totalCount = await query.CountAsync(cancellationToken);

        var newestFirst = await query
            .OrderByDescending(m => m.CreatedAt)
            .ThenByDescending(m => m.MessageId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => new ChatMessageDto
            {
                MessageId = m.MessageId,
                ThreadId = m.ThreadId,
                SenderUserId = m.SenderUserId,
                SenderFullName = m.Sender.FullName,
                SenderAvatarUrl = m.Sender.AvatarUrl,
                Content = m.Content,
                AttachmentUrl = m.AttachmentUrl,
                IsRead = m.IsRead,
                IsMine = m.SenderUserId == userId,
                CreatedAt = m.CreatedAt
            })
            .ToListAsync(cancellationToken);

        newestFirst.Reverse();

        return new PagedResult<ChatMessageDto>
        {
            Items = newestFirst,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<ChatMessageDto> SendMessageAsync(
        Guid threadId,
        Guid senderUserId,
        string content,
        string? attachmentUrl,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var entity = new ChatMessage
        {
            MessageId = Guid.NewGuid(),
            ThreadId = threadId,
            SenderUserId = senderUserId,
            Content = content,
            AttachmentUrl = attachmentUrl,
            IsRead = false,
            CreatedAt = now
        };

        var thread = await _db.ChatThreads
            .FirstOrDefaultAsync(t => t.ThreadId == threadId, cancellationToken)
            ?? throw new NotFoundException("Chat thread not found.");

        thread.LastMessageAt = now;
        _db.ChatMessages.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        var sender = await _db.Users
            .AsNoTracking()
            .Where(u => u.UserId == senderUserId)
            .Select(u => new { u.FullName, u.AvatarUrl })
            .FirstAsync(cancellationToken);

        return new ChatMessageDto
        {
            MessageId = entity.MessageId,
            ThreadId = entity.ThreadId,
            SenderUserId = entity.SenderUserId,
            SenderFullName = sender.FullName,
            SenderAvatarUrl = sender.AvatarUrl,
            Content = entity.Content,
            AttachmentUrl = entity.AttachmentUrl,
            IsRead = entity.IsRead,
            IsMine = true,
            CreatedAt = entity.CreatedAt
        };
    }

    public Task<int> MarkThreadReadAsync(
        Guid userId,
        Guid threadId,
        CancellationToken cancellationToken = default)
        => _db.ChatMessages
            .Where(m => m.ThreadId == threadId && !m.IsRead && m.SenderUserId != userId)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(m => m.IsRead, true),
                cancellationToken);

    /// <summary>Thread previews fall back to a label when the last message was attachment-only.</summary>
    private static string? BuildPreview(string? content, string? attachmentUrl)
    {
        if (string.IsNullOrWhiteSpace(content))
            return string.IsNullOrWhiteSpace(attachmentUrl) ? null : ChatConstants.AttachmentPreview;

        var trimmed = content.Trim();
        return trimmed.Length <= ChatConstants.LastMessagePreviewLength
            ? trimmed
            : trimmed[..ChatConstants.LastMessagePreviewLength];
    }
}
