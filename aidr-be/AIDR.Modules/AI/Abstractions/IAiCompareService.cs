using AIDR.Shared.Dtos.AI;

namespace AIDR.Modules.AI.Abstractions;

public interface IAiCompareService
{
    Task<CompareProductsResultDto> CompareAsync(
        CompareProductsRequest request,
        CancellationToken cancellationToken = default);
}
