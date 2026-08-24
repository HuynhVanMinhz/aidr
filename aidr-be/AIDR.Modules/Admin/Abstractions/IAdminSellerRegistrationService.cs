using AIDR.Shared.Dtos.Admin;

namespace AIDR.Modules.Admin.Abstractions;

public interface IAdminSellerRegistrationService
{
    Task<IReadOnlyList<AdminSellerRegistrationDto>> ListAsync(
        string? status,
        CancellationToken cancellationToken = default);

    Task<AdminSellerRegistrationDto> GetByIdAsync(
        Guid requestId,
        CancellationToken cancellationToken = default);

    Task<ApproveSellerRegistrationResultDto> ApproveAsync(
        Guid requestId,
        Guid adminUserId,
        CancellationToken cancellationToken = default);

    Task<AdminSellerRegistrationDto> RejectAsync(
        Guid requestId,
        Guid adminUserId,
        RejectSellerRegistrationRequest request,
        CancellationToken cancellationToken = default);
}
