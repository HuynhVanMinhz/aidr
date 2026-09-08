using AIDR.Shared.Dtos.Order;

namespace AIDR.Modules.Order.Abstractions;

public interface IBuyerProtectionTimelineService
{
    Task<BuyerProtectionTimelineDto> GetTimelineAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default);
}
