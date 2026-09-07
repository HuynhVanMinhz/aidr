using AIDR.Shared.Dtos.Admin;

namespace AIDR.Modules.Admin.Abstractions;

public interface IAdminProductModerationService
{
    Task<AdminProductListResultDto> ListAsync(
        string? status,
        string? q,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<AdminProductDetailDto> GetByIdAsync(
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<AdminProductDetailDto> ApproveAsync(
        Guid productId,
        Guid adminUserId,
        CancellationToken cancellationToken = default);

    Task<BulkApproveProductsResultDto> ApproveBulkAsync(
        BulkApproveProductsRequest request,
        Guid adminUserId,
        CancellationToken cancellationToken = default);

    Task<AdminProductDetailDto> RejectAsync(
        Guid productId,
        Guid adminUserId,
        RejectProductRequest request,
        CancellationToken cancellationToken = default);

    Task<ProductModerationHistoryResultDto> GetModerationHistoryAsync(
        Guid productId,
        CancellationToken cancellationToken = default);
}
