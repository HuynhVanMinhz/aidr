using System.Text.Json;
using System.Text.RegularExpressions;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Caching;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;

namespace AIDR.Modules.SellerCenter.Services;

public sealed class SellerProductService : ISellerProductService
{
    private static readonly Regex SlugRegex = new(
        @"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex HttpUrlRegex = new(
        @"^https?:\/\/.+\..+",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private readonly ISellerProductRepository _repository;
    private readonly ICacheService _cache;
    private readonly INotificationService _notifications;
    private readonly ILogger<SellerProductService> _logger;

    public SellerProductService(
        ISellerProductRepository repository,
        ICacheService cache,
        INotificationService notifications,
        ILogger<SellerProductService> logger)
    {
        _repository = repository;
        _cache = cache;
        _notifications = notifications;
        _logger = logger;
    }

    public async Task<PagedResult<SellerProductListItemDto>> ListAsync(
        Guid ownerUserId,
        SellerProductQueryRequest request,
        CancellationToken cancellationToken = default)
    {
        var shop = await RequireActiveShopAsync(ownerUserId, cancellationToken);
        var page = request.Page <= 0 ? SellerProductConstants.DefaultPage : request.Page;
        var pageSize = request.PageSize <= 0
            ? SellerProductConstants.DefaultPageSize
            : Math.Min(request.PageSize, SellerProductConstants.MaxPageSize);

        if (request.CategoryId is <= 0)
            throw new AppException("Category id must be a positive number when provided.");

        var keyword = string.IsNullOrWhiteSpace(request.Q) ? null : request.Q.Trim();
        if (keyword is not null && keyword.Length > DiscoveryConstants.MaxSearchQueryLength)
            throw new AppException($"Search query must not exceed {DiscoveryConstants.MaxSearchQueryLength} characters.");

        var (statusFilter, includeDeleted) = ParseListStatus(request.Status);

        var (items, total) = await _repository.ListByShopAsync(
            shop.ShopId,
            statusFilter,
            keyword,
            request.CategoryId,
            includeDeleted,
            page,
            pageSize,
            cancellationToken);

        return new PagedResult<SellerProductListItemDto>
        {
            Items = items.Select(MapListItem).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        };
    }

    public async Task<SellerProductDetailDto> GetByIdAsync(
        Guid ownerUserId,
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        EnsureProductId(productId);
        var shop = await RequireActiveShopAsync(ownerUserId, cancellationToken);

        var record = await _repository.GetByIdForShopAsync(shop.ShopId, productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        return MapDetail(record);
    }

    public async Task<SellerProductDetailDto> CreateAsync(
        Guid ownerUserId,
        CreateSellerProductRequest request,
        CancellationToken cancellationToken = default)
    {
        var shop = await RequireActiveShopAsync(ownerUserId, cancellationToken);
        var model = BuildWriteModel(
            request.CategoryId,
            request.Name,
            request.Slug,
            request.ShortDescription,
            request.Description,
            request.Brand,
            request.ModelNumber,
            request.ConditionType,
            request.BasePrice,
            request.SalePrice,
            request.WarrantyMonths,
            request.OriginCountry,
            request.TagsJson,
            request.SpecsJson,
            status: SellerProductConstants.StatusPending,
            publishedAt: null,
            images: NormalizeImages(request.Images, required: false),
            variants: SellerProductVariantNormalizer.Normalize(request.VariantOptions, request.Variants));

        await EnsureCategoryActiveAsync(model.CategoryId, cancellationToken);

        if (await _repository.SlugExistsInShopAsync(shop.ShopId, model.Slug, cancellationToken: cancellationToken))
            throw new ConflictException("Product slug already exists in your shop.");

        var record = await _repository.CreateAsync(shop.ShopId, model, cancellationToken);
        await NotifyAdminsPendingModerationAsync(
            shop,
            record,
            isResubmission: false,
            cancellationToken);
        return MapDetail(record);
    }

    public async Task<SellerProductDetailDto> UpdateAsync(
        Guid ownerUserId,
        Guid productId,
        UpdateSellerProductRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureProductId(productId);
        var shop = await RequireActiveShopAsync(ownerUserId, cancellationToken);

        var existing = await _repository.GetByIdForShopAsync(shop.ShopId, productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        if (existing.Status == SellerProductConstants.StatusDeleted)
            throw new ConflictException("Cannot update a deleted product.");

        var wasAlreadyPending = string.Equals(
            existing.Status,
            SellerProductConstants.StatusPending,
            StringComparison.OrdinalIgnoreCase);

        var model = BuildWriteModel(
            request.CategoryId,
            request.Name,
            request.Slug,
            request.ShortDescription,
            request.Description,
            request.Brand,
            request.ModelNumber,
            request.ConditionType,
            request.BasePrice,
            request.SalePrice,
            request.WarrantyMonths,
            request.OriginCountry,
            request.TagsJson,
            request.SpecsJson,
            status: SellerProductConstants.StatusPending,
            publishedAt: null,
            images: null,
            variants: SellerProductVariantNormalizer.Normalize(request.VariantOptions, request.Variants));

        await EnsureCategoryActiveAsync(model.CategoryId, cancellationToken);

        if (await _repository.SlugExistsInShopAsync(shop.ShopId, model.Slug, productId, cancellationToken))
            throw new ConflictException("Product slug already exists in your shop.");

        var record = await _repository.UpdateAsync(shop.ShopId, productId, model, cancellationToken);
        await InvalidateProductCacheAsync(productId, cancellationToken);

        // Already-pending edits stay in the same queue item; notify when the product
        // newly enters (or re-enters) moderation after approve/reject/inactive.
        if (!wasAlreadyPending)
        {
            await NotifyAdminsPendingModerationAsync(
                shop,
                record,
                isResubmission: true,
                cancellationToken);
        }

        return MapDetail(record);
    }

    public async Task DeleteAsync(
        Guid ownerUserId,
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        EnsureProductId(productId);
        var shop = await RequireActiveShopAsync(ownerUserId, cancellationToken);

        _ = await _repository.GetByIdForShopAsync(shop.ShopId, productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        await _repository.SoftDeleteAsync(shop.ShopId, productId, cancellationToken);
        await InvalidateProductCacheAsync(productId, cancellationToken);
    }

    public async Task<SellerProductDetailDto> UploadImagesAsync(
        Guid ownerUserId,
        Guid productId,
        UploadSellerProductImagesRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureProductId(productId);
        var shop = await RequireActiveShopAsync(ownerUserId, cancellationToken);

        _ = await _repository.GetByIdForShopAsync(shop.ShopId, productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        var images = NormalizeImages(request.Images, required: true);

        if (!request.ReplaceExisting)
        {
            var existingCount = await _repository.GetImageCountAsync(productId, cancellationToken);
            if (existingCount + images.Count > SellerProductConstants.MaxImagesPerProduct)
            {
                throw new AppException(
                    $"A product can have at most {SellerProductConstants.MaxImagesPerProduct} images.");
            }
        }
        else if (images.Count > SellerProductConstants.MaxImagesPerProduct)
        {
            throw new AppException(
                $"A product can have at most {SellerProductConstants.MaxImagesPerProduct} images.");
        }

        var record = await _repository.AddImagesAsync(
            shop.ShopId,
            productId,
            images,
            request.ReplaceExisting,
            cancellationToken);

        await InvalidateProductCacheAsync(productId, cancellationToken);
        return MapDetail(record);
    }

    private async Task<SellerShopRecord> RequireActiveShopAsync(
        Guid ownerUserId,
        CancellationToken cancellationToken)
    {
        if (ownerUserId == Guid.Empty)
            throw new AppException("User id is required.");

        return await _repository.GetActiveShopByOwnerAsync(ownerUserId, cancellationToken)
            ?? throw new ForbiddenAppException("Active shop not found for the current seller.");
    }

    private async Task EnsureCategoryActiveAsync(int categoryId, CancellationToken cancellationToken)
    {
        if (!await _repository.CategoryExistsAndActiveAsync(categoryId, cancellationToken))
            throw new NotFoundException("Active category not found.");
    }

    private async Task InvalidateProductCacheAsync(Guid productId, CancellationToken cancellationToken)
    {
        await _cache.RemoveAsync(SellerProductConstants.ProductDetailCacheKey(productId), cancellationToken);
    }

    private async Task NotifyAdminsPendingModerationAsync(
        SellerShopRecord shop,
        SellerProductRecord product,
        bool isResubmission,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Guid> adminIds;
        try
        {
            adminIds = await _repository.ListAdminUserIdsAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load admin users for product {ProductId}", product.ProductId);
            return;
        }

        if (adminIds.Count == 0)
            return;

        var shopLabel = string.IsNullOrWhiteSpace(shop.ShopName) ? "a shop" : shop.ShopName.Trim();
        var title = isResubmission
            ? "Product resubmitted for approval"
            : "New product awaiting approval";
        var body = isResubmission
            ? $"Shop \"{shopLabel}\" updated \"{product.Name}\" and resubmitted it for moderation."
            : $"Shop \"{shopLabel}\" submitted \"{product.Name}\" for moderation.";

        if (body.Length > NotificationConstants.MaxBodyLength)
            body = body[..NotificationConstants.MaxBodyLength];

        foreach (var adminId in adminIds)
        {
            try
            {
                await _notifications.CreateAsync(
                    new CreateNotificationRequest
                    {
                        UserId = adminId,
                        Title = title,
                        Body = body,
                        Type = NotificationConstants.TypeModeration,
                        ReferenceType = NotificationConstants.RefProduct,
                        ReferenceId = product.ProductId
                    },
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Failed to notify admin {AdminId} about pending product {ProductId}",
                    adminId,
                    product.ProductId);
            }
        }
    }

    private static void EnsureProductId(Guid productId)
    {
        if (productId == Guid.Empty)
            throw new AppException("Product id is required.");
    }

    private static (string? StatusFilter, bool IncludeDeleted) ParseListStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status) || status.Equals("all", StringComparison.OrdinalIgnoreCase))
            return (null, status?.Equals("all", StringComparison.OrdinalIgnoreCase) == true);

        var normalized = NormalizeStatus(status);
        return (normalized, normalized == SellerProductConstants.StatusDeleted);
    }

    private static string NormalizeStatus(string status)
    {
        var match = SellerProductConstants.AllowedStatuses
            .FirstOrDefault(s => s.Equals(status.Trim(), StringComparison.OrdinalIgnoreCase));

        if (match is null)
            throw new AppException(
                "Status must be one of: Draft, Pending, Approved, Rejected, Inactive, Deleted, or all.");

        return match;
    }

    private static SellerProductWriteModel BuildWriteModel(
        int categoryId,
        string? name,
        string? slug,
        string? shortDescription,
        string? description,
        string? brand,
        string? modelNumber,
        string? conditionType,
        decimal basePrice,
        decimal? salePrice,
        int? warrantyMonths,
        string? originCountry,
        string? tagsJson,
        string? specsJson,
        string status,
        DateTime? publishedAt,
        IReadOnlyList<SellerProductImageWriteModel>? images,
        SellerProductVariantNormalizer.NormalizedVariants variants)
    {
        if (categoryId <= 0)
            throw new AppException("Category id is required.");

        return new SellerProductWriteModel
        {
            CategoryId = categoryId,
            Name = RequireName(name),
            Slug = RequireSlug(slug),
            ShortDescription = OptionalBounded(shortDescription, "Short description", SellerProductConstants.MaxShortDescriptionLength),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            Brand = OptionalBounded(brand, "Brand", SellerProductConstants.MaxBrandLength),
            ModelNumber = OptionalBounded(modelNumber, "Model number", SellerProductConstants.MaxModelNumberLength),
            ConditionType = RequireCondition(conditionType),
            BasePrice = RequireBasePrice(basePrice),
            SalePrice = RequireSalePrice(salePrice),
            WarrantyMonths = RequireWarrantyMonths(warrantyMonths),
            OriginCountry = OptionalBounded(originCountry, "Origin country", SellerProductConstants.MaxOriginCountryLength),
            TagsJson = RequireJsonOptional(tagsJson, "TagsJson", SellerProductConstants.MaxTagsJsonLength),
            SpecsJson = RequireJsonOptional(specsJson, "SpecsJson", SellerProductConstants.MaxSpecsJsonLength),
            Status = status,
            PublishedAt = publishedAt,
            Images = images,
            VariantOptionsJson = variants.OptionsJson,
            Variants = variants.Variants
        };
    }

    private static IReadOnlyList<SellerProductImageWriteModel> NormalizeImages(
        IReadOnlyList<SellerProductImageInput>? images,
        bool required)
    {
        if (images is null || images.Count == 0)
        {
            if (required)
                throw new AppException("At least one image is required.");
            return Array.Empty<SellerProductImageWriteModel>();
        }

        if (images.Count > SellerProductConstants.MaxImagesPerProduct)
        {
            throw new AppException(
                $"A product can have at most {SellerProductConstants.MaxImagesPerProduct} images.");
        }

        var primaryCount = images.Count(i => i.IsPrimary);
        if (primaryCount > 1)
            throw new AppException("Only one image can be marked as primary.");

        var result = new List<SellerProductImageWriteModel>(images.Count);
        for (var i = 0; i < images.Count; i++)
        {
            var image = images[i];
            var url = RequireImageUrl(image.ImageUrl);
            var publicId = OptionalBounded(image.PublicId, "Public id", SellerProductConstants.MaxPublicIdLength);

            result.Add(new SellerProductImageWriteModel
            {
                ImageUrl = url,
                PublicId = publicId,
                SortOrder = image.SortOrder,
                IsPrimary = image.IsPrimary || (primaryCount == 0 && i == 0)
            });
        }

        return result;
    }

    private static string RequireName(string? name)
    {
        var trimmed = name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new AppException("Product name is required.");

        if (trimmed.Length > SellerProductConstants.MaxNameLength)
            throw new AppException($"Product name must not exceed {SellerProductConstants.MaxNameLength} characters.");

        return trimmed;
    }

    private static string RequireSlug(string? slug)
    {
        var trimmed = slug?.Trim().ToLowerInvariant() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new AppException("Product slug is required.");

        if (trimmed.Length > SellerProductConstants.MaxSlugLength)
            throw new AppException($"Product slug must not exceed {SellerProductConstants.MaxSlugLength} characters.");

        if (!SlugRegex.IsMatch(trimmed))
            throw new AppException("Product slug must contain only lowercase letters, numbers, and hyphens.");

        return trimmed;
    }

    private static string RequireCondition(string? conditionType)
    {
        var trimmed = conditionType?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new AppException("Condition type is required.");

        var match = SellerProductConstants.AllowedConditions
            .FirstOrDefault(c => c.Equals(trimmed, StringComparison.OrdinalIgnoreCase));

        if (match is null)
            throw new AppException("Condition type must be one of: New, LikeNew, Refurbished, Used.");

        return match;
    }

    private static decimal RequireBasePrice(decimal basePrice)
    {
        if (basePrice < 0)
            throw new AppException("Base price must be greater than or equal to 0.");

        return decimal.Round(basePrice, 2, MidpointRounding.AwayFromZero);
    }

    private static decimal? RequireSalePrice(decimal? salePrice)
    {
        if (salePrice is null)
            return null;

        if (salePrice < 0)
            throw new AppException("Sale price must be greater than or equal to 0.");

        return decimal.Round(salePrice.Value, 2, MidpointRounding.AwayFromZero);
    }

    private static int? RequireWarrantyMonths(int? warrantyMonths)
    {
        if (warrantyMonths is null)
            return null;

        if (warrantyMonths < 0)
            throw new AppException("Warranty months must be greater than or equal to 0.");

        if (warrantyMonths > 1200)
            throw new AppException("Warranty months must not exceed 1200.");

        return warrantyMonths;
    }

    private static string? OptionalBounded(string? value, string fieldName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new AppException($"{fieldName} must not exceed {maxLength} characters.");

        return trimmed;
    }

    private static string RequireImageUrl(string? imageUrl)
    {
        var trimmed = imageUrl?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new AppException("Image URL is required.");

        if (trimmed.Length > SellerProductConstants.MaxImageUrlLength)
            throw new AppException($"Image URL must not exceed {SellerProductConstants.MaxImageUrlLength} characters.");

        if (!HttpUrlRegex.IsMatch(trimmed))
            throw new AppException("Image URL must be a valid http or https URL.");

        return trimmed;
    }

    private static string? RequireJsonOptional(string? json, string fieldName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;

        var trimmed = json.Trim();
        if (trimmed.Length > maxLength)
            throw new AppException($"{fieldName} must not exceed {maxLength} characters.");

        try
        {
            using var _ = JsonDocument.Parse(trimmed);
        }
        catch (JsonException)
        {
            throw new AppException($"{fieldName} must be valid JSON.");
        }

        return trimmed;
    }

    private static SellerProductListItemDto MapListItem(SellerProductRecord record) => new()
    {
        ProductId = record.ProductId,
        Name = record.Name,
        Slug = record.Slug,
        ShortDescription = record.ShortDescription,
        Brand = record.Brand,
        ConditionType = record.ConditionType,
        BasePrice = record.BasePrice,
        SalePrice = record.SalePrice,
        EffectivePrice = record.SalePrice ?? record.BasePrice,
        MaxEffectivePrice = MaxEffectivePriceOf(record),
        Currency = record.Currency,
        StockQuantity = record.StockQuantity,
        ReservedQuantity = record.ReservedQuantity,
        VariantCount = record.Variants.Count,
        Status = record.Status,
        PrimaryImageUrl = record.PrimaryImageUrl,
        CategoryId = record.CategoryId,
        CategoryName = record.CategoryName,
        ShopId = record.ShopId,
        PublishedAt = record.PublishedAt,
        CreatedAt = record.CreatedAt,
        UpdatedAt = record.UpdatedAt
    };

    private static SellerProductDetailDto MapDetail(SellerProductRecord record) => new()
    {
        ProductId = record.ProductId,
        ShopId = record.ShopId,
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
        EffectivePrice = record.SalePrice ?? record.BasePrice,
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
        Images = record.Images.Select(i => new SellerProductImageDto
        {
            ProductImageId = i.ProductImageId,
            ImageUrl = i.ImageUrl,
            PublicId = i.PublicId,
            SortOrder = i.SortOrder,
            IsPrimary = i.IsPrimary
        }).ToList(),
        VariantOptions = SellerProductVariantNormalizer.ParseOptions(record.VariantOptionsJson),
        Variants = record.Variants.Select(MapVariant).ToList()
    };

    private static SellerProductVariantDto MapVariant(SellerProductVariantRecord v) => new()
    {
        VariantId = v.VariantId,
        Sku = v.Sku,
        VariantName = v.VariantName,
        Attributes = SellerProductVariantNormalizer.ParseAttributes(v.AttributesJson),
        Price = v.Price,
        SalePrice = v.SalePrice,
        EffectivePrice = v.SalePrice ?? v.Price,
        StockQuantity = v.StockQuantity,
        ReservedQuantity = v.ReservedQuantity,
        AvailableQuantity = Math.Max(0, v.StockQuantity - v.ReservedQuantity),
        ImageUrl = v.ImageUrl,
        SortOrder = v.SortOrder,
        IsActive = v.IsActive
    };

    /// <summary>
    /// The top of the "from X to Y" range. Products.BasePrice already tracks the cheapest
    /// variant, so only the upper bound has to be derived here; with no variants the range
    /// collapses onto the single price.
    /// </summary>
    private static decimal MaxEffectivePriceOf(SellerProductRecord record)
    {
        var active = record.Variants.Where(v => v.IsActive).ToList();
        return active.Count == 0
            ? record.SalePrice ?? record.BasePrice
            : active.Max(v => v.SalePrice ?? v.Price);
    }
}
