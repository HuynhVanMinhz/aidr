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

    public async Task<IReadOnlyList<AdminCategoryRecord>> ListAsync(CancellationToken cancellationToken = default)
    {
        var categories = await _db.Categories.AsNoTracking()
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .Select(c => new
            {
                Category = c,
                ProductCount = _db.Products.Count(p => p.CategoryId == c.CategoryId),
                ChildCount = _db.Categories.Count(child => child.ParentId == c.CategoryId)
            })
            .ToListAsync(cancellationToken);

        return categories.Select(x => Map(x.Category, x.ProductCount, x.ChildCount)).ToList();
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

        return Map(category, productCount, childCount);
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
        string? description,
        string? imageUrl,
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

        return Map(entity, 0, 0);
    }

    public async Task<AdminCategoryRecord> UpdateAsync(
        int categoryId,
        string name,
        string? description,
        string? imageUrl,
        int sortOrder,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.Categories
            .FirstOrDefaultAsync(c => c.CategoryId == categoryId, cancellationToken)
            ?? throw new NotFoundException("Category not found.");

        entity.Name = name;
        entity.Description = description;
        entity.ImageUrl = imageUrl;
        entity.SortOrder = sortOrder;
        entity.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);

        var productCount = await GetProductCountAsync(categoryId, cancellationToken);
        var childCount = await GetChildCountAsync(categoryId, cancellationToken);
        return Map(entity, productCount, childCount);
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
        return Map(entity, productCount, childCount);
    }

    public async Task DeleteAsync(int categoryId, CancellationToken cancellationToken = default)
    {
        var entity = await _db.Categories
            .FirstOrDefaultAsync(c => c.CategoryId == categoryId, cancellationToken)
            ?? throw new NotFoundException("Category not found.");

        _db.Categories.Remove(entity);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private static AdminCategoryRecord Map(Category category, int productCount, int childCount) => new()
    {
        CategoryId = category.CategoryId,
        ParentId = category.ParentId,
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
