using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Admin;

public sealed class AdminCategoryRepository : IAdminCategoryRepository
{
    private readonly AidrDbContext _db;

    public AdminCategoryRepository(AidrDbContext db) => _db = db;

    public async Task<(IReadOnlyList<AdminCategoryRecord> Items, int TotalCount, int Page, AdminCategoryListSummary Summary)>
        ListPagedAsync(
            string? keyword,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default)
    {
        var query = _db.Categories.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var term = keyword.Trim();
            query = query.Where(c =>
                c.Name.Contains(term) ||
                c.Slug.Contains(term) ||
                c.Description.Contains(term));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var activeCount = await _db.Categories.AsNoTracking()
            .CountAsync(c => c.IsActive, cancellationToken);
        var totalAll = await _db.Categories.AsNoTracking().CountAsync(cancellationToken);
        var withProductsCount = await _db.Categories.AsNoTracking()
            .CountAsync(c => _db.Products.Any(p => p.CategoryId == c.CategoryId), cancellationToken);

        var summary = new AdminCategoryListSummary
        {
            ActiveCount = activeCount,
            InactiveCount = totalAll - activeCount,
            WithProductsCount = withProductsCount
        };

        if (totalCount == 0)
            return (Array.Empty<AdminCategoryRecord>(), 0, 1, summary);

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        if (page > totalPages)
            page = totalPages;

        var rows = await query
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                Category = c,
                ParentName = c.ParentId == null
                    ? null
                    : _db.Categories
                        .Where(p => p.CategoryId == c.ParentId)
                        .Select(p => p.Name)
                        .FirstOrDefault(),
                ProductCount = _db.Products.Count(p => p.CategoryId == c.CategoryId),
                ChildCount = _db.Categories.Count(child => child.ParentId == c.CategoryId)
            })
            .ToListAsync(cancellationToken);

        var items = rows
            .Select(x => Map(x.Category, x.ProductCount, x.ChildCount, x.ParentName))
            .ToList();

        return (items, totalCount, page, summary);
    }

    public async Task<IReadOnlyList<AdminCategoryOptionRecord>> ListOptionsAsync(
        CancellationToken cancellationToken = default)
    {
        return await _db.Categories.AsNoTracking()
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .Select(c => new AdminCategoryOptionRecord
            {
                CategoryId = c.CategoryId,
                ParentId = c.ParentId,
                Name = c.Name,
                SortOrder = c.SortOrder
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<AdminCategoryRecord?> GetByIdAsync(int categoryId, CancellationToken cancellationToken = default)
    {
        var category = await _db.Categories.AsNoTracking()
            .FirstOrDefaultAsync(c => c.CategoryId == categoryId, cancellationToken);

        if (category is null)
            return null;

        var productCount = await _db.Products.AsNoTracking()
            .CountAsync(p => p.CategoryId == categoryId, cancellationToken);

        var childCount = await _db.Categories.AsNoTracking()
            .CountAsync(c => c.ParentId == categoryId, cancellationToken);

        string? parentName = null;
        if (category.ParentId is { } parentId)
        {
            parentName = await _db.Categories.AsNoTracking()
                .Where(c => c.CategoryId == parentId)
                .Select(c => c.Name)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return Map(category, productCount, childCount, parentName);
    }

    public Task<bool> SlugExistsAsync(
        string slug,
        int? excludeCategoryId = null,
        CancellationToken cancellationToken = default)
    {
        var query = _db.Categories.AsNoTracking().Where(c => c.Slug == slug);
        if (excludeCategoryId is { } id)
            query = query.Where(c => c.CategoryId != id);

        return query.AnyAsync(cancellationToken);
    }

    public Task<bool> ExistsAsync(int categoryId, CancellationToken cancellationToken = default) =>
        _db.Categories.AsNoTracking().AnyAsync(c => c.CategoryId == categoryId, cancellationToken);

    public Task<int> GetProductCountAsync(int categoryId, CancellationToken cancellationToken = default) =>
        _db.Products.AsNoTracking().CountAsync(p => p.CategoryId == categoryId, cancellationToken);

    public Task<int> GetChildCountAsync(int categoryId, CancellationToken cancellationToken = default) =>
        _db.Categories.AsNoTracking().CountAsync(c => c.ParentId == categoryId, cancellationToken);

    public async Task<AdminCategoryRecord> CreateAsync(
        string name,
        string slug,
        string description,
        string imageUrl,
        int? parentId,
        int sortOrder,
        bool isActive,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var entity = new Category
        {
            Name = name,
            Slug = slug,
            Description = description,
            ImageUrl = imageUrl,
            ParentId = parentId,
            SortOrder = sortOrder,
            IsActive = isActive,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.Categories.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);

        string? parentName = null;
        if (parentId is { } pid)
        {
            parentName = await _db.Categories.AsNoTracking()
                .Where(c => c.CategoryId == pid)
                .Select(c => c.Name)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return Map(entity, 0, 0, parentName);
    }

    public Task<int?> GetParentIdAsync(int categoryId, CancellationToken cancellationToken = default) =>
        _db.Categories.AsNoTracking()
            .Where(c => c.CategoryId == categoryId)
            .Select(c => c.ParentId)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<AdminCategoryRecord> UpdateAsync(
        int categoryId,
        string name,
        string description,
        string imageUrl,
        int sortOrder,
        int? parentId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.Categories
            .FirstOrDefaultAsync(c => c.CategoryId == categoryId, cancellationToken)
            ?? throw new NotFoundException("Category not found.");

        entity.Name = name;
        entity.Description = description;
        entity.ImageUrl = imageUrl;
        entity.SortOrder = sortOrder;
        entity.ParentId = parentId;
        entity.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        var productCount = await GetProductCountAsync(categoryId, cancellationToken);
        var childCount = await GetChildCountAsync(categoryId, cancellationToken);

        string? parentName = null;
        if (parentId is { } pid)
        {
            parentName = await _db.Categories.AsNoTracking()
                .Where(c => c.CategoryId == pid)
                .Select(c => c.Name)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return Map(entity, productCount, childCount, parentName);
    }

    public async Task<AdminCategoryRecord> UpdateStatusAsync(
        int categoryId,
        bool isActive,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.Categories
            .FirstOrDefaultAsync(c => c.CategoryId == categoryId, cancellationToken)
            ?? throw new NotFoundException("Category not found.");

        entity.IsActive = isActive;
        entity.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        var productCount = await GetProductCountAsync(categoryId, cancellationToken);
        var childCount = await GetChildCountAsync(categoryId, cancellationToken);

        string? parentName = null;
        if (entity.ParentId is { } parentId)
        {
            parentName = await _db.Categories.AsNoTracking()
                .Where(c => c.CategoryId == parentId)
                .Select(c => c.Name)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return Map(entity, productCount, childCount, parentName);
    }

    public async Task DeleteAsync(int categoryId, CancellationToken cancellationToken = default)
    {
        var entity = await _db.Categories
            .FirstOrDefaultAsync(c => c.CategoryId == categoryId, cancellationToken)
            ?? throw new NotFoundException("Category not found.");

        _db.Categories.Remove(entity);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private static AdminCategoryRecord Map(
        Category category,
        int productCount,
        int childCount,
        string? parentName) => new()
    {
        CategoryId = category.CategoryId,
        ParentId = category.ParentId,
        ParentName = parentName,
        Name = category.Name,
        Slug = category.Slug,
        Description = category.Description,
        ImageUrl = category.ImageUrl,
        SortOrder = category.SortOrder,
        IsActive = category.IsActive,
        ProductCount = productCount,
        ChildCount = childCount,
        CreatedAt = category.CreatedAt,
        UpdatedAt = category.UpdatedAt
    };
}
