using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;

namespace AIDR.Modules.Engagement.Abstractions;

public interface IWishlistService
{
    Task<PagedResult<WishlistItemDto>> ListAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<WishlistItemDto> AddAsync(
        Guid userId,
        AddWishlistItemRequest request,
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
