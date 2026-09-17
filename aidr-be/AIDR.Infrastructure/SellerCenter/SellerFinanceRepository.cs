using AIDR.Infrastructure.Persistence;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.SellerCenter;

public sealed class SellerFinanceRepository : ISellerFinanceRepository
{
    private readonly AidrDbContext _db;

    public SellerFinanceRepository(AidrDbContext db) => _db = db;

    public async Task<SellerDashboardDto> GetDashboardAsync(
        Guid shopId,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var today = now.Date;
        var tomorrow = today.AddDays(1);
        var weekStart = StartOfIsoWeek(today);
        var monthStart = new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var statusRows = await _db.Orders.AsNoTracking()
            .Where(o => o.ShopId == shopId)
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var statusCounts = statusRows.ToDictionary(
            r => r.Status,
            r => r.Count,
            StringComparer.OrdinalIgnoreCase);

        // Recognized revenue sticks through open return disputes; reverse only when
        // the order is Returned (refund/exchange done) or Cancelled.
        var completedQuery = _db.Orders.AsNoTracking()
            .Where(o => o.ShopId == shopId
                        && o.CompletedAt != null
                        && !SellerFinanceConstants.RecognizedRevenueExcludedStatuses.Contains(o.Status));

        var revenueToday = await completedQuery
            .Where(o => o.CompletedAt >= today && o.CompletedAt < tomorrow)
            .SumAsync(o => (decimal?)o.TotalAmount, cancellationToken) ?? 0m;

        var revenueWeek = await completedQuery
            .Where(o => o.CompletedAt >= weekStart && o.CompletedAt < tomorrow)
            .SumAsync(o => (decimal?)o.TotalAmount, cancellationToken) ?? 0m;

        var revenueMonth = await completedQuery
            .Where(o => o.CompletedAt >= monthStart && o.CompletedAt < tomorrow)
            .SumAsync(o => (decimal?)o.TotalAmount, cancellationToken) ?? 0m;

        var revenueAllTime = await completedQuery
            .SumAsync(o => (decimal?)o.TotalAmount, cancellationToken) ?? 0m;

        // Real escrow balance, not a guess from order statuses: this is the shop's
        // net (after the platform fee) that has been held but not released yet.
        var pendingSettlement = await _db.Wallets.AsNoTracking()
            .Where(w => w.ShopId == shopId)
            .Select(w => (decimal?)w.PendingBalance)
            .FirstOrDefaultAsync(cancellationToken) ?? 0m;

        var catalogQuery = _db.Products.AsNoTracking()
            .Where(p => p.ShopId == shopId && p.Status != SellerProductConstants.StatusDeleted);

        var pendingProductCount = await catalogQuery
            .CountAsync(p => p.Status == SellerProductConstants.StatusPending, cancellationToken);
        var activeProductCount = await catalogQuery
            .CountAsync(p => p.Status == SellerProductConstants.StatusApproved, cancellationToken);
        var lowStockCount = await catalogQuery
            .CountAsync(
                p => p.StockQuantity - p.ReservedQuantity <= p.LowStockThreshold,
                cancellationToken);

        var wallet = await _db.Wallets.AsNoTracking()
            .Where(w => w.ShopId == shopId)
            .Select(w => new { w.AvailableBalance, w.Currency })
            .FirstOrDefaultAsync(cancellationToken);

        var recentOrders = await _db.Orders.AsNoTracking()
            .Where(o => o.ShopId == shopId)
            .OrderByDescending(o => o.CreatedAt)
            .Take(SellerFinanceConstants.RecentOrderLimit)
            .Select(o => new SellerDashboardRecentOrderDto
            {
                OrderId = o.OrderId,
                OrderCode = o.OrderCode,
                Status = o.Status,
                TotalAmount = o.TotalAmount,
                CreatedAt = o.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var lowStockItems = await _db.Products.AsNoTracking()
            .Where(p => p.ShopId == shopId
                        && p.Status != SellerProductConstants.StatusDeleted
                        && p.StockQuantity - p.ReservedQuantity <= p.LowStockThreshold)
            .OrderBy(p => p.StockQuantity - p.ReservedQuantity)
            .ThenBy(p => p.Name)
            .Take(SellerFinanceConstants.LowStockPreviewLimit)
            .Select(p => new SellerDashboardLowStockItemDto
            {
                ProductId = p.ProductId,
                Name = p.Name,
                AvailableQuantity = p.StockQuantity - p.ReservedQuantity,
                LowStockThreshold = p.LowStockThreshold
            })
            .ToListAsync(cancellationToken);

        return new SellerDashboardDto
        {
            ShopId = shopId,
            Currency = wallet?.Currency ?? SellerFinanceConstants.CurrencyVnd,
            Orders = new SellerDashboardOrderKpiDto
            {
                TotalCount = statusRows.Sum(r => r.Count),
                PendingPaymentCount = CountStatus(statusCounts, OrderConstants.StatusPendingPayment),
                AwaitingFulfillmentCount =
                    CountStatus(statusCounts, OrderConstants.StatusPaid)
                    + CountStatus(statusCounts, OrderConstants.StatusConfirmed),
                ShippingCount = CountStatus(statusCounts, OrderConstants.StatusShipping),
                DeliveredCount = CountStatus(statusCounts, OrderConstants.StatusDelivered),
                CompletedCount = CountStatus(statusCounts, OrderConstants.StatusCompleted),
                CancelledCount = CountStatus(statusCounts, OrderConstants.StatusCancelled),
                ReturnRequestedCount = CountStatus(statusCounts, OrderConstants.StatusReturnRequested),
                ReturnedCount = CountStatus(statusCounts, OrderConstants.StatusReturned)
            },
            Revenue = new SellerDashboardRevenueKpiDto
            {
                Today = RoundMoney(revenueToday),
                ThisWeek = RoundMoney(revenueWeek),
                ThisMonth = RoundMoney(revenueMonth),
                AllTime = RoundMoney(revenueAllTime)
            },
            Catalog = new SellerDashboardCatalogKpiDto
            {
                PendingProductCount = pendingProductCount,
                LowStockCount = lowStockCount,
                ActiveProductCount = activeProductCount
            },
            Wallet = new SellerDashboardWalletKpiDto
            {
                AvailableBalance = RoundMoney(wallet?.AvailableBalance ?? 0m),
                PendingBalance = RoundMoney(pendingSettlement)
            },
            RecentOrders = recentOrders,
            LowStockItems = lowStockItems,
            GeneratedAt = now
        };
    }

    public async Task<(IReadOnlyList<SellerFinanceSalesOrder> Orders, IReadOnlyList<SellerFinanceSalesLine> Lines)>
        GetSalesAsync(
            Guid shopId,
            DateTime fromUtc,
            DateTime toExclusiveUtc,
            CancellationToken cancellationToken = default)
    {
        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.ShopId == shopId
                        && o.PaidAt != null
                        && o.PaidAt >= fromUtc
                        && o.PaidAt < toExclusiveUtc
                        && SellerFinanceConstants.SalesOrderStatuses.Contains(o.Status))
            .Select(o => new SellerFinanceSalesOrder
            {
                OrderId = o.OrderId,
                PaidAt = o.PaidAt!.Value,
                TotalAmount = o.TotalAmount
            })
            .ToListAsync(cancellationToken);

        var lines = await _db.OrderItems.AsNoTracking()
            .Where(i => i.Order.ShopId == shopId
                        && i.Order.PaidAt != null
                        && i.Order.PaidAt >= fromUtc
                        && i.Order.PaidAt < toExclusiveUtc
                        && SellerFinanceConstants.SalesOrderStatuses.Contains(i.Order.Status))
            .Select(i => new
            {
                i.OrderId,
                PaidAt = i.Order.PaidAt!.Value,
                i.ProductId,
                ProductName = i.ProductNameSnapshot,
                i.Quantity,
                i.LineTotal,
                i.UnitCostAvg,
                HasAllocations = i.LotAllocations.Any(),
                AllocCogs = i.LotAllocations.Sum(a => a.Quantity * a.UnitCostSnapshot)
            })
            .ToListAsync(cancellationToken);

        var mappedLines = lines.Select(i => new SellerFinanceSalesLine
        {
            OrderId = i.OrderId,
            PaidAt = i.PaidAt,
            ProductId = i.ProductId,
            ProductName = i.ProductName,
            Quantity = i.Quantity,
            LineTotal = i.LineTotal,
            Cogs = i.HasAllocations
                ? i.AllocCogs
                : (i.UnitCostAvg ?? 0m) * i.Quantity
        }).ToList();

        return (orders, mappedLines);
    }

    public async Task<SellerWalletDto> GetWalletAsync(
        Guid shopId,
        string? txType,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var wallet = await _db.Wallets.AsNoTracking()
            .FirstOrDefaultAsync(w => w.ShopId == shopId, cancellationToken)
            ?? throw new NotFoundException("Seller wallet was not found for this shop.");

        var txQuery = _db.WalletTransactions.AsNoTracking()
            .Where(t => t.WalletId == wallet.WalletId);

        if (!string.IsNullOrWhiteSpace(txType))
            txQuery = txQuery.Where(t => t.TxType == txType);

        var totalCount = await txQuery.CountAsync(cancellationToken);
        var totalPages = pageSize <= 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);
        var effectivePage = totalPages == 0 ? 1 : Math.Min(page, totalPages);

        var transactions = await txQuery
            .OrderByDescending(t => t.CreatedAt)
            .ThenByDescending(t => t.WalletTxId)
            .Skip((effectivePage - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new SellerWalletTransactionDto
            {
                WalletTxId = t.WalletTxId,
                TxType = t.TxType,
                Amount = t.Amount,
                BalanceAfter = t.BalanceAfter,
                ReferenceType = t.ReferenceType,
                ReferenceId = t.ReferenceId,
                Note = t.Note,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return new SellerWalletDto
        {
            WalletId = wallet.WalletId,
            ShopId = wallet.ShopId,
            AvailableBalance = RoundMoney(wallet.AvailableBalance),
            PendingBalance = RoundMoney(wallet.PendingBalance),
            Currency = wallet.Currency,
            UpdatedAt = wallet.UpdatedAt,
            Transactions = transactions,
            Page = effectivePage,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    private static int CountStatus(IReadOnlyDictionary<string, int> counts, string status)
        => counts.TryGetValue(status, out var value) ? value : 0;

    private static DateTime StartOfIsoWeek(DateTime date)
    {
        var diff = ((int)date.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        return DateTime.SpecifyKind(date.AddDays(-diff), DateTimeKind.Utc);
    }

    private static decimal RoundMoney(decimal value)
        => decimal.Round(value, 2, MidpointRounding.AwayFromZero);
}
