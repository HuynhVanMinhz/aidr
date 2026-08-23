using System.Text.RegularExpressions;
using AIDR.Modules.Profile.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Profile;
using AIDR.Shared.Exceptions;
using AIDR.Shared.Validation;

namespace AIDR.Modules.Profile.Services;

public sealed class ProfileService : IProfileService
{
    private static readonly Regex HttpUrlRegex = new(
        @"^https?:\/\/.+\..+",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

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
        var fullName = request.FullName?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(fullName))
            throw new AppException("Full name is required.");

        if (fullName.Length > 128)
            throw new AppException("Full name must not exceed 128 characters.");

        var phone = PhoneValidation.RequireValidVnPhone(request.Phone, "Phone");

        string? avatarUrl = null;
        if (!string.IsNullOrWhiteSpace(request.AvatarUrl))
        {
            avatarUrl = request.AvatarUrl.Trim();
            if (avatarUrl.Length > ProfileConstants.MaxAvatarUrlLength)
                throw new AppException($"Avatar URL must not exceed {ProfileConstants.MaxAvatarUrlLength} characters.");

            if (!HttpUrlRegex.IsMatch(avatarUrl))
                throw new AppException("Avatar URL is invalid.");
        }

        if (request.Addresses is not null)
        {
            if (request.Addresses.Count > ProfileConstants.MaxAddressesPerUser)
                throw new AppException($"A user can have at most {ProfileConstants.MaxAddressesPerUser} addresses.");

            foreach (var address in request.Addresses)
                ValidateAddress(address);
        }

        var profile = await _profiles.UpdateProfileAsync(
            userId,
            fullName,
            phone,
            avatarUrl,
            request.Addresses,
            cancellationToken);

        return Map(profile);
    }

    private static void ValidateAddress(AddressUpsertDto address)
    {
        if (string.IsNullOrWhiteSpace(address.ReceiverName))
            throw new AppException("Receiver name is required.");

        if (string.IsNullOrWhiteSpace(address.Province))
            throw new AppException("Province is required.");

        if (string.IsNullOrWhiteSpace(address.District))
            throw new AppException("District is required.");

        if (string.IsNullOrWhiteSpace(address.Ward))
            throw new AppException("Ward is required.");

        if (string.IsNullOrWhiteSpace(address.StreetAddress))
            throw new AppException("Street address is required.");

        address.ReceiverName = address.ReceiverName.Trim();
        address.Province = address.Province.Trim();
        address.District = address.District.Trim();
        address.Ward = address.Ward.Trim();
        address.StreetAddress = address.StreetAddress.Trim();
        address.Phone = PhoneValidation.RequireValidVnPhone(address.Phone, "Address phone");
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
            HasPassword = profile.HasPassword,
            Roles = profile.Roles,
            Addresses = addresses,
            DefaultAddress = addresses.FirstOrDefault(a => a.IsDefault)
        };
    }
}
