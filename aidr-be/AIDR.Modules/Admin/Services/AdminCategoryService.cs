using System.Text.RegularExpressions;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Caching;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Admin.Services;

public sealed class AdminCategoryService : IAdminCategoryService
{
    private static readonly Regex SlugRegex = new(
        @"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex HttpUrlRegex = new(
        @"^https?:\/\/.+\..+",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private readonly IAdminCategoryRepository _repository;
    private readonly ICacheService _cache;

    public AdminCategoryService(IAdminCategoryRepository repository, ICacheService cache)
    {
        _repository = repository;
        _cache = cache;
    }

    public async Task<IReadOnlyList<AdminCategoryDto>> ListAsync(CancellationToken cancellationToken = default)
    {
        var items = await _repository.ListAsync(cancellationToken);
        return items.Select(Map).ToList();
    }

    public async Task<AdminCategoryDto> GetByIdAsync(int categoryId, CancellationToken cancellationToken = default)
    {
        EnsurePositiveId(categoryId, "Category id");

        var record = await _repository.GetByIdAsync(categoryId, cancellationToken)
            ?? throw new NotFoundException("Category not found.");

        return Map(record);
    }

    public async Task<AdminCategoryDto> CreateAsync(
        CreateCategoryRequest request,
        CancellationToken cancellationToken = default)
    {
        var name = RequireName(request.Name);
        var slug = RequireSlug(request.Slug);
        var description = NormalizeOptionalText(request.Description, AdminConstants.MaxCategoryDescriptionLength, "Description");
        var imageUrl = ValidateOptionalImageUrl(request.ImageUrl);

        if (request.ParentId is <= 0)
            throw new AppException("Parent id must be a positive number when provided.");

        if (request.ParentId is { } parentId)
        {
            if (!await _repository.ExistsAsync(parentId, cancellationToken))
                throw new NotFoundException("Parent category not found.");
        }

        if (await _repository.SlugExistsAsync(slug, cancellationToken: cancellationToken))
            throw new ConflictException("Category slug already exists.");

        var record = await _repository.CreateAsync(
            name,
            slug,
            description,
            imageUrl,
            request.ParentId,
            request.SortOrder,
            request.IsActive,
            cancellationToken);

        await InvalidateCategoryCacheAsync(cancellationToken);
        return Map(record);
    }

    public async Task<AdminCategoryDto> UpdateAsync(
        int categoryId,
        UpdateCategoryRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsurePositiveId(categoryId, "Category id");

        if (!await _repository.ExistsAsync(categoryId, cancellationToken))
            throw new NotFoundException("Category not found.");

        var name = RequireName(request.Name);
        var description = NormalizeOptionalText(request.Description, AdminConstants.MaxCategoryDescriptionLength, "Description");
        var imageUrl = ValidateOptionalImageUrl(request.ImageUrl);

        var record = await _repository.UpdateAsync(
            categoryId,
            name,
            description,
            imageUrl,
            request.SortOrder,
            cancellationToken);

        await InvalidateCategoryCacheAsync(cancellationToken);
        return Map(record);
    }

    public async Task<AdminCategoryDto> UpdateStatusAsync(
        int categoryId,
        UpdateCategoryStatusRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsurePositiveId(categoryId, "Category id");

        if (!await _repository.ExistsAsync(categoryId, cancellationToken))
            throw new NotFoundException("Category not found.");

        var record = await _repository.UpdateStatusAsync(categoryId, request.IsActive, cancellationToken);

        await InvalidateCategoryCacheAsync(cancellationToken);
        return Map(record);
    }

    public async Task DeleteAsync(int categoryId, CancellationToken cancellationToken = default)
    {
        EnsurePositiveId(categoryId, "Category id");

        if (!await _repository.ExistsAsync(categoryId, cancellationToken))
            throw new NotFoundException("Category not found.");

        var productCount = await _repository.GetProductCountAsync(categoryId, cancellationToken);
        if (productCount > 0)
            throw new ConflictException("Cannot delete a category that still has products.");

        var childCount = await _repository.GetChildCountAsync(categoryId, cancellationToken);
        if (childCount > 0)
            throw new ConflictException("Cannot delete a category that still has child categories.");

        await _repository.DeleteAsync(categoryId, cancellationToken);
        await InvalidateCategoryCacheAsync(cancellationToken);
    }

    private async Task InvalidateCategoryCacheAsync(CancellationToken cancellationToken)
    {
        await _cache.RemoveAsync(DiscoveryConstants.CacheKeyCategoriesTree, cancellationToken);
    }

    private static void EnsurePositiveId(int id, string fieldName)
    {
        if (id <= 0)
            throw new AppException($"{fieldName} must be a positive number.");
    }

    private static string RequireName(string? name)
    {
        var trimmed = name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new AppException("Category name is required.");

        if (trimmed.Length > AdminConstants.MaxCategoryNameLength)
            throw new AppException($"Category name must not exceed {AdminConstants.MaxCategoryNameLength} characters.");

        return trimmed;
    }

    private static string RequireSlug(string? slug)
    {
        var trimmed = slug?.Trim().ToLowerInvariant() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new AppException("Category slug is required.");

        if (trimmed.Length > AdminConstants.MaxCategorySlugLength)
            throw new AppException($"Category slug must not exceed {AdminConstants.MaxCategorySlugLength} characters.");

        if (!SlugRegex.IsMatch(trimmed))
            throw new AppException("Category slug must contain only lowercase letters, numbers, and hyphens.");

        return trimmed;
    }

    private static string? NormalizeOptionalText(string? value, int maxLength, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new AppException($"{fieldName} must not exceed {maxLength} characters.");

        return trimmed;
    }

    private static string? ValidateOptionalImageUrl(string? imageUrl)
    {
        if (string.IsNullOrWhiteSpace(imageUrl))
            return null;

        var trimmed = imageUrl.Trim();
        if (trimmed.Length > AdminConstants.MaxCategoryImageUrlLength)
            throw new AppException($"Image URL must not exceed {AdminConstants.MaxCategoryImageUrlLength} characters.");

        if (!HttpUrlRegex.IsMatch(trimmed) && !trimmed.StartsWith('/'))
            throw new AppException("Image URL is invalid.");

        return trimmed;
    }

    private static AdminCategoryDto Map(AdminCategoryRecord record) => new()
    {
        CategoryId = record.CategoryId,
        ParentId = record.ParentId,
        Name = record.Name,
        Slug = record.Slug,
        Description = record.Description,
        ImageUrl = record.ImageUrl,
        SortOrder = record.SortOrder,
        IsActive = record.IsActive,
        ProductCount = record.ProductCount,
        ChildCount = record.ChildCount,
        CreatedAt = record.CreatedAt,
        UpdatedAt = record.UpdatedAt
    };
}
