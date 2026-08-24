using AIDR.Shared.Dtos.Admin;

namespace AIDR.Modules.Admin.Abstractions;

public interface IAdminCategoryService
{
    Task<AdminCategoryListResultDto> ListAsync(
        string? q,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AdminCategoryOptionDto>> ListOptionsAsync(
        CancellationToken cancellationToken = default);

    Task<AdminCategoryDto> GetByIdAsync(int categoryId, CancellationToken cancellationToken = default);

    Task<AdminCategoryDto> CreateAsync(CreateCategoryRequest request, CancellationToken cancellationToken = default);

    Task<AdminCategoryDto> UpdateAsync(
        int categoryId,
        UpdateCategoryRequest request,
        CancellationToken cancellationToken = default);

    Task<AdminCategoryDto> UpdateStatusAsync(
        int categoryId,
        UpdateCategoryStatusRequest request,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(int categoryId, CancellationToken cancellationToken = default);
}
