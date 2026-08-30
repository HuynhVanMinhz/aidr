using System.ComponentModel.DataAnnotations;

namespace AIDR.Shared.Dtos.Profile;

public sealed class ProfileResponse
{
    public Guid UserId { get; set; }
    public string Email { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string? Phone { get; set; }
    public string? AvatarUrl { get; set; }
    public bool HasPassword { get; set; }
    public IReadOnlyList<string> Roles { get; set; } = Array.Empty<string>();
    public AddressDto? DefaultAddress { get; set; }
    public IReadOnlyList<AddressDto> Addresses { get; set; } = Array.Empty<AddressDto>();
}

public sealed class AddressDto
{
    public Guid AddressId { get; set; }
    public string ReceiverName { get; set; } = null!;
    public string Phone { get; set; } = null!;
    public string Province { get; set; } = null!;
    public string District { get; set; } = null!;
    public string Ward { get; set; } = null!;
    public string StreetAddress { get; set; } = null!;

    /// <summary>Pinned delivery point; null until the buyer places the pin.</summary>
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    public bool IsDefault { get; set; }
}

public sealed class UpdateProfileRequest
{
    [Required, MaxLength(128)]
    public string FullName { get; set; } = null!;

    [Required, MaxLength(20)]
    public string Phone { get; set; } = null!;

    [MaxLength(512)]
    public string? AvatarUrl { get; set; }

    [MaxLength(256)]
    public string? AvatarPublicId { get; set; }

    public List<AddressUpsertDto>? Addresses { get; set; }
}

public sealed class AddressUpsertDto
{
    public Guid? AddressId { get; set; }

    [Required, MaxLength(128)]
    public string ReceiverName { get; set; } = null!;

    [Required, MaxLength(20)]
    public string Phone { get; set; } = null!;

    [Required, MaxLength(100)]
    public string Province { get; set; } = null!;

    [Required, MaxLength(100)]
    public string District { get; set; } = null!;

    [Required, MaxLength(100)]
    public string Ward { get; set; } = null!;

    [Required, MaxLength(256)]
    public string StreetAddress { get; set; } = null!;

    [Range(-90, 90)]
    public double? Latitude { get; set; }

    [Range(-180, 180)]
    public double? Longitude { get; set; }

    public bool IsDefault { get; set; }
}
