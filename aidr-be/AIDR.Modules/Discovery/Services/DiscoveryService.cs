using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AIDR.Modules.Discovery.Abstractions;
using AIDR.Shared.Caching;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;

namespace AIDR.Modules.Discovery.Services;

public sealed class DiscoveryService : IDiscoveryService
{
    private static readonly HashSet<string> AllowedSorts = new(StringComparer.OrdinalIgnoreCase)
    {
        DiscoveryConstants.SortNewest,
        DiscoveryConstants.SortPriceAsc,
        DiscoveryConstants.SortPriceDesc,
        DiscoveryConstants.SortPopular,
        DiscoveryConstants.SortRating
    };

    private readonly IDiscoveryRepository _repository;
    private readonly ICacheService _cache;
    private readonly ILogger<DiscoveryService> _logger;

    public DiscoveryService(
        IDiscoveryRepository repository,
        ICacheService cache,
        ILogger<DiscoveryService> logger)
    {
        _repository = repository;
        _cache = cache;
        _logger = logger;
    }

    public Task<PagedResult<ProductListItemDto>> ListProductsAsync(
        ProductQueryRequest request,
        CancellationToken cancellationToken = default)
        => QueryProductsAsync(request, requireKeyword: false, cancellationToken);

    public Task<PagedResult<ProductListItemDto>> SearchProductsAsync(
        ProductQueryRequest request,
        CancellationToken cancellationToken = default)
        => QueryProductsAsync(request, requireKeyword: true, cancellationToken);

    public async Task<ProductDetailDto> GetProductAsync(
        Guid productId,
        Guid? viewerUserId,
        string? sessionId,
        CancellationToken cancellationToken = default)
    {
        if (productId == Guid.Empty)
            throw new AppException("Product id is required.");

        sessionId = NormalizeSessionId(sessionId);

        var cacheKey = $"product:{productId:D}";
        var cached = await _cache.GetAsync<ProductDetailDto>(cacheKey, cancellationToken);
        ProductDetailDto detail;

        if (cached is not null)
        {
            detail = cached;
        }
        else
        {
            var record = await _repository.GetApprovedProductByIdAsync(
                productId,
                DiscoveryConstants.RecentReviewsLimit,
                cancellationToken)
                ?? throw new NotFoundException("Product not found.");

            detail = MapDetail(record);
            await _cache.SetAsync(cacheKey, detail, DiscoveryConstants.ProductDetailCacheTtl, cancellationToken);
        }

        try
        {
            await _repository.RecordProductViewAsync(productId, viewerUserId, sessionId, cancellationToken);
            detail.ViewCount += 1;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to record product view for {ProductId}", productId);
        }

        return detail;
    }

    public async Task<IReadOnlyList<CategoryTreeNodeDto>> GetCategoryTreeAsync(
        CancellationToken cancellationToken = default)
    {
        var cached = await _cache.GetAsync<List<CategoryTreeNodeDto>>(
            DiscoveryConstants.CacheKeyCategoriesTree,
            cancellationToken);

        if (cached is not null)
            return cached;

        var flat = await _repository.GetActiveCategoriesAsync(cancellationToken);
        var tree = BuildCategoryTree(flat);

        await _cache.SetAsync(
            DiscoveryConstants.CacheKeyCategoriesTree,
            tree,
            DiscoveryConstants.CategoryTreeCacheTtl,
            cancellationToken);

        return tree;
    }

    private async Task<PagedResult<ProductListItemDto>> QueryProductsAsync(
        ProductQueryRequest request,
        bool requireKeyword,
        CancellationToken cancellationToken)
    {
        var query = NormalizeQuery(request, requireKeyword);
        var cacheKey = BuildListCacheKey(query);

        var cached = await _cache.GetAsync<PagedResult<ProductListItemDto>>(cacheKey, cancellationToken);
        if (cached is not null)
            return cached;

        var (items, total) = await _repository.QueryApprovedProductsAsync(query, cancellationToken);
        var result = new PagedResult<ProductListItemDto>
        {
            Items = items.Select(MapListItem).ToList(),
            Page = query.Page,
            PageSize = query.PageSize,
            TotalCount = total
        };

        await _cache.SetAsync(cacheKey, result, DiscoveryConstants.ProductListCacheTtl, cancellationToken);
        return result;
    }

