namespace AIDR.Modules.Admin.Abstractions;

public sealed class AdminCategoryRecord
{
    public int CategoryId { get; init; }
    public int? ParentId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string Description { get; init; } = null!;
    public string ImageUrl { get; init; } = null!;
    public int SortOrder { get; init; }
    public bool IsActive { get; init; }
    public int ProductCount { get; init; }
    public int ChildCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public interface IAdminCategoryRepository
{
    Task<IReadOnlyList<AdminCategoryRecord>> ListAsync(CancellationToken cancellationToken = default);

    Task<AdminCategoryRecord?> GetByIdAsync(int categoryId, CancellationToken cancellationToken = default);

    Task<bool> SlugExistsAsync(string slug, int? excludeCategoryId = null, CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(int categoryId, CancellationToken cancellationToken = default);

    Task<int> GetProductCountAsync(int categoryId, CancellationToken cancellationToken = default);

    Task<int> GetChildCountAsync(int categoryId, CancellationToken cancellationToken = default);

    Task<AdminCategoryRecord> CreateAsync(
        string name,
        string slug,
        string description,
        string imageUrl,
        int? parentId,
        int sortOrder,
        bool isActive,
        CancellationToken cancellationToken = default);

    Task<AdminCategoryRecord> UpdateAsync(
        int categoryId,
        string name,
        string description,
        string imageUrl,
        int sortOrder,
        CancellationToken cancellationToken = default);

    Task<AdminCategoryRecord> UpdateStatusAsync(
        int categoryId,
        bool isActive,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(int categoryId, CancellationToken cancellationToken = default);
}
