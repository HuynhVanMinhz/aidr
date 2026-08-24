using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Admin;

public sealed class AdminProductModerationRepository : IAdminProductModerationRepository
{
    private readonly AidrDbContext _db;

    public AdminProductModerationRepository(AidrDbContext db) => _db = db;

    public async Task<(IReadOnlyList<AdminProductRecord> Items, int TotalCount, int Page, AdminProductListSummary Summary)>
        ListPagedAsync(
            string? status,
            string? keyword,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default)
    {
        var query = _db.Products.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(p => p.Status == status);
        }
        else
        {
            query = query.Where(p => p.Status != AdminConstants.ProductStatusDeleted);
        }

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var term = keyword.Trim();
            query = query.Where(p =>
                p.Name.Contains(term) ||
                p.Slug.Contains(term) ||
                (p.Brand != null && p.Brand.Contains(term)) ||
                (p.ModelNumber != null && p.ModelNumber.Contains(term)) ||
                p.Shop.ShopName.Contains(term) ||
                p.Category.Name.Contains(term));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var summary = new AdminProductListSummary
        {
            PendingCount = await _db.Products.AsNoTracking()
                .CountAsync(p => p.Status == AdminConstants.ProductStatusPending, cancellationToken),
            ApprovedCount = await _db.Products.AsNoTracking()
                .CountAsync(p => p.Status == AdminConstants.ProductStatusApproved, cancellationToken),
            RejectedCount = await _db.Products.AsNoTracking()
                .CountAsync(p => p.Status == AdminConstants.ProductStatusRejected, cancellationToken)
        };

        if (totalCount == 0)
            return (Array.Empty<AdminProductRecord>(), 0, 1, summary);

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        if (page > totalPages)
            page = totalPages;

