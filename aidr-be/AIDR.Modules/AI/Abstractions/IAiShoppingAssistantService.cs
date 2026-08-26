using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Dtos.Discovery;

namespace AIDR.Modules.AI.Abstractions;

public interface IAiShoppingAssistantService
{
    Task<AiChatResultDto> ChatAsync(
        Guid userId,
        AiChatRequest request,
        CancellationToken cancellationToken = default);

    Task<PagedResult<AiConversationSummaryDto>> ListConversationsAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<AiConversationDetailDto> GetConversationAsync(
        Guid userId,
        Guid conversationId,
        CancellationToken cancellationToken = default);
}
