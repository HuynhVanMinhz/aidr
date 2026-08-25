using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Engagement.Services;

public sealed class WishlistService : IWishlistService
{
    private readonly IWishlistRepository _wishlist;

    public WishlistService(IWishlistRepository wishlist) => _wishlist = wishlist;

    public Task<PagedResult<WishlistItemDto>> ListAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var (normalizedPage, normalizedSize) = WishlistConstants.NormalizePaging(page, pageSize);
        return _wishlist.ListAsync(userId, normalizedPage, normalizedSize, cancellationToken);
    }

    public async Task<WishlistItemDto> AddAsync(
        Guid userId,
        AddWishlistItemRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.ProductId == Guid.Empty)
            throw new AppException("Product id is required.");

        var product = await _wishlist.GetWishlistableProductAsync(request.ProductId, cancellationToken)
            ?? throw new NotFoundException("Product is not available.");

        EnsureWishlistable(product);

        if (await _wishlist.ExistsAsync(userId, product.ProductId, cancellationToken))
            throw new ConflictException("Product is already in your wishlist.");

        return await _wishlist.AddAsync(userId, product.ProductId, cancellationToken);
    }

    public async Task<RemoveWishlistItemResponse> RemoveAsync(
        Guid userId,
        Guid wishlistItemId,
        CancellationToken cancellationToken = default)
    {
        if (wishlistItemId == Guid.Empty)
            throw new AppException("Wishlist item id is required.");

        return await _wishlist.RemoveAsync(userId, wishlistItemId, cancellationToken);
    }

    public async Task<RemoveWishlistItemResponse> RemoveByProductAsync(
        Guid userId,
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        if (productId == Guid.Empty)
            throw new AppException("Product id is required.");

        return await _wishlist.RemoveByProductAsync(userId, productId, cancellationToken);
    }

    private static void EnsureWishlistable(WishlistProductSnapshot product)
    {
        if (!string.Equals(product.Status, WishlistConstants.ApprovedStatus, StringComparison.OrdinalIgnoreCase))
            throw new AppException("Only approved products can be added to the wishlist.");

        if (!product.CategoryIsActive)
            throw new AppException("Product category is not active.");

        if (!string.Equals(product.ShopStatus, WishlistConstants.ActiveShopStatus, StringComparison.OrdinalIgnoreCase))
            throw new AppException("Shop is not available.");
    }
}
