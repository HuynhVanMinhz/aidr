using System.Globalization;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Admin.Services;

public sealed class AdminCustomerInsightService : IAdminCustomerInsightService
{
    private readonly IAdminCustomerInsightRepository _repository;

    public AdminCustomerInsightService(IAdminCustomerInsightRepository repository) =>
        _repository = repository;

    public async Task<AdminCustomerInsightsDto> GetCustomerInsightsAsync(
        AdminCustomerInsightsQueryRequest request,
        CancellationToken cancellationToken = default)
    {
        var (from, toInclusive, toExclusive, granularity) = NormalizeRange(request);

        var snapshot = await _repository.GetPlatformSnapshotAsync(cancellationToken);
        var registrations = await _repository.GetRegistrationsAsync(from, toExclusive, cancellationToken);
        var (orders, lines) = await _repository.GetSalesAsync(from, toExclusive, cancellationToken);

        var buyerIds = orders.Select(o => o.BuyerUserId).Distinct().ToList();
        var firstPaid = buyerIds.Count == 0
            ? Array.Empty<AdminInsightBuyerFirstPaidOrder>()
            : await _repository.GetBuyerFirstPaidOrdersAsync(buyerIds, cancellationToken);

        var firstPaidByBuyer = firstPaid.ToDictionary(x => x.BuyerUserId, x => x.FirstPaidAt);
        var newBuyers = 0;
        var returningBuyers = 0;
        foreach (var buyerId in buyerIds)
        {
            if (!firstPaidByBuyer.TryGetValue(buyerId, out var firstAt))
                continue;

            if (firstAt >= from && firstAt < toExclusive)
                newBuyers++;
            else
                returningBuyers++;
        }

        var gmv = RoundMoney(orders.Sum(o => o.TotalAmount));
        var unitsSold = lines.Sum(l => l.Quantity);

        return new AdminCustomerInsightsDto
        {
            Currency = AdminConstants.WalletCurrencyVnd,
            Granularity = granularity,
            From = from,
            To = toInclusive,
            Summary = new AdminCustomerInsightSummaryDto
            {
                TotalUsers = snapshot.TotalUsers,
                ActiveUsers = snapshot.ActiveUsers,
                LockedUsers = snapshot.LockedUsers,
                NewUsersInPeriod = registrations.Count,
                BuyersWithOrdersInPeriod = buyerIds.Count,
                OrderCountInPeriod = orders.Count,
                UnitsSoldInPeriod = unitsSold,
                GmvInPeriod = gmv
            },
            Cohort = new AdminCustomerInsightCohortDto
            {
                NewBuyersInPeriod = newBuyers,
                ReturningBuyersInPeriod = returningBuyers
            },
            RegistrationSeries = BuildRegistrationSeries(from, toInclusive, granularity, registrations),
            OrderSeries = BuildOrderSeries(from, toInclusive, granularity, orders, lines),
            TopProducts = BuildTopProducts(lines),
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static (DateTime From, DateTime ToInclusive, DateTime ToExclusive, string Granularity)
        NormalizeRange(AdminCustomerInsightsQueryRequest request)
    {
        var granularity = string.IsNullOrWhiteSpace(request.Granularity)
            ? AdminConstants.InsightGranularityDay
            : request.Granularity.Trim().ToLowerInvariant();

        if (!AdminConstants.AllowedInsightGranularities.Contains(granularity))
            throw new AppException("Granularity must be day, week, or month.");

        var today = DateTime.UtcNow.Date;
        var toInclusive = request.To.HasValue ? request.To.Value.Date : today;
        var from = request.From.HasValue
            ? request.From.Value.Date
            : toInclusive.AddDays(1 - AdminConstants.DefaultInsightDays);

        if (from > toInclusive)
            throw new AppException("From date must be on or before To date.");

        var days = (toInclusive - from).TotalDays + 1;
        if (days > AdminConstants.MaxInsightDays)
            throw new AppException($"Date range must not exceed {AdminConstants.MaxInsightDays} days.");

        from = DateTime.SpecifyKind(from, DateTimeKind.Utc);
        toInclusive = DateTime.SpecifyKind(toInclusive, DateTimeKind.Utc);
        var toExclusive = toInclusive.AddDays(1);

        return (from, toInclusive, toExclusive, granularity);
    }

    private static IReadOnlyList<AdminCustomerInsightPeriodDto> BuildRegistrationSeries(
        DateTime from,
        DateTime toInclusive,
        string granularity,
        IReadOnlyList<AdminInsightUserRegistration> registrations)
    {
        var buckets = EnumerateBuckets(from, toInclusive, granularity).ToList();
        var byBucket = registrations
            .GroupBy(r => BucketStart(r.CreatedAt, granularity))
            .ToDictionary(g => g.Key, g => g.Count());

        return buckets.Select(bucket =>
        {
            byBucket.TryGetValue(BucketStart(bucket.Start, granularity), out var count);
            return new AdminCustomerInsightPeriodDto
            {
                PeriodKey = bucket.Key,
                PeriodStart = bucket.Start,
                PeriodEnd = bucket.EndInclusive,
                NewUserCount = count,
                OrderCount = 0,
                UnitsSold = 0,
                Gmv = 0m
            };
        }).ToList();
    }

    private static IReadOnlyList<AdminCustomerInsightPeriodDto> BuildOrderSeries(
        DateTime from,
        DateTime toInclusive,
        string granularity,
        IReadOnlyList<AdminInsightSalesOrder> orders,
        IReadOnlyList<AdminInsightSalesLine> lines)
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
            var key = BucketStart(bucket.Start, granularity);
            ordersByBucket.TryGetValue(key, out var bucketOrders);
            linesByBucket.TryGetValue(key, out var bucketLines);
            bucketOrders ??= [];
            bucketLines ??= [];

            return new AdminCustomerInsightPeriodDto
            {
                PeriodKey = bucket.Key,
                PeriodStart = bucket.Start,
                PeriodEnd = bucket.EndInclusive,
                NewUserCount = 0,
                OrderCount = bucketOrders.Count,
                UnitsSold = bucketLines.Sum(l => l.Quantity),
                Gmv = RoundMoney(bucketOrders.Sum(o => o.TotalAmount))
            };
        }).ToList();
    }

    private static IReadOnlyList<AdminCustomerInsightTopProductDto> BuildTopProducts(
        IReadOnlyList<AdminInsightSalesLine> lines)
    {
        return lines
            .GroupBy(l => l.ProductId)
            .Select(g =>
            {
                var name = g.OrderByDescending(l => l.PaidAt).First().ProductName;
                return new AdminCustomerInsightTopProductDto
                {
                    ProductId = g.Key,
                    ProductName = name,
                    UnitsSold = g.Sum(l => l.Quantity),
                    Revenue = RoundMoney(g.Sum(l => l.LineTotal)),
                    OrderCount = g.Select(l => l.OrderId).Distinct().Count()
                };
            })
            .OrderByDescending(p => p.Revenue)
            .ThenByDescending(p => p.UnitsSold)
            .Take(AdminConstants.TopProductLimit)
            .ToList();
    }

    private static IEnumerable<(string Key, DateTime Start, DateTime EndInclusive)> EnumerateBuckets(
        DateTime from,
        DateTime toInclusive,
        string granularity)
    {
        if (granularity == AdminConstants.InsightGranularityMonth)
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

        if (granularity == AdminConstants.InsightGranularityWeek)
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
            yield return ($"{cursor:yyyy-MM-dd}", cursor, cursor);
    }

    private static DateTime BucketStart(DateTime value, string granularity)
    {
        var date = DateTime.SpecifyKind(value.Date, DateTimeKind.Utc);
        if (granularity == AdminConstants.InsightGranularityMonth)
            return new DateTime(date.Year, date.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        if (granularity == AdminConstants.InsightGranularityWeek)
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
}