    private static ProductListQuery NormalizeQuery(ProductQueryRequest request, bool requireKeyword)
    {
        var page = request.Page <= 0 ? DiscoveryConstants.DefaultPage : request.Page;
        var pageSize = request.PageSize <= 0
            ? DiscoveryConstants.DefaultPageSize
            : Math.Min(request.PageSize, DiscoveryConstants.MaxPageSize);

        var q = string.IsNullOrWhiteSpace(request.Q) ? null : request.Q.Trim();
        if (q is not null && q.Length > DiscoveryConstants.MaxSearchQueryLength)
            throw new AppException($"Search query must not exceed {DiscoveryConstants.MaxSearchQueryLength} characters.");

        if (requireKeyword && string.IsNullOrWhiteSpace(q))
            throw new AppException("Search query is required.");

        var brand = string.IsNullOrWhiteSpace(request.Brand) ? null : request.Brand.Trim();
        if (brand is not null && brand.Length > DiscoveryConstants.MaxBrandLength)
            throw new AppException($"Brand must not exceed {DiscoveryConstants.MaxBrandLength} characters.");

        if (request.CategoryId is <= 0)
            throw new AppException("Category id must be a positive number.");

        if (request.MinPrice is < 0 || request.MaxPrice is < 0)
            throw new AppException("Price filters must be non-negative.");

        if (request.MinPrice is { } min && request.MaxPrice is { } max && min > max)
            throw new AppException("MinPrice cannot be greater than MaxPrice.");

        if (request.MinRating is < 0 or > 5)
            throw new AppException("MinRating must be between 0 and 5.");

        var sort = string.IsNullOrWhiteSpace(request.Sort)
            ? DiscoveryConstants.SortNewest
            : request.Sort.Trim().ToLowerInvariant();

        if (!AllowedSorts.Contains(sort))
            throw new AppException(
                "Sort must be one of: newest, price_asc, price_desc, popular, rating.");

        return new ProductListQuery
        {
            Q = q,
            CategoryId = request.CategoryId,
            Brand = brand,
            MinPrice = request.MinPrice,
            MaxPrice = request.MaxPrice,
            MinRating = request.MinRating,
            Sort = sort,
            Page = page,
            PageSize = pageSize
        };
    }

    private static string? NormalizeSessionId(string? sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
            return null;

        sessionId = sessionId.Trim();
        if (sessionId.Length > DiscoveryConstants.MaxSessionIdLength)
            throw new AppException($"Session id must not exceed {DiscoveryConstants.MaxSessionIdLength} characters.");

        return sessionId;
    }

    private static string BuildListCacheKey(ProductListQuery query)
    {
        var payload = JsonSerializer.Serialize(new
        {
            query.Q,
            query.CategoryId,
            query.Brand,
            query.MinPrice,
            query.MaxPrice,
            query.MinRating,
            query.Sort,
            query.Page,
            query.PageSize
        });

        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
        return $"catalog:products:{query.Page}:{hash}";
    }

