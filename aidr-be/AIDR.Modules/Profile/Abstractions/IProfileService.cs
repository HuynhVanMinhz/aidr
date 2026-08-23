using AIDR.Shared.Dtos.Profile;

namespace AIDR.Modules.Profile.Abstractions;

public interface IProfileService
{
    Task<ProfileResponse> GetProfileAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<ProfileResponse> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken cancellationToken = default);
}
