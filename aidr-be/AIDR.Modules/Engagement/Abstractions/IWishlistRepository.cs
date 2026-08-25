using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;

namespace AIDR.Modules.Engagement.Abstractions;

public sealed class WishlistProductSnapshot
{
    public Guid ProductId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string Status { get; init; } = null!;
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public string Currency { get; init; } = "VND";
    public int StockQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public decimal AvgRating { get; init; }
    public bool CategoryIsActive { get; init; }
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string ShopSlug { get; init; } = null!;
    public string ShopStatus { get; init; } = null!;
    public string? PrimaryImageUrl { get; init; }

    public decimal EffectivePrice => SalePrice ?? BasePrice;
    public int AvailableQuantity => Math.Max(0, StockQuantity - ReservedQuantity);
}

public interface IWishlistRepository
{
    Task<PagedResult<WishlistItemDto>> ListAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<WishlistProductSnapshot?> GetWishlistableProductAsync(
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(
        Guid userId,
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<WishlistItemDto> AddAsync(
        Guid userId,
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<RemoveWishlistItemResponse> RemoveAsync(
        Guid userId,
        Guid wishlistItemId,
        CancellationToken cancellationToken = default);

    Task<RemoveWishlistItemResponse> RemoveByProductAsync(
        Guid userId,
        Guid productId,
        CancellationToken cancellationToken = default);
}
