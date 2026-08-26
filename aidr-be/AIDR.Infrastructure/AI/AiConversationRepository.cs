using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Dtos.Discovery;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.AI;

public sealed class AiConversationRepository : IAiConversationRepository
{
    private readonly AidrDbContext _db;

    public AiConversationRepository(AidrDbContext db) => _db = db;

    public async Task<PagedResult<AiConversationSummaryDto>> ListConversationsAsync(
        Guid userId,
        string channel,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _db.AiConversations.AsNoTracking()
            .Where(c => c.UserId == userId && c.Channel == channel);

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(c => c.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new AiConversationSummaryDto
            {
                ConversationId = c.ConversationId,
                Channel = c.Channel,
                Title = c.Title,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt,
                MessageCount = c.Messages.Count,
                LastMessagePreview = c.Messages
                    .OrderByDescending(m => m.CreatedAt)
                    .Select(m => m.Content.Length > 120 ? m.Content.Substring(0, 120) : m.Content)
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        return new PagedResult<AiConversationSummaryDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        };
    }

    public async Task<AiConversationDetailDto?> GetConversationAsync(
        Guid userId,
        Guid conversationId,
        CancellationToken cancellationToken = default)
    {
        var conversation = await _db.AiConversations.AsNoTracking()
            .Where(c => c.ConversationId == conversationId && c.UserId == userId)
            .Select(c => new
            {
                c.ConversationId,
                c.Channel,
                c.Title,
                c.CreatedAt,
                c.UpdatedAt
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (conversation is null)
            return null;

        var messages = await _db.AiMessages.AsNoTracking()
            .Where(m => m.ConversationId == conversationId)
            .OrderBy(m => m.CreatedAt)
            .ThenBy(m => m.AiMessageId)
            .Select(m => new AiMessageDto
            {
                AiMessageId = m.AiMessageId,
                Role = m.Role,
                Content = m.Content,
                MetaJson = m.MetaJson,
                CreatedAt = m.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return new AiConversationDetailDto
        {
            ConversationId = conversation.ConversationId,
            Channel = conversation.Channel,
            Title = conversation.Title,
            CreatedAt = conversation.CreatedAt,
            UpdatedAt = conversation.UpdatedAt,
            Messages = messages
        };
    }

    public async Task<AiConversationRecord?> GetOwnedConversationAsync(
        Guid userId,
        Guid conversationId,
        CancellationToken cancellationToken = default)
    {
        return await _db.AiConversations.AsNoTracking()
            .Where(c => c.ConversationId == conversationId && c.UserId == userId)
            .Select(c => new AiConversationRecord
            {
                ConversationId = c.ConversationId,
                UserId = c.UserId,
                Channel = c.Channel,
                Title = c.Title,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            })
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<AiConversationRecord> CreateConversationAsync(
        Guid userId,
        string channel,
        string? title,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var entity = new AiConversation
        {
            ConversationId = Guid.NewGuid(),
            UserId = userId,
            Channel = channel,
            Title = title,
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.AiConversations.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        return new AiConversationRecord
        {
            ConversationId = entity.ConversationId,
            UserId = entity.UserId,
            Channel = entity.Channel,
            Title = entity.Title,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt
        };
    }

    public async Task UpdateConversationTitleAsync(
        Guid conversationId,
        string title,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.AiConversations
            .FirstOrDefaultAsync(c => c.ConversationId == conversationId, cancellationToken);
        if (entity is null)
            return;

        entity.Title = title;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task TouchConversationAsync(
        Guid conversationId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.AiConversations
            .FirstOrDefaultAsync(c => c.ConversationId == conversationId, cancellationToken);
        if (entity is null)
            return;

        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AiMessageRecord>> GetRecentMessagesAsync(
        Guid conversationId,
        int take,
        CancellationToken cancellationToken = default)
    {
        take = Math.Clamp(take, 1, AiConstants.MaxChatHistoryMessages * 2);
        var newest = await _db.AiMessages.AsNoTracking()
            .Where(m => m.ConversationId == conversationId)
            .OrderByDescending(m => m.CreatedAt)
            .ThenByDescending(m => m.AiMessageId)
            .Take(take)
            .Select(m => new AiMessageRecord
            {
                AiMessageId = m.AiMessageId,
                ConversationId = m.ConversationId,
                Role = m.Role,
                Content = m.Content,
                MetaJson = m.MetaJson,
                CreatedAt = m.CreatedAt
            })
            .ToListAsync(cancellationToken);

        newest.Reverse();
        return newest;
    }

    public async Task<(AiMessageRecord User, AiMessageRecord Assistant)> AppendTurnAsync(
        Guid conversationId,
        string userContent,
        string assistantContent,
        string? assistantMetaJson,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var userMsg = new AiMessage
        {
            ConversationId = conversationId,
            Role = AiConstants.RoleUser,
            Content = userContent,
            CreatedAt = now
        };
        var assistantMsg = new AiMessage
        {
            ConversationId = conversationId,
            Role = AiConstants.RoleAssistant,
            Content = assistantContent,
            MetaJson = assistantMetaJson,
            CreatedAt = now.AddMilliseconds(1)
        };

        _db.AiMessages.Add(userMsg);
        _db.AiMessages.Add(assistantMsg);

        var conversation = await _db.AiConversations
            .FirstOrDefaultAsync(c => c.ConversationId == conversationId, cancellationToken);
        if (conversation is not null)
            conversation.UpdatedAt = now;

        await _db.SaveChangesAsync(cancellationToken);

        return (
            new AiMessageRecord
            {
                AiMessageId = userMsg.AiMessageId,
                ConversationId = userMsg.ConversationId,
                Role = userMsg.Role,
                Content = userMsg.Content,
                MetaJson = userMsg.MetaJson,
                CreatedAt = userMsg.CreatedAt
            },
            new AiMessageRecord
            {
                AiMessageId = assistantMsg.AiMessageId,
                ConversationId = assistantMsg.ConversationId,
                Role = assistantMsg.Role,
                Content = assistantMsg.Content,
                MetaJson = assistantMsg.MetaJson,
                CreatedAt = assistantMsg.CreatedAt
            });
    }
}
