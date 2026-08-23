using AIDR.Modules.Profile.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Profile;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Profile.Services;

public sealed class ProfileService : IProfileService
{
    private readonly IProfileRepository _profiles;

    public ProfileService(IProfileRepository profiles) => _profiles = profiles;

    public async Task<ProfileResponse> GetProfileAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var profile = await _profiles.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException("User profile not found.");

        return Map(profile);
    }

    public async Task<ProfileResponse> UpdateProfileAsync(
        Guid userId,
        UpdateProfileRequest request,
        CancellationToken cancellationToken = default)
    {
        var fullName = request.FullName.Trim();
        if (string.IsNullOrWhiteSpace(fullName))
            throw new AppException("Full name is required.");

        var phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        var avatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl.Trim();

        if (avatarUrl is not null && avatarUrl.Length > ProfileConstants.MaxAvatarUrlLength)
            throw new AppException($"Avatar URL must not exceed {ProfileConstants.MaxAvatarUrlLength} characters.");

        if (request.Addresses is { Count: > ProfileConstants.MaxAddressesPerUser })
            throw new AppException($"A user can have at most {ProfileConstants.MaxAddressesPerUser} addresses.");

        var profile = await _profiles.UpdateProfileAsync(
            userId,
            fullName,
            phone,
            avatarUrl,
            request.Addresses,
            cancellationToken);

        return Map(profile);
    }

    private static ProfileResponse Map(ProfileRecord profile)
    {
        var addresses = profile.Addresses
            .Select(a => new AddressDto
            {
                AddressId = a.AddressId,
                ReceiverName = a.ReceiverName,
                Phone = a.Phone,
                Province = a.Province,
                District = a.District,
                Ward = a.Ward,
                StreetAddress = a.StreetAddress,
                IsDefault = a.IsDefault
            })
            .ToList();

        return new ProfileResponse
        {
            UserId = profile.UserId,
            Email = profile.Email,
            FullName = profile.FullName,
            Phone = profile.Phone,
            AvatarUrl = profile.AvatarUrl,
            Roles = profile.Roles,
            Addresses = addresses,
            DefaultAddress = addresses.FirstOrDefault(a => a.IsDefault)
        };
    }
}
