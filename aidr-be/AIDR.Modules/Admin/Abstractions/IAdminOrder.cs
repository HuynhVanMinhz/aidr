using AIDR.Shared.Dtos.Admin;

namespace AIDR.Modules.Admin.Abstractions;

public interface IAdminOrderRepository
{
    Task<(IReadOnlyList<AdminOrderListItemDto> Items, int TotalCount, int EffectivePage)> ListPagedAsync(
        string? status,
        string? keyword,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<AdminOrderDetailDto?> GetByIdAsync(
        Guid orderId,
        CancellationToken cancellationToken = default);
}

public interface IAdminOrderService
{
    Task<AdminOrderListResultDto> ListAsync(
        string? status,
        string? q,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<AdminOrderDetailDto> GetByIdAsync(
        Guid orderId,
        CancellationToken cancellationToken = default);
}
