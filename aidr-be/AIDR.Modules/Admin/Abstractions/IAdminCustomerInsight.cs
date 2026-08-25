using AIDR.Shared.Dtos.Admin;

namespace AIDR.Modules.Admin.Abstractions;

public sealed class AdminInsightUserRegistration
{
    public Guid UserId { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class AdminInsightSalesOrder
{
    public Guid OrderId { get; init; }
    public Guid BuyerUserId { get; init; }
    public DateTime PaidAt { get; init; }
    public decimal TotalAmount { get; init; }
}

public sealed class AdminInsightSalesLine
{
    public Guid OrderId { get; init; }
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public DateTime PaidAt { get; init; }
    public int Quantity { get; init; }
    public decimal LineTotal { get; init; }
}

public sealed class AdminInsightPlatformSnapshot
{
    public int TotalUsers { get; init; }
    public int ActiveUsers { get; init; }
    public int LockedUsers { get; init; }
}

public sealed class AdminInsightBuyerFirstPaidOrder
{
    public Guid BuyerUserId { get; init; }
    public DateTime FirstPaidAt { get; init; }
}

public interface IAdminCustomerInsightRepository
{
    Task<AdminInsightPlatformSnapshot> GetPlatformSnapshotAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AdminInsightUserRegistration>> GetRegistrationsAsync(
        DateTime fromUtc,
        DateTime toExclusiveUtc,
        CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<AdminInsightSalesOrder> Orders, IReadOnlyList<AdminInsightSalesLine> Lines)>
        GetSalesAsync(
            DateTime fromUtc,
            DateTime toExclusiveUtc,
            CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AdminInsightBuyerFirstPaidOrder>> GetBuyerFirstPaidOrdersAsync(
        IReadOnlyCollection<Guid> buyerUserIds,
        CancellationToken cancellationToken = default);
}

public interface IAdminCustomerInsightService
{
    Task<AdminCustomerInsightsDto> GetCustomerInsightsAsync(
        AdminCustomerInsightsQueryRequest request,
        CancellationToken cancellationToken = default);
}
