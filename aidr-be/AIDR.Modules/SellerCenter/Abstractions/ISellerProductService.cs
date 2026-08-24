using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Seller;

namespace AIDR.Modules.SellerCenter.Abstractions;

public interface ISellerProductService
{
    Task<PagedResult<SellerProductListItemDto>> ListAsync(
        Guid ownerUserId,
        SellerProductQueryRequest request,
        CancellationToken cancellationToken = default);

    Task<SellerProductDetailDto> GetByIdAsync(
        Guid ownerUserId,
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<SellerProductDetailDto> CreateAsync(
        Guid ownerUserId,
        CreateSellerProductRequest request,
        CancellationToken cancellationToken = default);

    Task<SellerProductDetailDto> UpdateAsync(
        Guid ownerUserId,
        Guid productId,
        UpdateSellerProductRequest request,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(
        Guid ownerUserId,
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<SellerProductDetailDto> UploadImagesAsync(
        Guid ownerUserId,
        Guid productId,
        UploadSellerProductImagesRequest request,
        CancellationToken cancellationToken = default);
}
