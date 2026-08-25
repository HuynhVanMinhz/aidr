using AIDR.Shared.Dtos.Order;

namespace AIDR.Modules.Order.Abstractions;

public sealed class CartShopSubtotal
{
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public decimal Subtotal { get; init; }
    public string Currency { get; init; } = "VND";
}

public sealed class CartPricingContext
{
    public IReadOnlyList<CartShopSubtotal> ShopSubtotals { get; init; } = Array.Empty<CartShopSubtotal>();
    public decimal GrandSubtotal { get; init; }
    public string Currency { get; init; } = "VND";
}

public sealed class VoucherRecord
{
    public Guid VoucherId { get; init; }
    public string Code { get; init; } = null!;
    public string Name { get; init; } = null!;
    public string? Description { get; init; }
    public string Scope { get; init; } = null!;
    public Guid? ShopId { get; init; }
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
}

public interface IVoucherRepository
{
    Task<CartPricingContext> GetCartPricingContextAsync(
        Guid buyerUserId,
        IReadOnlyCollection<Guid>? cartItemIds,
        CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<VoucherRecord> Items, int TotalCount)> ListCandidateVouchersAsync(
        IReadOnlyCollection<Guid> cartShopIds,
        string? scope,
        Guid? shopId,
        DateTime utcNow,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<VoucherRecord?> FindVoucherAsync(
        Guid? voucherId,
        string? code,
        CancellationToken cancellationToken = default);

    Task<int> CountUserRedemptionsAsync(
        Guid voucherId,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<Guid, int>> CountUserRedemptionsAsync(
        IReadOnlyCollection<Guid> voucherIds,
        Guid userId,
        CancellationToken cancellationToken = default);
}
