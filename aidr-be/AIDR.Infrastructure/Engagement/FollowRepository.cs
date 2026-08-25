using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Engagement;

public sealed class FollowRepository : IFollowRepository
{
    private readonly AidrDbContext _db;

    public FollowRepository(AidrDbContext db) => _db = db;

    public async Task<PagedResult<FollowedShopDto>> ListAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _db.SellerFollows
            .AsNoTracking()
            .Where(f => f.BuyerUserId == userId);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(f => f.FollowedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(f => new FollowedShopDto
            {
                ShopId = f.ShopId,
                ShopName = f.Shop.ShopName,
                Slug = f.Shop.Slug,
                Tagline = f.Shop.Tagline,
                ShortDescription = f.Shop.ShortDescription,
                LogoUrl = f.Shop.LogoUrl,
                BannerUrl = f.Shop.BannerUrl,
                IsVerified = f.Shop.IsVerified,
                AvgRating = f.Shop.AvgRating,
                RatingCount = f.Shop.RatingCount,
                FollowerCount = f.Shop.FollowerCount,
                ProductCount = f.Shop.ProductCount,
                FollowedAt = f.FollowedAt
            })
            .ToListAsync(cancellationToken);

        return new PagedResult<FollowedShopDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public Task<FollowableShopSnapshot?> GetFollowableShopAsync(
        Guid shopId,
        CancellationToken cancellationToken = default)
        => _db.Shops
            .AsNoTracking()
            .Where(s => s.ShopId == shopId)
            .Select(s => new FollowableShopSnapshot
            {
                ShopId = s.ShopId,
                OwnerUserId = s.OwnerUserId,
                ShopName = s.ShopName,
                Slug = s.Slug,
                Status = s.Status
            })
            .FirstOrDefaultAsync(cancellationToken);

    public Task<bool> IsFollowingAsync(
        Guid userId,
        Guid shopId,
        CancellationToken cancellationToken = default)
        => _db.SellerFollows.AnyAsync(
            f => f.BuyerUserId == userId && f.ShopId == shopId,
            cancellationToken);

    public async Task<FollowedShopDto> FollowAsync(
        Guid userId,
        Guid shopId,
        CancellationToken cancellationToken = default)
    {
        var entity = new SellerFollow
        {
            BuyerUserId = userId,
            ShopId = shopId,
            FollowedAt = DateTime.UtcNow
        };

        _db.SellerFollows.Add(entity);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            throw new ConflictException("You are already following this shop.");
        }

        await RecalculateFollowerCountAsync(shopId, cancellationToken);

        return await _db.SellerFollows
            .AsNoTracking()
            .Where(f => f.BuyerUserId == userId && f.ShopId == shopId)
            .Select(f => new FollowedShopDto
            {
                ShopId = f.ShopId,
                ShopName = f.Shop.ShopName,
                Slug = f.Shop.Slug,
                Tagline = f.Shop.Tagline,
                ShortDescription = f.Shop.ShortDescription,
                LogoUrl = f.Shop.LogoUrl,
                BannerUrl = f.Shop.BannerUrl,
                IsVerified = f.Shop.IsVerified,
                AvgRating = f.Shop.AvgRating,
                RatingCount = f.Shop.RatingCount,
                FollowerCount = f.Shop.FollowerCount,
                ProductCount = f.Shop.ProductCount,
                FollowedAt = f.FollowedAt
            })
            .FirstAsync(cancellationToken);
    }

    public async Task<UnfollowShopResponse> UnfollowAsync(
        Guid userId,
        Guid shopId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.SellerFollows
            .FirstOrDefaultAsync(
                f => f.BuyerUserId == userId && f.ShopId == shopId,
                cancellationToken)
            ?? throw new NotFoundException("You are not following this shop.");

        _db.SellerFollows.Remove(entity);
        await _db.SaveChangesAsync(cancellationToken);
        await RecalculateFollowerCountAsync(shopId, cancellationToken);

        return new UnfollowShopResponse { ShopId = shopId };
    }

    private async Task RecalculateFollowerCountAsync(Guid shopId, CancellationToken cancellationToken)
    {
        var shop = await _db.Shops
            .FirstOrDefaultAsync(s => s.ShopId == shopId, cancellationToken)
            ?? throw new NotFoundException("Shop not found.");

        shop.FollowerCount = await _db.SellerFollows.CountAsync(f => f.ShopId == shopId, cancellationToken);
        shop.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }
}
