using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Profile.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Exceptions;
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

    /// <summary>A shop name in use by a live shop or a live application is taken.</summary>
    public async Task<bool> ShopNameTakenAsync(
        string shopName,
        Guid? excludeRequestId = null,
        CancellationToken cancellationToken = default)
    {
        if (await _db.Shops.AsNoTracking().AnyAsync(x => x.ShopName == shopName, cancellationToken))
            return true;

        return await _db.SellerRegistrationRequests.AsNoTracking()
            .AnyAsync(
                r => r.ShopName == shopName
                     && r.RequestId != (excludeRequestId ?? Guid.Empty)
                     && (r.Status == SellerRegistrationConstants.StatusPending
                         || r.Status == SellerRegistrationConstants.StatusApproved),
                cancellationToken);
    }

    public async Task<SellerRegistrationRecord> CreateAsync(
        Guid userId,
        SellerRegistrationWriteModel model,
        CancellationToken cancellationToken = default)
    {
        var entity = new SellerRegistrationRequest
        {
            RequestId = Guid.NewGuid(),
            UserId = userId,
            ShopName = model.ShopName,
            BusinessInfo = model.BusinessInfo,
            DocumentUrls = model.DocumentUrlsJson,
            KycVerificationId = model.KycVerificationId,
            BusinessType = model.BusinessType,
            TaxCode = model.TaxCode,
            BusinessAddress = model.BusinessAddress,
            ContactPhone = model.ContactPhone,
            ContactEmail = model.ContactEmail,
            LicenseImageUrl = model.LicenseImageUrl,
            Status = AdminConstants.SellerRegistrationStatusPending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.SellerRegistrationRequests.Add(entity);
        await _db.SaveChangesAsync(cancellationToken);
        return Map(entity);
    }

    public async Task<SellerRegistrationRecord> UpdateAsync(
        Guid requestId,
        SellerRegistrationWriteModel model,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.SellerRegistrationRequests
            .FirstOrDefaultAsync(r => r.RequestId == requestId, cancellationToken)
            ?? throw new NotFoundException("Seller registration request not found.");

        entity.ShopName = model.ShopName;
        entity.BusinessInfo = model.BusinessInfo;
        entity.DocumentUrls = model.DocumentUrlsJson;
        entity.KycVerificationId = model.KycVerificationId;
        entity.BusinessType = model.BusinessType;
        entity.TaxCode = model.TaxCode;
        entity.BusinessAddress = model.BusinessAddress;
        entity.ContactPhone = model.ContactPhone;
        entity.ContactEmail = model.ContactEmail;
        entity.LicenseImageUrl = model.LicenseImageUrl;
        // Resubmitting sends it back to the review queue and clears the old note.
        entity.Status = AdminConstants.SellerRegistrationStatusPending;
        entity.AdminNote = null;
        entity.UpdatedAt = DateTime.UtcNow;

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
        CreatedAt = entity.CreatedAt,
        KycVerificationId = entity.KycVerificationId,
        BusinessType = entity.BusinessType,
        TaxCode = entity.TaxCode,
        BusinessAddress = entity.BusinessAddress,
        ContactPhone = entity.ContactPhone,
        ContactEmail = entity.ContactEmail,
        LicenseImageUrl = entity.LicenseImageUrl,
        UpdatedAt = entity.UpdatedAt
    };
}
