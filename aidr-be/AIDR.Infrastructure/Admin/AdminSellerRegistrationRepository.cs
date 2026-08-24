using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Admin;

public sealed class AdminSellerRegistrationRepository : IAdminSellerRegistrationRepository
{
    private readonly AidrDbContext _db;

    public AdminSellerRegistrationRepository(AidrDbContext db) => _db = db;

    public async Task<(IReadOnlyList<AdminSellerRegistrationRecord> Items, int TotalCount, int Page, AdminSellerRegistrationListSummary Summary)>
        ListPagedAsync(
            string? status,
            string? keyword,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default)
    {
        var query = from r in _db.SellerRegistrationRequests.AsNoTracking()
                    join u in _db.Users.AsNoTracking() on r.UserId equals u.UserId
                    join reviewer in _db.Users.AsNoTracking() on r.ReviewedBy equals reviewer.UserId into reviewers
                    from reviewer in reviewers.DefaultIfEmpty()
                    join shop in _db.Shops.AsNoTracking() on r.UserId equals shop.OwnerUserId into shops
                    from shop in shops.DefaultIfEmpty()
                    select new { Request = r, User = u, Reviewer = reviewer, Shop = shop };

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Request.Status == status);

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var term = keyword.Trim();
            query = query.Where(x =>
                x.Request.ShopName.Contains(term) ||
                x.User.Email.Contains(term) ||
                x.User.FullName.Contains(term));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var summary = new AdminSellerRegistrationListSummary
        {
            PendingCount = await _db.SellerRegistrationRequests.AsNoTracking()
                .CountAsync(r => r.Status == AdminConstants.SellerRegistrationStatusPending, cancellationToken),
            ApprovedCount = await _db.SellerRegistrationRequests.AsNoTracking()
                .CountAsync(r => r.Status == AdminConstants.SellerRegistrationStatusApproved, cancellationToken),
            RejectedCount = await _db.SellerRegistrationRequests.AsNoTracking()
                .CountAsync(r => r.Status == AdminConstants.SellerRegistrationStatusRejected, cancellationToken)
        };

        if (totalCount == 0)
            return (Array.Empty<AdminSellerRegistrationRecord>(), 0, 1, summary);

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        if (page > totalPages)
            page = totalPages;

        var rows = await query
            .OrderByDescending(x => x.Request.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = rows.Select(x => Map(x.Request, x.User, x.Reviewer, x.Shop?.ShopId)).ToList();
        return (items, totalCount, page, summary);
    }

    public async Task<AdminSellerRegistrationRecord?> GetByIdAsync(
        Guid requestId,
        CancellationToken cancellationToken = default)
    {
        var row = await (
            from r in _db.SellerRegistrationRequests.AsNoTracking()
            join u in _db.Users.AsNoTracking() on r.UserId equals u.UserId
            join reviewer in _db.Users.AsNoTracking() on r.ReviewedBy equals reviewer.UserId into reviewers
            from reviewer in reviewers.DefaultIfEmpty()
            join shop in _db.Shops.AsNoTracking() on r.UserId equals shop.OwnerUserId into shops
            from shop in shops.DefaultIfEmpty()
            where r.RequestId == requestId
            select new { Request = r, User = u, Reviewer = reviewer, Shop = shop }
        ).FirstOrDefaultAsync(cancellationToken);

        return row is null ? null : Map(row.Request, row.User, row.Reviewer, row.Shop?.ShopId);
    }

    public async Task<ApproveSellerRegistrationResult> ApproveAsync(
        Guid requestId,
        Guid adminUserId,
        string shopSlug,
        string? shortDescription,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var entity = await _db.SellerRegistrationRequests
            .FirstOrDefaultAsync(r => r.RequestId == requestId, cancellationToken)
            ?? throw new NotFoundException("Seller registration request not found.");

        if (entity.Status != AdminConstants.SellerRegistrationStatusPending)
            throw new ConflictException("Only pending seller registration requests can be approved.");

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.UserId == entity.UserId, cancellationToken)
            ?? throw new NotFoundException("Applicant user not found.");

        if (user.Status != "Active")
            throw new ConflictException("Cannot approve a seller registration for a non-active user.");

