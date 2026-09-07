using AIDR.Shared.Dtos.AI;

namespace AIDR.Modules.AI.Abstractions;

public interface IAiAnalyticsService
{
    Task<AiAnalyticsBriefDto> GetAdminBriefAsync(
        AiAnalyticsBriefQueryRequest request,
        CancellationToken cancellationToken = default);

    Task<AiAnalyticsBriefDto> GetSellerBriefAsync(
        Guid ownerUserId,
        AiAnalyticsBriefQueryRequest request,
        CancellationToken cancellationToken = default);
}
