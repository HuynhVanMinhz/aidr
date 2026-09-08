namespace AIDR.Modules.AI.Abstractions;

using AIDR.Shared.Dtos.AI;

public interface IProductBundleService
{
    Task<ProductBundleDto> GetBundleAsync(Guid productId, CancellationToken cancellationToken = default);
}

public interface IProductBundleRepository
{
    Task<ProductBundleSourceRecord?> GetBundleSourceAsync(
        Guid productId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<int>> ResolveCategoryIdsBySlugsAsync(
        IReadOnlyList<string> slugs,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<BundleCandidateRecord>> GetAccessoryCandidatesAsync(
        Guid excludeProductId,
        Guid preferShopId,
        IReadOnlyList<int> categoryIds,
        int take,
        CancellationToken cancellationToken = default);
}

public interface ICompatibilityService
{
    Task<CompatibilityResultDto> CheckAsync(
        CompatibilityCheckRequest request,
        CancellationToken cancellationToken = default);
}
