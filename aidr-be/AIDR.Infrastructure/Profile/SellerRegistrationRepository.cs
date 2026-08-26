using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Profile.Abstractions;
using AIDR.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Profile;

public sealed class SellerRegistrationRepository : ISellerRegistrationRepository
{
    private readonly AidrDbContext _db;

    public SellerRegistrationRepository(AidrDbContext db) => _db = db;

    public Task<bool> UserHasRoleAsync(
        Guid userId,
        string roleCode,
        CancellationToken cancellationToken = default) =>
        _db.UserRoles.AsNoTracking()
            .AnyAsync(
                ur => ur.UserId == userId && ur.Role.RoleCode == roleCode,
                cancellationToken);

    public Task<bool> HasPendingAsync(Guid userId, CancellationToken cancellationToken = default) =>
        _db.SellerRegistrationRequests.AsNoTracking()
            .AnyAsync(
                r => r.UserId == userId
                     && r.Status == AdminConstants.SellerRegistrationStatusPending,
                cancellationToken);

    public Task<bool> OwnsShopAsync(Guid userId, CancellationToken cancellationToken = default) =>
        _db.Shops.AsNoTracking().AnyAsync(s => s.OwnerUserId == userId, cancellationToken);

    public async Task<SellerRegistrationRecord> CreateAsync(
        Guid userId,
        string shopName,
        string? businessInfo,
        string? documentUrlsJson,
        CancellationToken cancellationToken = default)
    {
        var entity = new SellerRegistrationRequest
        {
            RequestId = Guid.NewGuid(),
            UserId = userId,
            ShopName = shopName,
            BusinessInfo = businessInfo,
            DocumentUrls = documentUrlsJson,
            Status = AdminConstants.SellerRegistrationStatusPending,
            CreatedAt = DateTime.UtcNow
        };

        _db.SellerRegistrationRequests.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);
        return Map(entity);
    }

    public async Task<SellerRegistrationRecord?> GetLatestForUserAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.SellerRegistrationRequests.AsNoTracking()
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return entity is null ? null : Map(entity);
    }

    private static SellerRegistrationRecord Map(SellerRegistrationRequest entity) => new()
    {
        RequestId = entity.RequestId,
        UserId = entity.UserId,
        ShopName = entity.ShopName,
        BusinessInfo = entity.BusinessInfo,
        DocumentUrlsJson = entity.DocumentUrls,
        Status = entity.Status,
        AdminNote = entity.AdminNote,
        ReviewedAt = entity.ReviewedAt,
        CreatedAt = entity.CreatedAt
    };
}
