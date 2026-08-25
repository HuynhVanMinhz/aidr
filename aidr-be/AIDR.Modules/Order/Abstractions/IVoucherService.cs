using AIDR.Shared.Dtos.Order;

namespace AIDR.Modules.Order.Abstractions;

public interface IVoucherService
{
    Task<VoucherListResultDto> ListAvailableAsync(
        Guid buyerUserId,
        IReadOnlyCollection<Guid>? cartItemIds,
        string? scope,
        Guid? shopId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<ApplyVoucherPreviewResponse> PreviewAsync(
        Guid buyerUserId,
        ApplyVoucherPreviewRequest request,
        CancellationToken cancellationToken = default);
}
