namespace AIDR.Shared.Dtos.Admin;

public sealed class AdminDashboardDto
{
    public int PendingProducts { get; init; }
    public int ApprovedProducts { get; init; }
    public int PendingSellerRegistrations { get; init; }
    public int PendingReturns { get; init; }
    public int ActiveUsers { get; init; }
    public int LockedUsers { get; init; }
    public int ActiveShops { get; init; }
    public int SystemVoucherActiveCount { get; init; }
}
