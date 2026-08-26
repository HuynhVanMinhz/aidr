using AIDR.Shared.Dtos.AI;

namespace AIDR.Modules.AI.Abstractions;

public interface IAiNlFilterService
{
    Task<NlFilterResultDto> ParseAsync(
        NlFilterRequest request,
        CancellationToken cancellationToken = default);
}
