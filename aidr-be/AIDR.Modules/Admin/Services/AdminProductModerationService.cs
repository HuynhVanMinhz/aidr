using AIDR.Modules.Admin.Abstractions;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Caching;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;

namespace AIDR.Modules.Admin.Services;

public sealed class AdminProductModerationService : IAdminProductModerationService
{
    private static readonly HashSet<string> AllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        AdminConstants.ProductStatusDraft,
        AdminConstants.ProductStatusPending,
        AdminConstants.ProductStatusApproved,
        AdminConstants.ProductStatusRejected,
        AdminConstants.ProductStatusInactive,
        AdminConstants.ProductStatusDeleted
    };

    private readonly IAdminProductModerationRepository _repository;
    private readonly ICacheService _cache;
    private readonly INotificationService _notifications;
    private readonly ILogger<AdminProductModerationService> _logger;

    public AdminProductModerationService(
        IAdminProductModerationRepository repository,
        ICacheService cache,
        INotificationService notifications,
        ILogger<AdminProductModerationService> logger)
    {
        _repository = repository;
        _cache = cache;
        _notifications = notifications;
        _logger = logger;
    }

    public async Task<AdminProductListResultDto> ListAsync(
        string? status,
        string? q,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeStatusFilter(status);
        var (normalizedPage, normalizedPageSize) = AdminConstants.NormalizePaging(page, pageSize);
        var keyword = NormalizeSearch(q);

        var (items, totalCount, effectivePage, summary) = await _repository.ListPagedAsync(
            normalized,
            keyword,
            normalizedPage,
            normalizedPageSize,
            cancellationToken);

        return new AdminProductListResultDto
        {
            Items = items.Select(MapListItem).ToList(),
            Page = effectivePage,
            PageSize = normalizedPageSize,
            TotalCount = totalCount,
            PendingCount = summary.PendingCount,
            ApprovedCount = summary.ApprovedCount,
            RejectedCount = summary.RejectedCount
        };
    }

    public async Task<AdminProductDetailDto> GetByIdAsync(
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        EnsureProductId(productId);

        var record = await _repository.GetByIdAsync(productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        return MapDetail(record);
    }

    public async Task<AdminProductDetailDto> ApproveAsync(
        Guid productId,
        Guid adminUserId,
        CancellationToken cancellationToken = default)
    {
        EnsureProductId(productId);
        EnsureUserId(adminUserId, "Admin user id");

        var existing = await _repository.GetByIdAsync(productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        if (!string.Equals(
                existing.Status,
                AdminConstants.ProductStatusPending,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException("Only pending products can be approved.");
        }

        var record = await _repository.ApproveAsync(productId, adminUserId, cancellationToken);
        await InvalidateProductCacheAsync(productId, cancellationToken);
        await NotifySellerModerationAsync(
            record,
            approved: true,
            reason: null,
            cancellationToken);
        return MapDetail(record);
    }

    public async Task<BulkApproveProductsResultDto> ApproveBulkAsync(
        BulkApproveProductsRequest request,
        Guid adminUserId,
        CancellationToken cancellationToken = default)
    {
        EnsureUserId(adminUserId, "Admin user id");

        if (request?.ProductIds is null || request.ProductIds.Count == 0)
            throw new AppException("Select at least one product to approve.");

        var ids = request.ProductIds
            .Where(id => id != Guid.Empty)
            .Distinct()
            .Take(100)
            .ToList();

        if (ids.Count == 0)
            throw new AppException("Select at least one product to approve.");

        var approvedIds = new List<Guid>();
        var skipped = 0;

        foreach (var productId in ids)
        {
            var existing = await _repository.GetByIdAsync(productId, cancellationToken);
            if (existing is null ||
                !string.Equals(
                    existing.Status,
                    AdminConstants.ProductStatusPending,
                    StringComparison.OrdinalIgnoreCase))
            {
                skipped++;
                continue;
            }

            var record = await _repository.ApproveAsync(productId, adminUserId, cancellationToken);
            await InvalidateProductCacheAsync(productId, cancellationToken);
            await NotifySellerModerationAsync(
                record,
                approved: true,
                reason: null,
                cancellationToken);
            approvedIds.Add(productId);
        }

        return new BulkApproveProductsResultDto
        {
            ApprovedCount = approvedIds.Count,
            SkippedCount = skipped,
            ApprovedProductIds = approvedIds
        };
    }

    public async Task<AdminProductDetailDto> RejectAsync(
        Guid productId,
        Guid adminUserId,
        RejectProductRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureProductId(productId);
        EnsureUserId(adminUserId, "Admin user id");

        var reason = RequireReason(request.Reason);

        var existing = await _repository.GetByIdAsync(productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        if (!string.Equals(
                existing.Status,
                AdminConstants.ProductStatusPending,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException("Only pending products can be rejected.");
        }

        var record = await _repository.RejectAsync(productId, adminUserId, reason, cancellationToken);
        await InvalidateProductCacheAsync(productId, cancellationToken);
        await NotifySellerModerationAsync(
            record,
            approved: false,
            reason: reason,
            cancellationToken);
        return MapDetail(record);
    }

    private async Task NotifySellerModerationAsync(
        AdminProductRecord record,
        bool approved,
        string? reason,
        CancellationToken cancellationToken)
    {
        if (record.ShopOwnerUserId == Guid.Empty)
            return;

        var title = approved ? "Product approved" : "Product rejected";
        var body = approved
            ? $"Your product \"{record.Name}\" has been approved and is now visible in the catalog."
            : $"Your product \"{record.Name}\" was rejected. Reason: {reason}";

        try
        {
            await _notifications.CreateAsync(
                new CreateNotificationRequest
                {
                    UserId = record.ShopOwnerUserId,
                    Title = title,
                    Body = Truncate(body, NotificationConstants.MaxBodyLength),
                    Type = NotificationConstants.TypeModeration,
                    ReferenceType = NotificationConstants.RefProduct,
                    ReferenceId = record.ProductId
                },
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to notify seller {SellerId} about product moderation {ProductId}",
                record.ShopOwnerUserId,
                record.ProductId);
        }
    }

    private static string Truncate(string value, int maxLength)
        => value.Length <= maxLength ? value : value[..maxLength];

    public async Task<ProductModerationHistoryResultDto> GetModerationHistoryAsync(
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        EnsureProductId(productId);

        var result = await _repository.GetModerationHistoryAsync(productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        return new ProductModerationHistoryResultDto
        {
            ProductId = productId,
            ProductName = result.ProductName,
            CurrentStatus = result.Status,
            Items = result.Items.Select(MapHistory).ToList()
        };
    }

    private async Task InvalidateProductCacheAsync(Guid productId, CancellationToken cancellationToken) =>
        await _cache.RemoveAsync(SellerProductConstants.ProductDetailCacheKey(productId), cancellationToken);

    private static string? NormalizeStatusFilter(string? status)
    {
        if (string.IsNullOrWhiteSpace(status) ||
            string.Equals(status.Trim(), "all", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var trimmed = status.Trim();
        var match = AllowedStatuses.FirstOrDefault(s =>
            string.Equals(s, trimmed, StringComparison.OrdinalIgnoreCase));

        if (match is null)
        {
            throw new AppException(
                "Status filter must be Draft, Pending, Approved, Rejected, Inactive, Deleted, or all.");
        }

        return match;
    }

    private static string RequireReason(string? reason)
    {
        var trimmed = reason?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new AppException("Reason is required when rejecting a product.");

        if (trimmed.Length > AdminConstants.MaxProductModerationReasonLength)
        {
            throw new AppException(
                $"Reason must not exceed {AdminConstants.MaxProductModerationReasonLength} characters.");
        }

        return trimmed;
    }

    private static void EnsureProductId(Guid productId)
    {
        if (productId == Guid.Empty)
            throw new AppException("Product id is required.");
    }

    private static void EnsureUserId(Guid userId, string fieldName)
    {
        if (userId == Guid.Empty)
            throw new AppException($"{fieldName} is required.");
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

    private static decimal EffectivePrice(decimal basePrice, decimal? salePrice) =>
        salePrice is { } sale && sale > 0 && sale < basePrice ? sale : basePrice;

    private static AdminProductListItemDto MapListItem(AdminProductRecord record) => new()
    {
        ProductId = record.ProductId,
        Name = record.Name,
        Slug = record.Slug,
        ShortDescription = record.ShortDescription,
        Brand = record.Brand,
        ConditionType = record.ConditionType,
        BasePrice = record.BasePrice,
        SalePrice = record.SalePrice,
        EffectivePrice = EffectivePrice(record.BasePrice, record.SalePrice),
        Currency = record.Currency,
        StockQuantity = record.StockQuantity,
        Status = record.Status,
        PrimaryImageUrl = record.PrimaryImageUrl,
        CategoryId = record.CategoryId,
        CategoryName = record.CategoryName,
        ShopId = record.ShopId,
        ShopName = record.ShopName,
        PublishedAt = record.PublishedAt,
        CreatedAt = record.CreatedAt,
        UpdatedAt = record.UpdatedAt
    };

    private static AdminProductDetailDto MapDetail(AdminProductRecord record) => new()
    {
        ProductId = record.ProductId,
        ShopId = record.ShopId,
        ShopName = record.ShopName,
        CategoryId = record.CategoryId,
        CategoryName = record.CategoryName,
        Name = record.Name,
        Slug = record.Slug,
        ShortDescription = record.ShortDescription,
        Description = record.Description,
        Brand = record.Brand,
        ModelNumber = record.ModelNumber,
        ConditionType = record.ConditionType,
        BasePrice = record.BasePrice,
        SalePrice = record.SalePrice,
        EffectivePrice = EffectivePrice(record.BasePrice, record.SalePrice),
        Currency = record.Currency,
        StockQuantity = record.StockQuantity,
        ReservedQuantity = record.ReservedQuantity,
        WarrantyMonths = record.WarrantyMonths,
        OriginCountry = record.OriginCountry,
        TagsJson = record.TagsJson,
        SpecsJson = record.SpecsJson,
        IsFeatured = record.IsFeatured,
        Status = record.Status,
        PublishedAt = record.PublishedAt,
        AvgRating = record.AvgRating,
        ReviewCount = record.ReviewCount,
        SoldCount = record.SoldCount,
        ViewCount = record.ViewCount,
        CreatedAt = record.CreatedAt,
        UpdatedAt = record.UpdatedAt,
        Images = record.Images.Select(i => new AdminProductImageDto
        {
            ProductImageId = i.ProductImageId,
            ImageUrl = i.ImageUrl,
            PublicId = i.PublicId,
            SortOrder = i.SortOrder,
            IsPrimary = i.IsPrimary
        }).ToList()
    };

    private static ProductModerationHistoryItemDto MapHistory(ProductModerationHistoryRecord record) => new()
    {
        ModerationId = record.ModerationId,
        ProductId = record.ProductId,
        AdminUserId = record.AdminUserId,
        AdminFullName = record.AdminFullName,
        Action = record.Action,
        FromStatus = record.FromStatus,
        ToStatus = record.ToStatus,
        Reason = record.Reason,
        CreatedAt = record.CreatedAt
    };
}
