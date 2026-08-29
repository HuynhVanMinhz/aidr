using System.Globalization;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.SellerCenter.Services;

public sealed class SellerFinanceService : ISellerFinanceService
{
    private readonly ISellerProductRepository _products;
    private readonly ISellerFinanceRepository _finance;

    public SellerFinanceService(
        ISellerProductRepository products,
        ISellerFinanceRepository finance)
    {
        _products = products;
        _finance = finance;
    }

    public async Task<SellerDashboardDto> GetDashboardAsync(
        Guid ownerUserId,
        CancellationToken cancellationToken = default)
    {
        var shop = await RequireActiveShopAsync(ownerUserId, cancellationToken);
        return await _finance.GetDashboardAsync(shop.ShopId, cancellationToken);
    }

    public async Task<SellerSalesReportDto> GetSalesReportAsync(
        Guid ownerUserId,
        SellerSalesReportQueryRequest request,
        CancellationToken cancellationToken = default)
    {
        var shop = await RequireActiveShopAsync(ownerUserId, cancellationToken);
        var (from, toInclusive, toExclusive, granularity) = NormalizeRange(request);

        var (orders, lines) = await _finance.GetSalesAsync(
            shop.ShopId,
            from,
            toExclusive,
            cancellationToken);

        var series = BuildSeries(from, toInclusive, granularity, orders, lines);
        var topProducts = BuildTopProducts(lines);

        var orderRevenue = RoundMoney(orders.Sum(o => o.TotalAmount));
        var productRevenue = RoundMoney(lines.Sum(l => l.LineTotal));
        var cogs = RoundMoney(lines.Sum(l => l.Cogs));
        var margin = RoundMoney(productRevenue - cogs);

        return new SellerSalesReportDto
        {
            ShopId = shop.ShopId,
            Currency = SellerFinanceConstants.CurrencyVnd,
            Granularity = granularity,
            From = from,
            To = toInclusive,
            Totals = new SellerSalesReportTotalsDto
            {
                OrderCount = orders.Count,
                UnitsSold = lines.Sum(l => l.Quantity),
                OrderRevenue = orderRevenue,
                ProductRevenue = productRevenue,
                Cogs = cogs,
                GrossMargin = margin,
                GrossMarginPercent = Percent(margin, productRevenue)
            },
            Series = series,
            TopProducts = topProducts
        };
    }

    public async Task<SellerWalletDto> GetWalletAsync(
        Guid ownerUserId,
        SellerWalletQueryRequest request,
        CancellationToken cancellationToken = default)
    {
        var shop = await RequireActiveShopAsync(ownerUserId, cancellationToken);
        var txType = NormalizeTxType(request.TxType);
        var (page, pageSize) = SellerFinanceConstants.NormalizePaging(request.Page, request.PageSize);

        return await _finance.GetWalletAsync(shop.ShopId, txType, page, pageSize, cancellationToken);
    }

    private async Task<SellerShopRecord> RequireActiveShopAsync(
        Guid ownerUserId,
        CancellationToken cancellationToken)
    {
        if (ownerUserId == Guid.Empty)
            throw new AppException("Seller user id is required.");

        return await _products.GetActiveShopByOwnerAsync(ownerUserId, cancellationToken)
            ?? throw new AppException("Active shop not found for this seller.");
    }

    private static string? NormalizeTxType(string? txType)
    {
        if (string.IsNullOrWhiteSpace(txType))
            return null;

        var normalized = txType.Trim();
        var match = SellerFinanceConstants.WalletTxTypes
            .FirstOrDefault(t => string.Equals(t, normalized, StringComparison.OrdinalIgnoreCase));

        if (match is null)
            throw new AppException(
                $"Unknown wallet transaction type '{normalized}'.");

        return match;
    }

    private static (DateTime From, DateTime ToInclusive, DateTime ToExclusive, string Granularity)
        NormalizeRange(SellerSalesReportQueryRequest request)
    {
        var granularity = string.IsNullOrWhiteSpace(request.Granularity)
            ? SellerFinanceConstants.GranularityDay
            : request.Granularity.Trim().ToLowerInvariant();

        if (!SellerFinanceConstants.AllowedGranularities.Contains(granularity))
            throw new AppException("Granularity must be day, week, or month.");

        var today = DateTime.UtcNow.Date;
        var toInclusive = request.To.HasValue ? request.To.Value.Date : today;
        var from = request.From.HasValue
            ? request.From.Value.Date
            : toInclusive.AddDays(1 - SellerFinanceConstants.DefaultReportDays);

        if (from > toInclusive)
            throw new AppException("From date must be on or before To date.");

        var days = (toInclusive - from).TotalDays + 1;
        if (days > SellerFinanceConstants.MaxReportDays)
            throw new AppException($"Date range must not exceed {SellerFinanceConstants.MaxReportDays} days.");

        from = DateTime.SpecifyKind(from, DateTimeKind.Utc);
        toInclusive = DateTime.SpecifyKind(toInclusive, DateTimeKind.Utc);
        var toExclusive = toInclusive.AddDays(1);

        return (from, toInclusive, toExclusive, granularity);
    }

