using AIDR.Shared.Dtos.Seller;

namespace AIDR.Modules.SellerCenter.Abstractions;

public sealed class SellerFinanceSalesLine
{
    public Guid OrderId { get; init; }
    public DateTime PaidAt { get; init; }
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public int Quantity { get; init; }
    public decimal LineTotal { get; init; }
    public decimal Cogs { get; init; }
}

public sealed class SellerFinanceSalesOrder
{
    public Guid OrderId { get; init; }
    public DateTime PaidAt { get; init; }
    public decimal TotalAmount { get; init; }
}

public interface ISellerFinanceRepository
{
    Task<SellerDashboardDto> GetDashboardAsync(Guid shopId, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<SellerFinanceSalesOrder> Orders, IReadOnlyList<SellerFinanceSalesLine> Lines)>
        GetSalesAsync(
            Guid shopId,
            DateTime fromUtc,
            DateTime toExclusiveUtc,
            CancellationToken cancellationToken = default);

    Task<SellerWalletDto> GetWalletAsync(
        Guid shopId,
        string? txType,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}

public interface ISellerFinanceService
{
    Task<SellerDashboardDto> GetDashboardAsync(
        Guid ownerUserId,
        CancellationToken cancellationToken = default);

    Task<SellerSalesReportDto> GetSalesReportAsync(
        Guid ownerUserId,
        SellerSalesReportQueryRequest request,
        CancellationToken cancellationToken = default);

    Task<SellerWalletDto> GetWalletAsync(
        Guid ownerUserId,
        SellerWalletQueryRequest request,
        CancellationToken cancellationToken = default);
}
