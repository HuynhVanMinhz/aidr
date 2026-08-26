using AIDR.Infrastructure.Persistence;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Admin;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Admin;

public sealed class AdminDashboardRepository : IAdminDashboardRepository
{
    private readonly AidrDbContext _db;

    public AdminDashboardRepository(AidrDbContext db) => _db = db;

    public async Task<AdminDashboardDto> GetKpisAsync(CancellationToken cancellationToken = default)
    {
        var pendingProducts = await _db.Products.AsNoTracking()
            .CountAsync(p => p.Status == AdminConstants.ProductStatusPending, cancellationToken);

        var approvedProducts = await _db.Products.AsNoTracking()
            .CountAsync(p => p.Status == AdminConstants.ProductStatusApproved, cancellationToken);

        var pendingSellerRegistrations = await _db.SellerRegistrationRequests.AsNoTracking()
            .CountAsync(
                r => r.Status == AdminConstants.SellerRegistrationStatusPending,
                cancellationToken);

        var pendingReturns = await _db.ReturnRequests.AsNoTracking()
            .CountAsync(r => r.Status == ReturnConstants.StatusPending, cancellationToken);

        var activeUsers = await _db.Users.AsNoTracking()
            .CountAsync(u => u.Status == AdminConstants.UserStatusActive, cancellationToken);

        var lockedUsers = await _db.Users.AsNoTracking()
            .CountAsync(u => u.Status == AdminConstants.UserStatusLocked, cancellationToken);

        var activeShops = await _db.Shops.AsNoTracking()
            .CountAsync(s => s.Status == AdminConstants.ShopStatusActive, cancellationToken);

        var systemVoucherActiveCount = await _db.Vouchers.AsNoTracking()
            .CountAsync(
                v => v.Scope == VoucherConstants.ScopeSystem && v.IsActive,
                cancellationToken);

        return new AdminDashboardDto
        {
            PendingProducts = pendingProducts,
            ApprovedProducts = approvedProducts,
            PendingSellerRegistrations = pendingSellerRegistrations,
            PendingReturns = pendingReturns,
            ActiveUsers = activeUsers,
            LockedUsers = lockedUsers,
            ActiveShops = activeShops,
            SystemVoucherActiveCount = systemVoucherActiveCount
        };
    }
}