        if (await _db.Shops.AnyAsync(s => s.OwnerUserId == entity.UserId, cancellationToken))
            throw new ConflictException("This user already owns a shop.");

        var sellerRole = await _db.Roles
            .FirstOrDefaultAsync(r => r.RoleCode == RoleCodes.Seller, cancellationToken)
            ?? throw new AppException("SELLER role is not seeded in database.", 500);

        var alreadySeller = await _db.UserRoles.AnyAsync(
            ur => ur.UserId == entity.UserId && ur.RoleId == sellerRole.RoleId,
            cancellationToken);

        var now = DateTime.UtcNow;

        if (!alreadySeller)
        {
            _db.UserRoles.Add(new UserRole
            {
                UserId = entity.UserId,
                RoleId = sellerRole.RoleId,
                AssignedAt = now
            });
        }

        var shop = new Shop
        {
            ShopId = Guid.NewGuid(),
            OwnerUserId = entity.UserId,
            ShopName = entity.ShopName,
            Slug = shopSlug,
            ShortDescription = shortDescription,
            CostingMethod = AdminConstants.ShopCostingMethodFifo,
            IsVerified = true,
            VerifiedAt = now,
            Status = AdminConstants.ShopStatusActive,
            AvgRating = 0,
            RatingCount = 0,
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.Shops.Add(shop);

        var wallet = new Wallet
        {
            WalletId = Guid.NewGuid(),
            ShopId = shop.ShopId,
            AvailableBalance = 0,
            PendingBalance = 0,
            Currency = AdminConstants.WalletCurrencyVnd,
            UpdatedAt = now
        };
        _db.Wallets.Add(wallet);

        entity.Status = AdminConstants.SellerRegistrationStatusApproved;
        entity.AdminNote = null;
        entity.ReviewedBy = adminUserId;
        entity.ReviewedAt = now;

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var reviewer = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserId == adminUserId, cancellationToken);

        return new ApproveSellerRegistrationResult
        {
            Request = Map(entity, user, reviewer, shop.ShopId),
            ShopId = shop.ShopId,
            WalletId = wallet.WalletId
        };
    }

    public async Task<AdminSellerRegistrationRecord> RejectAsync(
        Guid requestId,
        Guid adminUserId,
        string adminNote,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.SellerRegistrationRequests
            .FirstOrDefaultAsync(r => r.RequestId == requestId, cancellationToken)
            ?? throw new NotFoundException("Seller registration request not found.");

        if (entity.Status != AdminConstants.SellerRegistrationStatusPending)
            throw new ConflictException("Only pending seller registration requests can be rejected.");

        var user = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserId == entity.UserId, cancellationToken)
            ?? throw new NotFoundException("Applicant user not found.");

        var now = DateTime.UtcNow;
        entity.Status = AdminConstants.SellerRegistrationStatusRejected;
        entity.AdminNote = adminNote;
        entity.ReviewedBy = adminUserId;
        entity.ReviewedAt = now;

        await _db.SaveChangesAsync(cancellationToken);

        var reviewer = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserId == adminUserId, cancellationToken);

        return Map(entity, user, reviewer, shopId: null);
    }

    public Task<bool> SlugExistsAsync(string slug, CancellationToken cancellationToken = default) =>
        _db.Shops.AsNoTracking().AnyAsync(s => s.Slug == slug, cancellationToken);

    private static AdminSellerRegistrationRecord Map(
        SellerRegistrationRequest request,
        User user,
        User? reviewer,
        Guid? shopId) => new()
    {
        RequestId = request.RequestId,
        UserId = request.UserId,
        UserEmail = user.Email,
        UserFullName = user.FullName,
        ShopName = request.ShopName,
        BusinessInfo = request.BusinessInfo,
        DocumentUrlsJson = request.DocumentUrls,
        Status = request.Status,
        AdminNote = request.AdminNote,
        ReviewedBy = request.ReviewedBy,
        ReviewerFullName = reviewer?.FullName,
        ReviewedAt = request.ReviewedAt,
        CreatedAt = request.CreatedAt,
        ShopId = shopId
    };
}
