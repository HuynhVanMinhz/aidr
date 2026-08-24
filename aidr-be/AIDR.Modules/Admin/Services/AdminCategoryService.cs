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

    public async Task<AdminCategoryListResultDto> ListAsync(
        string? q,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var (normalizedPage, normalizedPageSize) = AdminConstants.NormalizePaging(page, pageSize);
        var keyword = NormalizeSearch(q);

        var (items, totalCount, effectivePage, summary) = await _repository.ListPagedAsync(
            keyword,
            normalizedPage,
            normalizedPageSize,
            cancellationToken);

        return new AdminCategoryListResultDto
        {
            Items = items.Select(Map).ToList(),
            Page = effectivePage,
            PageSize = normalizedPageSize,
            TotalCount = totalCount,
            ActiveCount = summary.ActiveCount,
            InactiveCount = summary.InactiveCount,
            WithProductsCount = summary.WithProductsCount
        };
    }

    public async Task<IReadOnlyList<AdminCategoryOptionDto>> ListOptionsAsync(
        CancellationToken cancellationToken = default)
    {
        var items = await _repository.ListOptionsAsync(cancellationToken);
        return items
            .Select(x => new AdminCategoryOptionDto
            {
                CategoryId = x.CategoryId,
                ParentId = x.ParentId,
                Name = x.Name,
                SortOrder = x.SortOrder
            })
            .ToList();
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
        var description = RequireDescription(request.Description);
        var imageUrl = RequireImageUrl(request.ImageUrl);

        if (request.ParentId is <= 0)
            throw new AppException("Parent id must be a positive number when provided.");

        if (request.ParentId is { } parentId)
            await RequireAssignableParentAsync(excludeCategoryId: null, parentId, cancellationToken);

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
        var description = RequireDescription(request.Description);
        var imageUrl = OptionalImageUrl(request.ImageUrl);
        var parentId = await RequireAssignableParentAsync(categoryId, request.ParentId, cancellationToken);

        var record = await _repository.UpdateAsync(
            categoryId,
            name,
            description,
            imageUrl,
            request.SortOrder,
            parentId,
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

    private async Task<int?> RequireAssignableParentAsync(
        int? excludeCategoryId,
        int? parentId,
        CancellationToken cancellationToken)
    {
        if (parentId is null)
            return null;

        if (parentId <= 0)
            throw new AppException("Parent id must be a positive number when provided.");

        if (excludeCategoryId is { } selfId && parentId == selfId)
            throw new AppException("A category cannot be its own parent.");

        if (!await _repository.ExistsAsync(parentId.Value, cancellationToken))
            throw new NotFoundException("Parent category not found.");

        if (excludeCategoryId is { } categoryId)
        {
            var cursor = parentId;
            var seen = new HashSet<int>();
            while (cursor is { } current)
            {
                if (current == categoryId)
                    throw new AppException("Cannot move a category under one of its descendants.");
                if (!seen.Add(current))
                    break;

                cursor = await _repository.GetParentIdAsync(current, cancellationToken);
            }
        }

        return parentId;
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

    private static string RequireDescription(string? value)
    {
        var trimmed = value?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new AppException("Category description is required.");

        if (trimmed.Length > AdminConstants.MaxCategoryDescriptionLength)
            throw new AppException($"Description must not exceed {AdminConstants.MaxCategoryDescriptionLength} characters.");

        return trimmed;
    }

    private static string RequireImageUrl(string? imageUrl)
    {
        var trimmed = imageUrl?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new AppException("Category image URL is required.");

        return ValidateImageUrlFormat(trimmed);
    }

    private static string OptionalImageUrl(string? imageUrl)
    {
        var trimmed = imageUrl?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            return string.Empty;

        return ValidateImageUrlFormat(trimmed);
    }

    private static string ValidateImageUrlFormat(string trimmed)
    {
        if (trimmed.Length > AdminConstants.MaxCategoryImageUrlLength)
            throw new AppException($"Image URL must not exceed {AdminConstants.MaxCategoryImageUrlLength} characters.");

        if (!HttpUrlRegex.IsMatch(trimmed) && !trimmed.StartsWith('/'))
            throw new AppException("Image URL is invalid.");

        return trimmed;
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

    private static AdminCategoryDto Map(AdminCategoryRecord record) => new()
    {
        CategoryId = record.CategoryId,
        ParentId = record.ParentId,
        ParentName = record.ParentName,
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
