using AIDR.Shared.Dtos.Profile;

namespace AIDR.Modules.Profile.Abstractions;

public sealed class ProfileRecord
{
    public Guid UserId { get; init; }
    public string Email { get; init; } = null!;
    public string FullName { get; init; } = null!;
    public string? Phone { get; init; }
    public string? AvatarUrl { get; init; }
    public bool HasPassword { get; init; }
    public IReadOnlyList<string> Roles { get; init; } = Array.Empty<string>();
    public IReadOnlyList<AddressRecord> Addresses { get; init; } = Array.Empty<AddressRecord>();
}

public sealed class AddressRecord
{
    public Guid AddressId { get; init; }
    public string ReceiverName { get; init; } = null!;
    public string Phone { get; init; } = null!;
    public string Province { get; init; } = null!;
    public string District { get; init; } = null!;
    public string Ward { get; init; } = null!;
    public string StreetAddress { get; init; } = null!;
    public double? Latitude { get; init; }
    public double? Longitude { get; init; }
    public bool IsDefault { get; init; }
}

public interface IProfileRepository
{
    Task<ProfileRecord?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<ProfileRecord> UpdateProfileAsync(
        Guid userId,
        string fullName,
        string? phone,
        string? avatarUrl,
        IReadOnlyList<AddressUpsertDto>? addresses,
        CancellationToken cancellationToken = default);
}
