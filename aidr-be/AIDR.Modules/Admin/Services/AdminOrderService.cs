using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Admin.Services;

public sealed class AdminOrderService : IAdminOrderService
{
    private readonly IAdminOrderRepository _repository;

    public AdminOrderService(IAdminOrderRepository repository) => _repository = repository;

    public async Task<AdminOrderListResultDto> ListAsync(
        string? status,
        string? q,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var normalizedStatus = NormalizeStatusFilter(status);
        var (normalizedPage, normalizedPageSize) = AdminConstants.NormalizePaging(page, pageSize);
        var keyword = NormalizeSearch(q);

        var (items, totalCount, effectivePage) = await _repository.ListPagedAsync(
            normalizedStatus,
            keyword,
            normalizedPage,
            normalizedPageSize,
            cancellationToken);

        return new AdminOrderListResultDto
        {
            Items = items,
            Page = effectivePage,
            PageSize = normalizedPageSize,
            TotalCount = totalCount
        };
    }

    public async Task<AdminOrderDetailDto> GetByIdAsync(
        Guid orderId,
        CancellationToken cancellationToken = default)
    {
        if (orderId == Guid.Empty)
            throw new AppException("Order id is required.");

        return await _repository.GetByIdAsync(orderId, cancellationToken)
            ?? throw new NotFoundException("Order not found.");
    }

    private static string? NormalizeStatusFilter(string? status)
    {
        if (string.IsNullOrWhiteSpace(status) ||
            string.Equals(status.Trim(), "all", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var trimmed = status.Trim();
        var match = OrderConstants.BuyerListStatuses.FirstOrDefault(s =>
            string.Equals(s, trimmed, StringComparison.OrdinalIgnoreCase));

        if (match is null)
            throw new AppException("Status filter is invalid. Pass a known order status or all.");

        return match;
    }

    private static string? NormalizeSearch(string? q)
    {
        if (string.IsNullOrWhiteSpace(q))
            return null;

        var trimmed = q.Trim();
        if (trimmed.Length > AdminConstants.MaxListSearchLength)
        {
            throw new AppException(
                $"Search query must not exceed {AdminConstants.MaxListSearchLength} characters.");
        }

        return trimmed;
    }
}