    private static List<CategoryTreeNodeDto> BuildCategoryTree(IReadOnlyList<CategoryRecord> flat)
    {
        var lookup = flat.ToDictionary(
            c => c.CategoryId,
            c => new CategoryTreeNodeDto
            {
                CategoryId = c.CategoryId,
                ParentId = c.ParentId,
                Name = c.Name,
                Slug = c.Slug,
                Description = c.Description,
                ImageUrl = c.ImageUrl,
                SortOrder = c.SortOrder,
                Children = new List<CategoryTreeNodeDto>()
            });

        var roots = new List<CategoryTreeNodeDto>();

        foreach (var node in lookup.Values.OrderBy(n => n.SortOrder).ThenBy(n => n.Name))
        {
            if (node.ParentId is { } parentId && lookup.TryGetValue(parentId, out var parent))
            {
                ((List<CategoryTreeNodeDto>)parent.Children).Add(node);
            }
            else
            {
                roots.Add(node);
            }
        }

        return roots;
    }

    private static ProductListItemDto MapListItem(ProductListRecord r)
    {
        var effective = r.SalePrice ?? r.BasePrice;
        return new ProductListItemDto
        {
            ProductId = r.ProductId,
            Name = r.Name,
            Slug = r.Slug,
            ShortDescription = r.ShortDescription,
            Brand = r.Brand,
            BasePrice = r.BasePrice,
            SalePrice = r.SalePrice,
            EffectivePrice = effective,
            Currency = r.Currency,
            StockQuantity = r.StockQuantity,
            AvailableQuantity = Math.Max(0, r.StockQuantity - r.ReservedQuantity),
            AvgRating = r.AvgRating,
            ReviewCount = r.ReviewCount,
            SoldCount = r.SoldCount,
            IsFeatured = r.IsFeatured,
            PrimaryImageUrl = r.PrimaryImageUrl,
            CategoryId = r.CategoryId,
            CategoryName = r.CategoryName,
            ShopId = r.ShopId,
            ShopName = r.ShopName,
            PublishedAt = r.PublishedAt
        };
    }

    private static ProductDetailDto MapDetail(ProductDetailRecord r) => new()
    {
        ProductId = r.ProductId,
        Name = r.Name,
        Slug = r.Slug,
        ShortDescription = r.ShortDescription,
        Description = r.Description,
        Brand = r.Brand,
        ModelNumber = r.ModelNumber,
        ConditionType = r.ConditionType,
        BasePrice = r.BasePrice,
        SalePrice = r.SalePrice,
        EffectivePrice = r.SalePrice ?? r.BasePrice,
        Currency = r.Currency,
        StockQuantity = r.StockQuantity,
        AvailableQuantity = Math.Max(0, r.StockQuantity - r.ReservedQuantity),
        WarrantyMonths = r.WarrantyMonths,
        OriginCountry = r.OriginCountry,
        SpecsJson = r.SpecsJson,
        TagsJson = r.TagsJson,
        AvgRating = r.AvgRating,
        ReviewCount = r.ReviewCount,
        SoldCount = r.SoldCount,
        ViewCount = r.ViewCount,
        IsFeatured = r.IsFeatured,
        PublishedAt = r.PublishedAt,
        Category = new ProductCategorySummaryDto
        {
            CategoryId = r.CategoryId,
            Name = r.CategoryName,
            Slug = r.CategorySlug
        },
        Shop = new ProductShopSummaryDto
        {
            ShopId = r.ShopId,
            ShopName = r.ShopName,
            Slug = r.ShopSlug,
            LogoUrl = r.ShopLogoUrl,
            IsVerified = r.ShopIsVerified,
            AvgRating = r.ShopAvgRating,
            RatingCount = r.ShopRatingCount
        },
        Images = r.Images.Select(i => new ProductImageDto
        {
            ProductImageId = i.ProductImageId,
            ImageUrl = i.ImageUrl,
            SortOrder = i.SortOrder,
            IsPrimary = i.IsPrimary
        }).ToList(),
        RecentReviews = r.RecentReviews.Select(rv => new ProductReviewSummaryDto
        {
            ReviewId = rv.ReviewId,
            Rating = rv.Rating,
            Title = rv.Title,
            Content = rv.Content,
            BuyerName = rv.BuyerName,
            CreatedAt = rv.CreatedAt
        }).ToList()
    };
}
