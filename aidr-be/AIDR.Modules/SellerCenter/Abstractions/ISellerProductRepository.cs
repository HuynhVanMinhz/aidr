namespace AIDR.Modules.SellerCenter.Abstractions;

public sealed class SellerShopRecord
{
    public Guid ShopId { get; init; }
    public Guid OwnerUserId { get; init; }
    public string Status { get; init; } = null!;
}

public sealed class SellerProductImageRecord
{
    public Guid ProductImageId { get; init; }
    public string ImageUrl { get; init; } = null!;
    public string? PublicId { get; init; }
    public int SortOrder { get; init; }
    public bool IsPrimary { get; init; }
}

public sealed class SellerProductRecord
{
    public Guid ProductId { get; init; }
    public Guid ShopId { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = null!;
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? ShortDescription { get; init; }
    public string? Description { get; init; }
    public string? Brand { get; init; }
    public string? ModelNumber { get; init; }
    public string ConditionType { get; init; } = null!;
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public string Currency { get; init; } = null!;
    public int StockQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public int? WarrantyMonths { get; init; }
    public string? OriginCountry { get; init; }
    public string? TagsJson { get; init; }
    public string? SpecsJson { get; init; }
    public bool IsFeatured { get; init; }
    public string Status { get; init; } = null!;
    public DateTime? PublishedAt { get; init; }
    public decimal AvgRating { get; init; }
    public int ReviewCount { get; init; }
    public int SoldCount { get; init; }
    public int ViewCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public string? PrimaryImageUrl { get; init; }
    public IReadOnlyList<SellerProductImageRecord> Images { get; init; } = Array.Empty<SellerProductImageRecord>();
}

public sealed class SellerProductImageWriteModel
{
    public string ImageUrl { get; init; } = null!;
    public string? PublicId { get; init; }
    public int SortOrder { get; init; }
    public bool IsPrimary { get; init; }
}

public sealed class SellerProductWriteModel
{
    public int CategoryId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? ShortDescription { get; init; }
    public string? Description { get; init; }
    public string? Brand { get; init; }
    public string? ModelNumber { get; init; }
    public string ConditionType { get; init; } = null!;
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public int? WarrantyMonths { get; init; }
    public string? OriginCountry { get; init; }
    public string? TagsJson { get; init; }
    public string? SpecsJson { get; init; }
    public string Status { get; init; } = null!;
    public DateTime? PublishedAt { get; init; }
    public IReadOnlyList<SellerProductImageWriteModel>? Images { get; init; }
}

public interface ISellerProductRepository
{
    Task<SellerShopRecord?> GetActiveShopByOwnerAsync(Guid ownerUserId, CancellationToken cancellationToken = default);

    Task<bool> CategoryExistsAndActiveAsync(int categoryId, CancellationToken cancellationToken = default);

    Task<bool> SlugExistsInShopAsync(
        Guid shopId,
        string slug,
        Guid? excludeProductId = null,
        CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<SellerProductRecord> Items, int TotalCount)> ListByShopAsync(
        Guid shopId,
        string? status,
        string? keyword,
        int? categoryId,
        bool includeDeleted,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<SellerProductRecord?> GetByIdForShopAsync(
        Guid shopId,
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<SellerProductRecord> CreateAsync(
        Guid shopId,
        SellerProductWriteModel model,
        CancellationToken cancellationToken = default);

    Task<SellerProductRecord> UpdateAsync(
        Guid shopId,
        Guid productId,
        SellerProductWriteModel model,
        CancellationToken cancellationToken = default);

    Task SoftDeleteAsync(Guid shopId, Guid productId, CancellationToken cancellationToken = default);

    Task<SellerProductRecord> AddImagesAsync(
        Guid shopId,
        Guid productId,
        IReadOnlyList<SellerProductImageWriteModel> images,
        bool replaceExisting,
        CancellationToken cancellationToken = default);

    Task<int> GetImageCountAsync(Guid productId, CancellationToken cancellationToken = default);
}
