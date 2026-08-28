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

    public async Task<IReadOnlyList<ProductListItemDto>> LookupProductsAsync(
        IReadOnlyList<Guid> productIds,
        CancellationToken cancellationToken = default)
    {
        var ids = (productIds ?? Array.Empty<Guid>())
            .Where(id => id != Guid.Empty)
            .Distinct()
            .Take(DiscoveryConstants.MaxLookupIds)
            .ToList();

        if (ids.Count == 0)
            return Array.Empty<ProductListItemDto>();

        var (items, _) = await _repository.QueryApprovedProductsAsync(
            new ProductListQuery
            {
                ProductIds = ids,
                Page = 1,
                PageSize = ids.Count
            },
            cancellationToken);

        return items.Select(MapListItem).ToList();
    }

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
        var flat = await _repository.GetActiveCategoriesAsync(cancellationToken);
        var counts = await _repository.GetApprovedProductCountsByCategoryAsync(cancellationToken);
        var tree = BuildCategoryTree(flat, counts);

        return tree;
    }

    public async Task<IReadOnlyList<BrandFilterOptionDto>> GetBrandFilterOptionsAsync(
        CancellationToken cancellationToken = default)
    {
        const string cacheKey = "catalog:brands:filter-options";
        var cached = await _cache.GetAsync<List<BrandFilterOptionDto>>(cacheKey, cancellationToken);
        if (cached is not null)
            return cached;

        var records = await _repository.GetApprovedBrandOptionsAsync(cancellationToken);
        var result = records
            .Select(b => new BrandFilterOptionDto
            {
                Brand = b.Brand,
                ProductCount = b.ProductCount
            })
            .ToList();

        await _cache.SetAsync(cacheKey, result, DiscoveryConstants.ProductListCacheTtl, cancellationToken);
        return result;
    }

    public async Task<PagedResult<ShopListItemDto>> ListShopsAsync(
        int page,
        int pageSize,
        string? sort = null,
        CancellationToken cancellationToken = default)
    {
        var (normalizedPage, normalizedSize) = DiscoveryConstants.NormalizePaging(page, pageSize);
        var normalizedSort = string.IsNullOrWhiteSpace(sort)
            ? DiscoveryConstants.SortRating
            : sort.Trim().ToLowerInvariant();

        if (normalizedSort is not ("rating" or "followers" or "newest"))
            normalizedSort = DiscoveryConstants.SortRating;

        var cacheKey = $"shops:list:{normalizedPage}:{normalizedSize}:{normalizedSort}";
        var cached = await _cache.GetAsync<PagedResult<ShopListItemDto>>(cacheKey, cancellationToken);
        if (cached is not null)
            return cached;

        var (items, total) = await _repository.ListActiveShopsAsync(
            normalizedPage,
            normalizedSize,
            normalizedSort,
            cancellationToken);

        var result = new PagedResult<ShopListItemDto>
        {
            Items = items.Select(s => new ShopListItemDto
            {
                ShopId = s.ShopId,
                ShopName = s.ShopName,
                Slug = s.Slug,
                Tagline = s.Tagline,
                LogoUrl = s.LogoUrl,
                IsVerified = s.IsVerified,
                AvgRating = s.AvgRating,
                RatingCount = s.RatingCount,
                FollowerCount = s.FollowerCount,
                ProductCount = s.ProductCount
            }).ToList(),
            Page = normalizedPage,
            PageSize = normalizedSize,
            TotalCount = total
        };

        await _cache.SetAsync(cacheKey, result, DiscoveryConstants.ShopListCacheTtl, cancellationToken);
        return result;
    }

    public async Task<ShopPublicDetailDto> GetShopAsync(
        string shopKey,
        ShopProductsQueryRequest? productsQuery = null,
        CancellationToken cancellationToken = default)
    {
        var key = NormalizeShopKey(shopKey);
        var productQuery = NormalizeShopProductsQuery(productsQuery);
        var cacheKey = BuildShopDetailCacheKey(key, productQuery);

        var cached = await _cache.GetAsync<ShopPublicDetailDto>(cacheKey, cancellationToken);
        if (cached is not null)
            return cached;

        var shop = await _repository.GetActiveShopByKeyAsync(key, cancellationToken)
            ?? throw new NotFoundException("Shop not found.");

        var (items, total) = await _repository.QueryApprovedProductsAsync(
            new ProductListQuery
            {
                Q = productQuery.Q,
                ShopId = shop.ShopId,
                CategoryId = productQuery.CategoryId,
                Brand = productQuery.Brand,
                MinPrice = productQuery.MinPrice,
                MaxPrice = productQuery.MaxPrice,
                MinRating = productQuery.MinRating,
                Sort = productQuery.Sort,
                Page = productQuery.Page,
                PageSize = productQuery.PageSize
            },
            cancellationToken);

        var detail = MapShopDetail(shop, new PagedResult<ProductListItemDto>
        {
            Items = items.Select(MapListItem).ToList(),
            Page = productQuery.Page,
            PageSize = productQuery.PageSize,
            TotalCount = total
        });

        await _cache.SetAsync(cacheKey, detail, DiscoveryConstants.ShopDetailCacheTtl, cancellationToken);
        return detail;
    }

    public async Task<ShopSellerRatingDto> GetShopRatingAsync(
        string shopKey,
        CancellationToken cancellationToken = default)
    {
        var key = NormalizeShopKey(shopKey);
        var cacheKey = $"shop:rating:{key.ToLowerInvariant()}";

        var cached = await _cache.GetAsync<ShopSellerRatingDto>(cacheKey, cancellationToken);
        if (cached is not null)
            return cached;

        var shop = await _repository.GetActiveShopByKeyAsync(key, cancellationToken)
            ?? throw new NotFoundException("Shop not found.");

        var rating = new ShopSellerRatingDto
        {
            ShopId = shop.ShopId,
            ShopName = shop.ShopName,
            Slug = shop.Slug,
            AvgRating = shop.AvgRating,
            RatingCount = shop.RatingCount
        };

        await _cache.SetAsync(cacheKey, rating, DiscoveryConstants.ShopRatingCacheTtl, cancellationToken);
        return rating;
    }

    private async Task<PagedResult<ProductListItemDto>> QueryProductsAsync(
        ProductQueryRequest request,
        bool requireKeyword,
        CancellationToken cancellationToken)
    {
        var flatCategories = await _repository.GetActiveCategoriesAsync(cancellationToken);
        var query = NormalizeQuery(request, requireKeyword, flatCategories);
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

    private static ProductListQuery NormalizeQuery(
        ProductQueryRequest request,
        bool requireKeyword,
        IReadOnlyList<CategoryRecord> flatCategories)
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

        var brands = ParseBrands(request, brand);
        foreach (var b in brands)
        {
            if (b.Length > DiscoveryConstants.MaxBrandLength)
                throw new AppException($"Brand must not exceed {DiscoveryConstants.MaxBrandLength} characters.");
        }

        var categoryIds = ParseCategoryIds(request);
        foreach (var id in categoryIds)
        {
            if (id <= 0)
                throw new AppException("Category id must be a positive number.");
        }

        if (categoryIds.Count > 0)
            categoryIds = ExpandCategoryIds(categoryIds, flatCategories);

        if (request.CategoryId is <= 0)
            throw new AppException("Category id must be a positive number.");

        if (request.MinPrice is < 0 || request.MaxPrice is < 0)
            throw new AppException("Price filters must be non-negative.");

        if (request.MinPrice is { } min && request.MaxPrice is { } max && min > max)
            throw new AppException("MinPrice cannot be greater than MaxPrice.");

        if (request.MinRating is < 0 or > 5)
            throw new AppException("MinRating must be between 0 and 5.");

        var conditions = ParseConditions(request.Conditions);
        var specFilters = ParseSpecFilters(request.SpecFilters);

        var sort = string.IsNullOrWhiteSpace(request.Sort)
            ? DiscoveryConstants.SortNewest
            : request.Sort.Trim().ToLowerInvariant();

        if (!AllowedSorts.Contains(sort))
            throw new AppException(
                "Sort must be one of: newest, price_asc, price_desc, popular, rating.");

        return new ProductListQuery
        {
            Q = q,
            ShopId = request.ShopId == Guid.Empty ? null : request.ShopId,
            CategoryId = categoryIds.Count == 1 ? categoryIds[0] : null,
            CategoryIds = categoryIds,
            Brand = brands.Count == 1 ? brands[0] : brand,
            Brands = brands,
            MinPrice = request.MinPrice,
            MaxPrice = request.MaxPrice,
            MinRating = request.MinRating,
            OnSale = request.OnSale,
            InStock = request.InStock,
            Conditions = conditions,
            SpecFilters = specFilters,
            Sort = sort,
            Page = page,
            PageSize = pageSize
        };
    }

    private static List<int> ParseCategoryIds(ProductQueryRequest request)
    {
        var ids = new HashSet<int>();
        if (request.CategoryId is > 0)
            ids.Add(request.CategoryId.Value);

        if (!string.IsNullOrWhiteSpace(request.CategoryIds))
        {
            foreach (var part in request.CategoryIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (int.TryParse(part, out var id) && id > 0)
                    ids.Add(id);
            }
        }

        return ids.ToList();
    }

    private static List<string> ParseBrands(ProductQueryRequest request, string? legacyBrand)
    {
        var brands = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(legacyBrand))
            brands.Add(legacyBrand);

        if (!string.IsNullOrWhiteSpace(request.Brands))
        {
            foreach (var part in request.Brands.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                brands.Add(part);
        }

        return brands.OrderBy(b => b, StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static readonly HashSet<string> AllowedConditions = new(StringComparer.OrdinalIgnoreCase)
    {
        "New", "LikeNew", "Refurbished", "Used"
    };

    private static List<string> ParseConditions(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return [];

        var list = new List<string>();
        foreach (var part in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var match = AllowedConditions.FirstOrDefault(c =>
                c.Equals(part, StringComparison.OrdinalIgnoreCase));
            if (match is not null && !list.Contains(match, StringComparer.OrdinalIgnoreCase))
                list.Add(match);
        }

        return list;
    }

    private static Dictionary<string, string> ParseSpecFilters(string? raw)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(raw)) return result;

        foreach (var part in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var colon = part.IndexOf(':');
            if (colon <= 0 || colon >= part.Length - 1) continue;

            var key = part[..colon].Trim().ToLowerInvariant();
            var value = part[(colon + 1)..].Trim();
            if (key.Length == 0 || value.Length > 80) continue;
            result[key] = value;
        }

        return result;
    }

    private static List<int> ExpandCategoryIds(
        IReadOnlyList<int> selectedIds,
        IReadOnlyList<CategoryRecord> flatCategories)
    {
        var childrenByParent = flatCategories
            .Where(c => c.ParentId is not null)
            .GroupBy(c => c.ParentId!.Value)
            .ToDictionary(g => g.Key, g => g.Select(c => c.CategoryId).ToList());

        var expanded = new HashSet<int>();
        foreach (var id in selectedIds)
            CollectCategoryDescendants(id, childrenByParent, expanded);

        return expanded.OrderBy(id => id).ToList();
    }

    private static void CollectCategoryDescendants(
        int categoryId,
        IReadOnlyDictionary<int, List<int>> childrenByParent,
        HashSet<int> target)
    {
        if (!target.Add(categoryId))
            return;

        if (!childrenByParent.TryGetValue(categoryId, out var children))
            return;

        foreach (var childId in children)
            CollectCategoryDescendants(childId, childrenByParent, target);
    }

    private static ProductListQuery NormalizeQuery(ProductQueryRequest request, bool requireKeyword)
    {
        return NormalizeQuery(request, requireKeyword, Array.Empty<CategoryRecord>());
    }

    private static ProductListQuery NormalizeShopProductsQuery(ShopProductsQueryRequest? request)
    {
        request ??= new ShopProductsQueryRequest();
        return NormalizeQuery(
            new ProductQueryRequest
            {
                Q = request.Q,
                CategoryId = request.CategoryId,
                Brand = request.Brand,
                MinPrice = request.MinPrice,
                MaxPrice = request.MaxPrice,
                MinRating = request.MinRating,
                Sort = request.Sort,
                Page = request.Page,
                PageSize = request.PageSize
            },
            requireKeyword: false);
    }

    private static string NormalizeShopKey(string shopKey)
    {
        if (string.IsNullOrWhiteSpace(shopKey))
            throw new AppException("Shop key is required.");

        shopKey = shopKey.Trim();
        if (shopKey.Length > DiscoveryConstants.MaxShopKeyLength)
            throw new AppException($"Shop key must not exceed {DiscoveryConstants.MaxShopKeyLength} characters.");

        return shopKey;
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
            query.ShopId,
            query.CategoryId,
            query.CategoryIds,
            query.Brand,
            query.Brands,
            query.MinPrice,
            query.MaxPrice,
            query.MinRating,
            query.OnSale,
            query.InStock,
            query.Conditions,
            query.SpecFilters,
            query.Sort,
            query.Page,
            query.PageSize
        });

        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
        return $"catalog:products:{query.Page}:{hash}";
    }

    private static string BuildShopDetailCacheKey(string shopKey, ProductListQuery productQuery)
    {
        var payload = JsonSerializer.Serialize(new
        {
            shopKey = shopKey.ToLowerInvariant(),
            productQuery.Q,
            productQuery.CategoryId,
            productQuery.Brand,
            productQuery.MinPrice,
            productQuery.MaxPrice,
            productQuery.MinRating,
            productQuery.Sort,
            productQuery.Page,
            productQuery.PageSize
        });

        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
        return $"shop:detail:{hash}";
    }

    private static List<CategoryTreeNodeDto> BuildCategoryTree(
        IReadOnlyList<CategoryRecord> flat,
        IReadOnlyDictionary<int, int> directCounts)
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
                ProductCount = directCounts.GetValueOrDefault(c.CategoryId),
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

        return roots.Select(root => WithRolledUpProductCount(root)).ToList();
    }

    private static CategoryTreeNodeDto WithRolledUpProductCount(CategoryTreeNodeDto node)
    {
        var children = node.Children.Select(WithRolledUpProductCount).ToList();
        var childTotal = children.Sum(c => c.ProductCount);
        return new CategoryTreeNodeDto
        {
            CategoryId = node.CategoryId,
            ParentId = node.ParentId,
            Name = node.Name,
            Slug = node.Slug,
            Description = node.Description,
            ImageUrl = node.ImageUrl,
            SortOrder = node.SortOrder,
            ProductCount = node.ProductCount + childTotal,
            Children = children
        };
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

    private static ShopPublicDetailDto MapShopDetail(ShopPublicRecord shop, PagedResult<ProductListItemDto> products)
        => new()
        {
            ShopId = shop.ShopId,
            ShopName = shop.ShopName,
            Slug = shop.Slug,
            Tagline = shop.Tagline,
            ShortDescription = shop.ShortDescription,
            Description = shop.Description,
            LogoUrl = shop.LogoUrl,
            BannerUrl = shop.BannerUrl,
            IsVerified = shop.IsVerified,
            VerifiedAt = shop.VerifiedAt,
            AvgRating = shop.AvgRating,
            RatingCount = shop.RatingCount,
            FollowerCount = shop.FollowerCount,
            ProductCount = shop.ProductCount,
            ReturnPolicy = shop.ReturnPolicy,
            ShippingPolicy = shop.ShippingPolicy,
            OpeningHoursJson = shop.OpeningHoursJson,
            Contact = new ShopPublicContactDto
            {
                Email = shop.Email,
                Phone = shop.Phone,
                Hotline = shop.Hotline,
                WebsiteUrl = shop.WebsiteUrl,
                FacebookUrl = shop.FacebookUrl
            },
            Address = new ShopPublicAddressDto
            {
                Province = shop.Province,
                District = shop.District,
                Ward = shop.Ward,
                StreetAddress = shop.StreetAddress
            },
            CreatedAt = shop.CreatedAt,
            Products = products
        };
}
