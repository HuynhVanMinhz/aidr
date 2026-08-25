using AIDR.Shared.Dtos.Seller;

namespace AIDR.Modules.SellerCenter.Abstractions;

public sealed class SellerShopVoucherRecord
{
    public Guid VoucherId { get; init; }
    public string Code { get; init; } = null!;
    public string Name { get; init; } = null!;
    public string? Description { get; init; }
    public string Scope { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string? ShopName { get; init; }
    public string DiscountType { get; init; } = null!;
    public decimal DiscountValue { get; init; }
    public decimal? MaxDiscountAmount { get; init; }
    public decimal MinOrderAmount { get; init; }
    public int? UsageLimit { get; init; }
    public int PerUserLimit { get; init; }
    public int UsedCount { get; init; }
    public DateTime StartsAt { get; init; }
    public DateTime EndsAt { get; init; }
    public bool IsActive { get; init; }
    public Guid CreatedBy { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public bool HasRedemptions { get; init; }
    public bool IsReferencedByOrders { get; init; }
}

public sealed class SellerShopVoucherListSummary
{
    public int ActiveCount { get; init; }
    public int InactiveCount { get; init; }
    public int ExpiredCount { get; init; }
}

public interface ISellerShopVoucherRepository
{
    Task<(IReadOnlyList<SellerShopVoucherRecord> Items, int TotalCount, int EffectivePage, SellerShopVoucherListSummary Summary)>
        ListPagedAsync(
            Guid shopId,
            string? keyword,
            bool? isActive,
            int page,
            int pageSize,
            DateTime utcNow,
            CancellationToken cancellationToken = default);

    Task<SellerShopVoucherRecord?> GetByIdForShopAsync(
        Guid shopId,
        Guid voucherId,
        CancellationToken cancellationToken = default);

    Task<bool> CodeExistsAsync(
        string code,
        Guid? excludeVoucherId = null,
        CancellationToken cancellationToken = default);

    Task<SellerShopVoucherRecord> CreateAsync(
        Guid shopId,
        string code,
        string name,
        string? description,
        string discountType,
        decimal discountValue,
        decimal? maxDiscountAmount,
        decimal minOrderAmount,
        int? usageLimit,
        int perUserLimit,
        DateTime startsAt,
        DateTime endsAt,
        bool isActive,
        Guid createdBy,
        CancellationToken cancellationToken = default);

    Task<SellerShopVoucherRecord> UpdateAsync(
        Guid shopId,
        Guid voucherId,
        string name,
        string? description,
        string discountType,
        decimal discountValue,
        decimal? maxDiscountAmount,
        decimal minOrderAmount,
        int? usageLimit,
        int perUserLimit,
        DateTime startsAt,
        DateTime endsAt,
        CancellationToken cancellationToken = default);

    Task<SellerShopVoucherRecord> UpdateStatusAsync(
        Guid shopId,
        Guid voucherId,
        bool isActive,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid shopId, Guid voucherId, CancellationToken cancellationToken = default);
}

public interface ISellerShopVoucherService
{
    Task<SellerShopVoucherListResultDto> ListAsync(
        Guid ownerUserId,
        string? q,
        bool? isActive,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<SellerShopVoucherDto> GetByIdAsync(
        Guid ownerUserId,
        Guid voucherId,
        CancellationToken cancellationToken = default);

    Task<SellerShopVoucherDto> CreateAsync(
        Guid ownerUserId,
        CreateShopVoucherRequest request,
        CancellationToken cancellationToken = default);

    Task<SellerShopVoucherDto> UpdateAsync(
        Guid ownerUserId,
        Guid voucherId,
        UpdateShopVoucherRequest request,
        CancellationToken cancellationToken = default);

    Task<SellerShopVoucherDto> UpdateStatusAsync(
        Guid ownerUserId,
        Guid voucherId,
        UpdateShopVoucherStatusRequest request,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(
        Guid ownerUserId,
        Guid voucherId,
        CancellationToken cancellationToken = default);
}
