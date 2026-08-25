namespace AIDR.Modules.Admin.Abstractions;

public sealed class AdminProductImageRecord
{
    public Guid ProductImageId { get; init; }
    public string ImageUrl { get; init; } = null!;
    public string? PublicId { get; init; }
    public int SortOrder { get; init; }
    public bool IsPrimary { get; init; }
}

public sealed class AdminProductRecord
{
    public Guid ProductId { get; init; }
    public Guid ShopId { get; init; }
    public Guid ShopOwnerUserId { get; init; }
    public string ShopName { get; init; } = null!;
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
    public string Currency { get; init; } = "VND";
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
    public IReadOnlyList<AdminProductImageRecord> Images { get; init; } =
        Array.Empty<AdminProductImageRecord>();
}

public sealed class AdminProductListSummary
{
    public int PendingCount { get; init; }
    public int ApprovedCount { get; init; }
    public int RejectedCount { get; init; }
}

public sealed class ProductModerationHistoryRecord
{
    public long ModerationId { get; init; }
    public Guid ProductId { get; init; }
    public Guid AdminUserId { get; init; }
    public string AdminFullName { get; init; } = null!;
    public string Action { get; init; } = null!;
    public string FromStatus { get; init; } = null!;
    public string ToStatus { get; init; } = null!;
    public string? Reason { get; init; }
    public DateTime CreatedAt { get; init; }
}

public interface IAdminProductModerationRepository
{
    Task<(IReadOnlyList<AdminProductRecord> Items, int TotalCount, int Page, AdminProductListSummary Summary)>
        ListPagedAsync(
            string? status,
            string? keyword,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default);

    Task<AdminProductRecord?> GetByIdAsync(
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<AdminProductRecord> ApproveAsync(
        Guid productId,
        Guid adminUserId,
        CancellationToken cancellationToken = default);

    Task<AdminProductRecord> RejectAsync(
        Guid productId,
        Guid adminUserId,
        string reason,
        CancellationToken cancellationToken = default);

    Task<(string ProductName, string Status, IReadOnlyList<ProductModerationHistoryRecord> Items)?>
        GetModerationHistoryAsync(
            Guid productId,
            CancellationToken cancellationToken = default);
}