        // Pending first, then newest updates.
        var rows = await query
            .OrderBy(p => p.Status == AdminConstants.ProductStatusPending ? 0 : 1)
            .ThenByDescending(p => p.UpdatedAt)
            .ThenByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                Product = p,
                ShopName = p.Shop.ShopName,
                CategoryName = p.Category.Name,
                PrimaryImageUrl = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(x => MapList(x.Product, x.ShopName, x.CategoryName, x.PrimaryImageUrl)).ToList();
        return (items, totalCount, page, summary);
    }

    public async Task<AdminProductRecord?> GetByIdAsync(
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.Products.AsNoTracking()
            .Where(p => p.ProductId == productId)
            .Select(p => new
            {
                Product = p,
                ShopName = p.Shop.ShopName,
                CategoryName = p.Category.Name,
                Images = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => new AdminProductImageRecord
                    {
                        ProductImageId = i.ProductImageId,
                        ImageUrl = i.ImageUrl,
                        PublicId = i.PublicId,
                        SortOrder = i.SortOrder,
                        IsPrimary = i.IsPrimary
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (row is null)
            return null;

        return MapDetail(row.Product, row.ShopName, row.CategoryName, row.Images);
    }

    public async Task<AdminProductRecord> ApproveAsync(
        Guid productId,
        Guid adminUserId,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var entity = await _db.Products
            .FirstOrDefaultAsync(p => p.ProductId == productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        if (entity.Status != AdminConstants.ProductStatusPending)
            throw new ConflictException("Only pending products can be approved.");

        if (!await _db.Users.AsNoTracking().AnyAsync(u => u.UserId == adminUserId, cancellationToken))
            throw new NotFoundException("Admin user not found.");

        var now = DateTime.UtcNow;
        var fromStatus = entity.Status;

        entity.Status = AdminConstants.ProductStatusApproved;
        entity.PublishedAt ??= now;
        entity.UpdatedAt = now;

        _db.ProductModerationHistories.Add(new ProductModerationHistory
        {
            ProductId = productId,
            AdminUserId = adminUserId,
            Action = AdminConstants.ModerationActionApprove,
            FromStatus = fromStatus,
            ToStatus = AdminConstants.ProductStatusApproved,
            Reason = null,
            CreatedAt = now
        });

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await GetByIdAsync(productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");
    }

    public async Task<AdminProductRecord> RejectAsync(
        Guid productId,
        Guid adminUserId,
        string reason,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var entity = await _db.Products
            .FirstOrDefaultAsync(p => p.ProductId == productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        if (entity.Status != AdminConstants.ProductStatusPending)
            throw new ConflictException("Only pending products can be rejected.");

        if (!await _db.Users.AsNoTracking().AnyAsync(u => u.UserId == adminUserId, cancellationToken))
            throw new NotFoundException("Admin user not found.");

        var now = DateTime.UtcNow;
        var fromStatus = entity.Status;

        entity.Status = AdminConstants.ProductStatusRejected;
        entity.UpdatedAt = now;

        _db.ProductModerationHistories.Add(new ProductModerationHistory
        {
            ProductId = productId,
            AdminUserId = adminUserId,
            Action = AdminConstants.ModerationActionReject,
            FromStatus = fromStatus,
            ToStatus = AdminConstants.ProductStatusRejected,
            Reason = reason,
            CreatedAt = now
        });

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await GetByIdAsync(productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");
    }

    public async Task<(string ProductName, string Status, IReadOnlyList<ProductModerationHistoryRecord> Items)?>
        GetModerationHistoryAsync(
            Guid productId,
            CancellationToken cancellationToken = default)
    {
        var product = await _db.Products.AsNoTracking()
            .Where(p => p.ProductId == productId)
            .Select(p => new { p.Name, p.Status })
            .FirstOrDefaultAsync(cancellationToken);

        if (product is null)
            return null;

        var items = await (
            from h in _db.ProductModerationHistories.AsNoTracking()
            join admin in _db.Users.AsNoTracking() on h.AdminUserId equals admin.UserId
            where h.ProductId == productId
            orderby h.CreatedAt descending, h.ModerationId descending
            select new ProductModerationHistoryRecord
            {
                ModerationId = h.ModerationId,
                ProductId = h.ProductId,
                AdminUserId = h.AdminUserId,
                AdminFullName = admin.FullName,
                Action = h.Action,
                FromStatus = h.FromStatus,
                ToStatus = h.ToStatus,
                Reason = h.Reason,
                CreatedAt = h.CreatedAt
            }
        ).ToListAsync(cancellationToken);

        return (product.Name, product.Status, items);
    }

    private static AdminProductRecord MapList(
        Product product,
        string shopName,
        string categoryName,
        string? primaryImageUrl) => new()
    {
        ProductId = product.ProductId,
        ShopId = product.ShopId,
        ShopName = shopName,
        CategoryId = product.CategoryId,
        CategoryName = categoryName,
        Name = product.Name,
        Slug = product.Slug,
        ShortDescription = product.ShortDescription,
        Brand = product.Brand,
        ConditionType = product.ConditionType,
        BasePrice = product.BasePrice,
        SalePrice = product.SalePrice,
        Currency = product.Currency,
        StockQuantity = product.StockQuantity,
        Status = product.Status,
        PublishedAt = product.PublishedAt,
        CreatedAt = product.CreatedAt,
        UpdatedAt = product.UpdatedAt,
        PrimaryImageUrl = primaryImageUrl
    };

    private static AdminProductRecord MapDetail(
        Product product,
        string shopName,
        string categoryName,
        IReadOnlyList<AdminProductImageRecord> images) => new()
    {
        ProductId = product.ProductId,
        ShopId = product.ShopId,
        ShopName = shopName,
        CategoryId = product.CategoryId,
        CategoryName = categoryName,
        Name = product.Name,
        Slug = product.Slug,
        ShortDescription = product.ShortDescription,
        Description = product.Description,
        Brand = product.Brand,
        ModelNumber = product.ModelNumber,
        ConditionType = product.ConditionType,
        BasePrice = product.BasePrice,
        SalePrice = product.SalePrice,
        Currency = product.Currency,
        StockQuantity = product.StockQuantity,
        ReservedQuantity = product.ReservedQuantity,
        WarrantyMonths = product.WarrantyMonths,
        OriginCountry = product.OriginCountry,
        TagsJson = product.TagsJson,
        SpecsJson = product.SpecsJson,
        IsFeatured = product.IsFeatured,
        Status = product.Status,
        PublishedAt = product.PublishedAt,
        AvgRating = product.AvgRating,
        ReviewCount = product.ReviewCount,
        SoldCount = product.SoldCount,
        ViewCount = product.ViewCount,
        CreatedAt = product.CreatedAt,
        UpdatedAt = product.UpdatedAt,
        PrimaryImageUrl = images.FirstOrDefault()?.ImageUrl,
        Images = images
    };
}
