using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Profile.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Profile;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Profile;

public sealed class ProfileRepository : IProfileRepository
{
    private readonly AidrDbContext _db;

    public ProfileRepository(AidrDbContext db) => _db = db;

    public async Task<ProfileRecord?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await QueryUsers()
            .FirstOrDefaultAsync(u => u.UserId == userId, cancellationToken);
        return user is null ? null : Map(user);
    }

    public async Task<ProfileRecord> UpdateProfileAsync(
        Guid userId,
        string fullName,
        string? phone,
        string? avatarUrl,
        IReadOnlyList<AddressUpsertDto>? addresses,
        CancellationToken cancellationToken = default)
    {
        var user = await _db.Users
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.Addresses)
            .FirstOrDefaultAsync(u => u.UserId == userId, cancellationToken)
            ?? throw new NotFoundException("User profile not found.");

        user.FullName = fullName;
        user.Phone = phone;
        user.AvatarUrl = avatarUrl;
        user.UpdatedAt = DateTime.UtcNow;

        if (addresses is not null)
            await SyncAddressesAsync(user, addresses, cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);

        var refreshed = await QueryUsers()
            .FirstAsync(u => u.UserId == userId, cancellationToken);
        return Map(refreshed);
    }

    private async Task SyncAddressesAsync(
        User user,
        IReadOnlyList<AddressUpsertDto> addresses,
        CancellationToken cancellationToken)
    {
        if (addresses.Count > ProfileConstants.MaxAddressesPerUser)
            throw new AppException($"A user can have at most {ProfileConstants.MaxAddressesPerUser} addresses.");

        var existing = user.Addresses.ToDictionary(a => a.AddressId);
        var keepIds = new HashSet<Guid>();
        var now = DateTime.UtcNow;

        foreach (var dto in addresses)
        {
            if (dto.AddressId is { } addressId)
            {
                if (!existing.TryGetValue(addressId, out var entity))
                    throw new AppException("Address not found or does not belong to this user.");

                ApplyAddress(entity, dto, now);
                keepIds.Add(addressId);
            }
            else
            {
                var created = new Address
                {
                    AddressId = Guid.NewGuid(),
                    UserId = user.UserId,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                ApplyAddress(created, dto, now);
                _db.Addresses.Add(created);
                keepIds.Add(created.AddressId);
            }
        }

        var toRemove = user.Addresses.Where(a => !keepIds.Contains(a.AddressId)).ToList();
        if (toRemove.Count > 0)
            _db.Addresses.RemoveRange(toRemove);

        await EnsureSingleDefaultAsync(user.UserId, cancellationToken);
    }

    private static void ApplyAddress(Address entity, AddressUpsertDto dto, DateTime now)
    {
        entity.ReceiverName = dto.ReceiverName.Trim();
        entity.Phone = dto.Phone.Trim();
        entity.Province = dto.Province.Trim();
        entity.District = dto.District.Trim();
        entity.Ward = dto.Ward.Trim();
        entity.StreetAddress = dto.StreetAddress.Trim();
        entity.IsDefault = dto.IsDefault;
        entity.UpdatedAt = now;
    }

    private async Task EnsureSingleDefaultAsync(Guid userId, CancellationToken cancellationToken)
    {
        var userAddresses = await _db.Addresses
            .Where(a => a.UserId == userId)
            .OrderBy(a => a.CreatedAt)
            .ToListAsync(cancellationToken);

        if (userAddresses.Count == 0)
            return;

        var defaults = userAddresses.Where(a => a.IsDefault).ToList();
        if (defaults.Count == 0)
        {
            userAddresses[0].IsDefault = true;
            userAddresses[0].UpdatedAt = DateTime.UtcNow;
            return;
        }

        if (defaults.Count == 1)
            return;

        var winner = defaults[0];
        foreach (var address in userAddresses)
        {
            if (address.AddressId == winner.AddressId)
                continue;

            if (address.IsDefault)
            {
                address.IsDefault = false;
                address.UpdatedAt = DateTime.UtcNow;
            }
        }
    }

    private IQueryable<User> QueryUsers()
        => _db.Users.AsNoTracking()
            .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
            .Include(u => u.Addresses);

    private static ProfileRecord Map(User user) => new()
    {
        UserId = user.UserId,
        Email = user.Email,
        FullName = user.FullName,
        Phone = user.Phone,
        AvatarUrl = user.AvatarUrl,
        Roles = user.UserRoles.Select(ur => ur.Role.RoleCode).ToList(),
        Addresses = user.Addresses
            .OrderByDescending(a => a.IsDefault)
            .ThenBy(a => a.CreatedAt)
            .Select(a => new AddressRecord
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
            .ToList()
    };
}