    private static IReadOnlyList<SellerSalesReportPeriodDto> BuildSeries(
        DateTime from,
        DateTime toInclusive,
        string granularity,
        IReadOnlyList<SellerFinanceSalesOrder> orders,
        IReadOnlyList<SellerFinanceSalesLine> lines)
    {
        var buckets = EnumerateBuckets(from, toInclusive, granularity).ToList();
        var ordersByBucket = orders
            .GroupBy(o => BucketStart(o.PaidAt, granularity))
            .ToDictionary(g => g.Key, g => g.ToList());
        var linesByBucket = lines
            .GroupBy(l => BucketStart(l.PaidAt, granularity))
            .ToDictionary(g => g.Key, g => g.ToList());

        return buckets.Select(bucket =>
        {
            var lookupKey = BucketStart(bucket.Start, granularity);
            ordersByBucket.TryGetValue(lookupKey, out var bucketOrders);
            linesByBucket.TryGetValue(lookupKey, out var bucketLines);
            bucketOrders ??= [];
            bucketLines ??= [];

            var orderRevenue = RoundMoney(bucketOrders.Sum(o => o.TotalAmount));
            var productRevenue = RoundMoney(bucketLines.Sum(l => l.LineTotal));
            var cogs = RoundMoney(bucketLines.Sum(l => l.Cogs));
            var margin = RoundMoney(productRevenue - cogs);

            return new SellerSalesReportPeriodDto
            {
                PeriodKey = bucket.Key,
                PeriodStart = bucket.Start,
                PeriodEnd = bucket.EndInclusive,
                OrderCount = bucketOrders.Count,
                UnitsSold = bucketLines.Sum(l => l.Quantity),
                OrderRevenue = orderRevenue,
                ProductRevenue = productRevenue,
                Cogs = cogs,
                GrossMargin = margin,
                GrossMarginPercent = Percent(margin, productRevenue)
            };
        }).ToList();
    }

    private static IReadOnlyList<SellerSalesReportProductDto> BuildTopProducts(
        IReadOnlyList<SellerFinanceSalesLine> lines)
    {
        return lines
            .GroupBy(l => l.ProductId)
            .Select(g =>
            {
                var productRevenue = RoundMoney(g.Sum(l => l.LineTotal));
                var cogs = RoundMoney(g.Sum(l => l.Cogs));
                var margin = RoundMoney(productRevenue - cogs);
                var name = g.OrderByDescending(l => l.PaidAt).First().ProductName;

                return new SellerSalesReportProductDto
                {
                    ProductId = g.Key,
                    ProductName = name,
                    UnitsSold = g.Sum(l => l.Quantity),
                    ProductRevenue = productRevenue,
                    Cogs = cogs,
                    GrossMargin = margin,
                    GrossMarginPercent = Percent(margin, productRevenue)
                };
            })
            .OrderByDescending(p => p.ProductRevenue)
            .ThenByDescending(p => p.UnitsSold)
            .Take(SellerFinanceConstants.TopProductLimit)
            .ToList();
    }

    private static IEnumerable<(string Key, DateTime Start, DateTime EndInclusive)> EnumerateBuckets(
        DateTime from,
        DateTime toInclusive,
        string granularity)
    {
        if (granularity == SellerFinanceConstants.GranularityMonth)
        {
            var cursor = new DateTime(from.Year, from.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var last = new DateTime(toInclusive.Year, toInclusive.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            while (cursor <= last)
            {
                var end = cursor.AddMonths(1).AddDays(-1);
                if (end > toInclusive)
                    end = toInclusive;
                var start = cursor < from ? from : cursor;
                yield return ($"{cursor:yyyy-MM}", start, end);
                cursor = cursor.AddMonths(1);
            }

            yield break;
        }

        if (granularity == SellerFinanceConstants.GranularityWeek)
        {
            var cursor = StartOfIsoWeek(from);
            while (cursor <= toInclusive)
            {
                var end = cursor.AddDays(6);
                if (end > toInclusive)
                    end = toInclusive;
                var start = cursor < from ? from : cursor;
                var week = ISOWeek.GetWeekOfYear(cursor);
                yield return ($"{ISOWeek.GetYear(cursor):D4}-W{week:D2}", start, end);
                cursor = cursor.AddDays(7);
            }

            yield break;
        }

        for (var cursor = from; cursor <= toInclusive; cursor = cursor.AddDays(1))
        {
            yield return ($"{cursor:yyyy-MM-dd}", cursor, cursor);
        }
    }

    private static DateTime BucketStart(DateTime paidAt, string granularity)
    {
        var date = DateTime.SpecifyKind(paidAt.Date, DateTimeKind.Utc);
        if (granularity == SellerFinanceConstants.GranularityMonth)
            return new DateTime(date.Year, date.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        if (granularity == SellerFinanceConstants.GranularityWeek)
            return StartOfIsoWeek(date);
        return date;
    }

    private static DateTime StartOfIsoWeek(DateTime date)
    {
        var diff = ((int)date.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        return DateTime.SpecifyKind(date.AddDays(-diff).Date, DateTimeKind.Utc);
    }

    private static decimal RoundMoney(decimal value)
        => decimal.Round(value, 2, MidpointRounding.AwayFromZero);

    private static decimal Percent(decimal numerator, decimal denominator)
    {
        if (denominator == 0m)
            return 0m;
        return decimal.Round(numerator / denominator * 100m, 2, MidpointRounding.AwayFromZero);
    }
}
