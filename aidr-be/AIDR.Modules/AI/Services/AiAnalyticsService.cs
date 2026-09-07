using System.Globalization;
using System.Text;
using System.Text.Json;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Modules.AI.Abstractions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;

namespace AIDR.Modules.AI.Services;

public sealed class AiAnalyticsService : IAiAnalyticsService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly ILlmClient _llm;
    private readonly IAdminCustomerInsightRepository _adminInsights;
    private readonly IAdminDashboardRepository _adminDashboard;
    private readonly ISellerFinanceRepository _sellerFinance;
    private readonly ISellerProductRepository _sellerProducts;
    private readonly ILogger<AiAnalyticsService> _logger;

    public AiAnalyticsService(
        ILlmClient llm,
        IAdminCustomerInsightRepository adminInsights,
        IAdminDashboardRepository adminDashboard,
        ISellerFinanceRepository sellerFinance,
        ISellerProductRepository sellerProducts,
        ILogger<AiAnalyticsService> logger)
    {
        _llm = llm;
        _adminInsights = adminInsights;
        _adminDashboard = adminDashboard;
        _sellerFinance = sellerFinance;
        _sellerProducts = sellerProducts;
        _logger = logger;
    }

    public async Task<AiAnalyticsBriefDto> GetAdminBriefAsync(
        AiAnalyticsBriefQueryRequest request,
        CancellationToken cancellationToken = default)
    {
        var question = NormalizeQuestion(request.Question);
        var (from, toInclusive, toExclusive) = NormalizeRange(request);
        var periodDays = Math.Max(1, (int)(toExclusive - from).TotalDays);
        var priorFrom = from.AddDays(-periodDays);
        var priorToExclusive = from;

        var dashboard = await _adminDashboard.GetKpisAsync(cancellationToken);
        var snapshot = await _adminInsights.GetPlatformSnapshotAsync(cancellationToken);
        var registrations = await _adminInsights.GetRegistrationsAsync(from, toExclusive, cancellationToken);
        var (orders, lines) = await _adminInsights.GetSalesAsync(from, toExclusive, cancellationToken);
        var (priorOrders, _) = await _adminInsights.GetSalesAsync(priorFrom, priorToExclusive, cancellationToken);

        var buyerIds = orders.Select(o => o.BuyerUserId).Distinct().ToList();
        var firstPaid = buyerIds.Count == 0
            ? Array.Empty<AdminInsightBuyerFirstPaidOrder>()
            : await _adminInsights.GetBuyerFirstPaidOrdersAsync(buyerIds, cancellationToken);
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
        var priorGmv = RoundMoney(priorOrders.Sum(o => o.TotalAmount));
        var unitsSold = lines.Sum(l => l.Quantity);
        var topProducts = BuildTopProductNames(lines, 5);

        var metrics = new AdminMetricsContext(
            from,
            toInclusive,
            snapshot.TotalUsers,
            snapshot.ActiveUsers,
            registrations.Count,
            orders.Count,
            priorOrders.Count,
            gmv,
            priorGmv,
            unitsSold,
            buyerIds.Count,
            newBuyers,
            returningBuyers,
            dashboard.PendingProducts,
            dashboard.PendingReturns,
            dashboard.PendingSellerRegistrations,
            dashboard.ActiveShops,
            topProducts,
            question);

        return await BuildBriefAsync(
            AiConstants.AudienceAdmin,
            metrics,
            BuildAdminHeuristic,
            BuildAdminPrompt,
            cancellationToken);
    }

    public async Task<AiAnalyticsBriefDto> GetSellerBriefAsync(
        Guid ownerUserId,
        AiAnalyticsBriefQueryRequest request,
        CancellationToken cancellationToken = default)
    {
        if (ownerUserId == Guid.Empty)
            throw new AppException("Seller user id is required.");

        var shop = await _sellerProducts.GetActiveShopByOwnerAsync(ownerUserId, cancellationToken)
            ?? throw new AppException("Active shop not found for this seller.");

        var question = NormalizeQuestion(request.Question);
        var (from, toInclusive, toExclusive) = NormalizeRange(request);
        var periodDays = Math.Max(1, (int)(toExclusive - from).TotalDays);
        var priorFrom = from.AddDays(-periodDays);
        var priorToExclusive = from;

        var dashboard = await _sellerFinance.GetDashboardAsync(shop.ShopId, cancellationToken);
        var (orders, lines) = await _sellerFinance.GetSalesAsync(
            shop.ShopId,
            from,
            toExclusive,
            cancellationToken);
        var (priorOrders, priorLines) = await _sellerFinance.GetSalesAsync(
            shop.ShopId,
            priorFrom,
            priorToExclusive,
            cancellationToken);

        var productRevenue = RoundMoney(lines.Sum(l => l.LineTotal));
        var priorProductRevenue = RoundMoney(priorLines.Sum(l => l.LineTotal));
        var cogs = RoundMoney(lines.Sum(l => l.Cogs));
        var margin = RoundMoney(productRevenue - cogs);
        var topProducts = BuildSellerTopProductNames(lines, 5);
        var lowStockNames = dashboard.LowStockItems
            .Take(5)
            .Select(i => i.Name)
            .ToList();

        var metrics = new SellerMetricsContext(
            from,
            toInclusive,
            dashboard.Orders.AwaitingFulfillmentCount,
            dashboard.Orders.ShippingCount,
            dashboard.Orders.ReturnRequestedCount,
            dashboard.Revenue.Today,
            dashboard.Revenue.ThisMonth,
            dashboard.Wallet.AvailableBalance,
            dashboard.Wallet.PendingBalance,
            dashboard.Catalog.LowStockCount,
            dashboard.Catalog.PendingProductCount,
            orders.Count,
            productRevenue,
            priorProductRevenue,
            margin,
            Percent(margin, productRevenue),
            lines.Sum(l => l.Quantity),
            topProducts,
            lowStockNames,
            question);

        return await BuildBriefAsync(
            AiConstants.AudienceSeller,
            metrics,
            BuildSellerHeuristic,
            BuildSellerPrompt,
            cancellationToken);
    }

    private async Task<AiAnalyticsBriefDto> BuildBriefAsync<T>(
        string audience,
        T metrics,
        Func<T, AiAnalyticsBriefDto> heuristicFactory,
        Func<T, (string System, string User)> promptFactory,
        CancellationToken cancellationToken)
        where T : IMetricsContext
    {
        var heuristic = heuristicFactory(metrics);
        var period = new AiAnalyticsPeriodDto { From = metrics.From, To = metrics.ToInclusive };

        if (_llm.UseMock)
        {
            return WithPeriod(heuristic, audience, period, AiConstants.SourceHeuristic);
        }

        var (systemPrompt, userPrompt) = promptFactory(metrics);
        var raw = await _llm.ChatAsync(systemPrompt, userPrompt, jsonFormat: true, cancellationToken);
        if (string.IsNullOrWhiteSpace(raw))
        {
            _logger.LogInformation("Analytics brief falling back to heuristic (no Groq response).");
            return WithPeriod(heuristic, audience, period, AiConstants.SourceHeuristic);
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<LlmAnalyticsBriefPayload>(raw, JsonOptions);
            if (parsed is null || string.IsNullOrWhiteSpace(parsed.Headline))
                throw new JsonException("Missing headline.");

            return new AiAnalyticsBriefDto
            {
                Audience = audience,
                Period = period,
                Headline = parsed.Headline.Trim(),
                Summary = (parsed.Summary ?? heuristic.Summary).Trim(),
                Kpis = heuristic.Kpis,
                InsightMetrics = heuristic.InsightMetrics,
                Insights = NormalizeStringList(parsed.Insights, heuristic.Insights, 4),
                ActionRecommendations = heuristic.ActionRecommendations,
                Alerts = NormalizeAlerts(parsed.Alerts, heuristic.Alerts),
                Answer = string.IsNullOrWhiteSpace(parsed.Answer) ? heuristic.Answer : parsed.Answer.Trim(),
                Source = AiConstants.SourceGroq,
                GeneratedAt = DateTime.UtcNow
            };
        }
        catch (Exception ex) when (ex is JsonException or NotSupportedException)
        {
            _logger.LogWarning(ex, "Analytics brief JSON parse failed; using heuristic.");
            return WithPeriod(heuristic, audience, period, AiConstants.SourceHeuristic);
        }
    }

    private static AiAnalyticsBriefDto WithPeriod(
        AiAnalyticsBriefDto dto,
        string audience,
        AiAnalyticsPeriodDto period,
        string source) =>
        new()
        {
            Audience = audience,
            Period = period,
            Headline = dto.Headline,
            Summary = dto.Summary,
            Kpis = dto.Kpis,
            InsightMetrics = dto.InsightMetrics,
            Insights = dto.Insights,
            ActionRecommendations = dto.ActionRecommendations,
            Alerts = dto.Alerts,
            Answer = dto.Answer,
            Source = source,
            GeneratedAt = DateTime.UtcNow
        };

    private static AiAnalyticsBriefDto BuildAdminHeuristic(AdminMetricsContext m)
    {
        var gmvChange = PercentChange(m.Gmv, m.PriorGmv);
        var insights = new List<string>();
        var alerts = new List<AiAnalyticsAlertDto>();
        var actions = new List<AiAnalyticsRecommendationDto>();

        if (m.TopProducts.Count > 0)
            insights.Add($"Top seller: {m.TopProducts[0]}.");

        if (m.PendingProducts >= 10)
        {
            alerts.Add(new AiAnalyticsAlertDto
            {
                Severity = AiConstants.AlertSeverityWarning,
                Message = $"{m.PendingProducts} products in moderation queue"
            });
            actions.Add(new AiAnalyticsRecommendationDto
            {
                Text = "Clear the product moderation backlog.",
                ActionLabel = "Review products",
                ActionHref = "/admin/products"
            });
        }

        if (m.PendingReturns >= 5)
        {
            alerts.Add(new AiAnalyticsAlertDto
            {
                Severity = AiConstants.AlertSeverityDanger,
                Message = $"{m.PendingReturns} return requests pending"
            });
            actions.Add(new AiAnalyticsRecommendationDto
            {
                Text = "Process returns to protect buyer trust.",
                ActionLabel = "Review returns",
                ActionHref = "/admin/return-requests"
            });
        }

        if (m.PendingSellerRegistrations > 0)
        {
            alerts.Add(new AiAnalyticsAlertDto
            {
                Severity = AiConstants.AlertSeverityInfo,
                Message = $"{m.PendingSellerRegistrations} seller applications pending"
            });
            actions.Add(new AiAnalyticsRecommendationDto
            {
                Text = "Onboard qualified sellers to expand catalog supply.",
                ActionLabel = "Review applications",
                ActionHref = "/admin/seller-registrations"
            });
        }

        if (gmvChange < -10 && actions.Count < 3)
        {
            actions.Add(new AiAnalyticsRecommendationDto
            {
                Text = "GMV declined versus the prior period — review traffic and conversion.",
                ActionLabel = "View insights",
                ActionHref = "/admin/insights"
            });
        }

        if (actions.Count == 0)
        {
            actions.Add(new AiAnalyticsRecommendationDto
            {
                Text = "Monitor buyer cohort mix and queue backlogs weekly.",
                ActionLabel = "Open insights",
                ActionHref = "/admin/insights"
            });
        }

        var headline = gmvChange >= 5
            ? "Platform sales are trending up"
            : gmvChange <= -5
                ? "Platform sales need attention"
                : "Platform metrics are steady";

        var summary =
            $"{FormatVnd(m.Gmv)} GMV from {m.UnitsSold} units · {m.ActiveUsers} active users · {m.ActiveShops} shops live.";

        return new AiAnalyticsBriefDto
        {
            Headline = headline,
            Summary = summary,
            Kpis =
            [
                new AiAnalyticsKpiDto
                {
                    Label = "GMV",
                    Value = FormatVnd(m.Gmv),
                    ChangePercent = gmvChange,
                    Subtext = "vs prior period"
                },
                new AiAnalyticsKpiDto
                {
                    Label = "Orders",
                    Value = m.OrderCount.ToString(CultureInfo.InvariantCulture),
                    ChangePercent = PercentChange(m.OrderCount, m.PriorOrderCount),
                    Subtext = $"{m.UnitsSold} units sold"
                },
                new AiAnalyticsKpiDto
                {
                    Label = "New users",
                    Value = m.NewUsersInPeriod.ToString(CultureInfo.InvariantCulture),
                    Subtext = "Registrations"
                },
                new AiAnalyticsKpiDto
                {
                    Label = "Buyers",
                    Value = m.BuyersWithOrders.ToString(CultureInfo.InvariantCulture),
                    Subtext = $"{m.NewBuyers} new · {m.ReturningBuyers} returning"
                }
            ],
            InsightMetrics =
            [
                new AiAnalyticsInsightMetricDto
                {
                    Label = "GMV trend",
                    Value = FormatSignedPercent(gmvChange),
                    ChangePercent = gmvChange
                },
                new AiAnalyticsInsightMetricDto
                {
                    Label = "Units sold",
                    Value = m.UnitsSold.ToString(CultureInfo.InvariantCulture)
                },
                new AiAnalyticsInsightMetricDto
                {
                    Label = "Moderation queue",
                    Value = m.PendingProducts.ToString(CultureInfo.InvariantCulture)
                },
                new AiAnalyticsInsightMetricDto
                {
                    Label = "Return queue",
                    Value = m.PendingReturns.ToString(CultureInfo.InvariantCulture)
                },
                new AiAnalyticsInsightMetricDto
                {
                    Label = "Seller applications",
                    Value = m.PendingSellerRegistrations.ToString(CultureInfo.InvariantCulture)
                }
            ],
            Insights = insights,
            ActionRecommendations = actions,
            Alerts = alerts,
            Answer = BuildAdminQuestionAnswer(m),
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static AiAnalyticsBriefDto BuildSellerHeuristic(SellerMetricsContext m)
    {
        var revenueChange = PercentChange(m.ProductRevenue, m.PriorProductRevenue);
        var insights = new List<string>();
        var alerts = new List<AiAnalyticsAlertDto>();
        var actions = new List<AiAnalyticsRecommendationDto>();

        if (m.TopProducts.Count > 0)
            insights.Add($"Best performer: {m.TopProducts[0]}.");

        if (m.AwaitingFulfillmentCount > 0)
        {
            alerts.Add(new AiAnalyticsAlertDto
            {
                Severity = AiConstants.AlertSeverityWarning,
                Message = $"{m.AwaitingFulfillmentCount} orders await fulfillment"
            });
            actions.Add(new AiAnalyticsRecommendationDto
            {
                Text = "Ship pending orders to avoid cancellations.",
                ActionLabel = "Ship now",
                ActionHref = "/seller/orders"
            });
        }

        if (m.LowStockCount > 0)
        {
            alerts.Add(new AiAnalyticsAlertDto
            {
                Severity = AiConstants.AlertSeverityDanger,
                Message = $"{m.LowStockCount} SKUs at or below low-stock threshold"
            });
            actions.Add(new AiAnalyticsRecommendationDto
            {
                Text = m.LowStockProductNames.Count > 0
                    ? $"Restock: {string.Join(", ", m.LowStockProductNames.Take(3))}."
                    : "Review inventory and restock low-quantity SKUs.",
                ActionLabel = "Restock",
                ActionHref = "/seller/inventory"
            });
        }

        if (m.ReturnRequestedCount > 0)
        {
            alerts.Add(new AiAnalyticsAlertDto
            {
                Severity = AiConstants.AlertSeverityWarning,
                Message = $"{m.ReturnRequestedCount} open return requests"
            });
            actions.Add(new AiAnalyticsRecommendationDto
            {
                Text = "Follow up on returns to protect shop rating.",
                ActionLabel = "Review returns",
                ActionHref = "/seller/orders"
            });
        }

        if (m.PendingProductCount > 0)
        {
            alerts.Add(new AiAnalyticsAlertDto
            {
                Severity = AiConstants.AlertSeverityInfo,
                Message = $"{m.PendingProductCount} products pending approval"
            });
        }

        if (revenueChange < -10 && actions.Count < 3)
        {
            actions.Add(new AiAnalyticsRecommendationDto
            {
                Text = "Revenue dipped — consider a shop voucher or bundle.",
                ActionLabel = "Manage vouchers",
                ActionHref = "/seller/vouchers"
            });
        }

        if (actions.Count == 0)
        {
            actions.Add(new AiAnalyticsRecommendationDto
            {
                Text = "Focus promotion on top SKUs with healthy margin.",
                ActionLabel = "View reports",
                ActionHref = "/seller/reports"
            });
        }

        var headline = revenueChange >= 5
            ? "Shop revenue is gaining momentum"
            : revenueChange <= -5
                ? "Shop revenue dipped this period"
                : "Shop performance is stable";

        var summary =
            $"{FormatVnd(m.ProductRevenue)} revenue · {FormatVnd(m.GrossMargin)} margin · {FormatVnd(m.AvailableBalance)} wallet available.";

        return new AiAnalyticsBriefDto
        {
            Headline = headline,
            Summary = summary,
            Kpis =
            [
                new AiAnalyticsKpiDto
                {
                    Label = "Revenue",
                    Value = FormatVnd(m.ProductRevenue),
                    ChangePercent = revenueChange,
                    Subtext = "vs prior period"
                },
                new AiAnalyticsKpiDto
                {
                    Label = "Gross margin",
                    Value = FormatVnd(m.GrossMargin),
                    Subtext = FormatPercent(m.GrossMarginPercent) + " of revenue"
                },
                new AiAnalyticsKpiDto
                {
                    Label = "Orders",
                    Value = m.OrderCount.ToString(CultureInfo.InvariantCulture),
                    Subtext = $"{m.UnitsSold} units sold"
                },
                new AiAnalyticsKpiDto
                {
                    Label = "Fulfillment",
                    Value = m.AwaitingFulfillmentCount.ToString(CultureInfo.InvariantCulture),
                    Subtext = "Awaiting shipment"
                }
            ],
            InsightMetrics =
            [
                new AiAnalyticsInsightMetricDto
                {
                    Label = "Revenue trend",
                    Value = FormatSignedPercent(revenueChange),
                    ChangePercent = revenueChange
                },
                new AiAnalyticsInsightMetricDto
                {
                    Label = "Margin rate",
                    Value = FormatPercent(m.GrossMarginPercent)
                },
                new AiAnalyticsInsightMetricDto
                {
                    Label = "Low stock SKUs",
                    Value = m.LowStockCount.ToString(CultureInfo.InvariantCulture)
                },
                new AiAnalyticsInsightMetricDto
                {
                    Label = "Pending settlement",
                    Value = FormatVnd(m.PendingBalance)
                }
            ],
            Insights = insights,
            ActionRecommendations = actions,
            Alerts = alerts,
            Answer = BuildSellerQuestionAnswer(m),
            GeneratedAt = DateTime.UtcNow
        };
    }

    private static (string System, string User) BuildAdminPrompt(AdminMetricsContext m)
    {
        var system =
            """
            You are a marketplace operations analyst for AIDR admin dashboard.
            Given JSON metrics, write a concise English analytics brief for platform operators.
            Return ONLY JSON:
            {
              "headline": string,
              "summary": string,
              "insights": string[],
              "recommendations": string[],
              "alerts": [{ "severity": "info"|"warning"|"danger", "message": string }],
              "answer": string | null
            }
            Use 2-4 insights and 2-3 recommendations. Be factual; do not invent numbers.
            Format VND like 3.690.000 ₫. If a user question is provided, answer it in "answer" using only the metrics.
            """;
        var user = BuildMetricsJson(m);
        return (system, user);
    }

    private static (string System, string User) BuildSellerPrompt(SellerMetricsContext m)
    {
        var system =
            """
            You are a retail analyst for an AIDR seller shop dashboard.
            Given JSON metrics, write a concise English analytics brief for the shop owner.
            Return ONLY JSON:
            {
              "headline": string,
              "summary": string,
              "insights": string[],
              "recommendations": string[],
              "alerts": [{ "severity": "info"|"warning"|"danger", "message": string }],
              "answer": string | null
            }
            Use 2-4 insights and 2-3 actionable recommendations. Be factual; do not invent numbers.
            Format VND like 3.690.000 ₫. If a user question is provided, answer it in "answer" using only the metrics.
            """;
        var user = BuildMetricsJson(m);
        return (system, user);
    }

    private static string BuildMetricsJson<T>(T metrics) =>
        JsonSerializer.Serialize(metrics, new JsonSerializerOptions { WriteIndented = true });

    private static string? BuildAdminQuestionAnswer(AdminMetricsContext m)
    {
        if (string.IsNullOrWhiteSpace(m.Question))
            return null;

        var q = m.Question.ToLowerInvariant();
        if (q.Contains("gmv") || q.Contains("revenue") || q.Contains("sales"))
            return $"GMV in this period is {FormatVnd(m.Gmv)} from {m.OrderCount} orders ({FormatSignedPercent(PercentChange(m.Gmv, m.PriorGmv))} vs the prior period).";
        if (q.Contains("user") || q.Contains("buyer") || q.Contains("customer"))
            return $"{m.NewUsersInPeriod} users registered; {m.BuyersWithOrders} buyers placed orders ({m.NewBuyers} new, {m.ReturningBuyers} returning).";
        if (q.Contains("queue") || q.Contains("pending") || q.Contains("moderation"))
            return $"Queues: {m.PendingProducts} products, {m.PendingReturns} returns, {m.PendingSellerRegistrations} seller applications pending.";
        return
            $"In this period GMV is {FormatVnd(m.Gmv)} with {m.OrderCount} orders. Active users: {m.ActiveUsers}; pending moderation items: {m.PendingProducts}.";
    }

    private static string? BuildSellerQuestionAnswer(SellerMetricsContext m)
    {
        if (string.IsNullOrWhiteSpace(m.Question))
            return null;

        var q = m.Question.ToLowerInvariant();
        if (q.Contains("margin") || q.Contains("profit"))
            return $"Gross margin is {FormatVnd(m.GrossMargin)} ({FormatPercent(m.GrossMarginPercent)} of {FormatVnd(m.ProductRevenue)} product revenue).";
        if (q.Contains("stock") || q.Contains("inventory"))
            return $"{m.LowStockCount} SKUs are low on stock. Top items to restock: {(m.LowStockProductNames.Count > 0 ? string.Join(", ", m.LowStockProductNames) : "review the inventory list")}.";
        if (q.Contains("order") || q.Contains("fulfill"))
            return $"{m.AwaitingFulfillmentCount} orders await fulfillment; {m.OrderCount} paid orders in the selected period.";
        return
            $"Period revenue {FormatVnd(m.ProductRevenue)} with {FormatVnd(m.GrossMargin)} margin. {m.AwaitingFulfillmentCount} orders need shipping.";
    }

    private static IReadOnlyList<string> BuildTopProductNames(
        IReadOnlyList<AdminInsightSalesLine> lines,
        int take)
    {
        return lines
            .GroupBy(l => l.ProductName)
            .Select(g => new { Name = g.Key, Revenue = g.Sum(x => x.LineTotal) })
            .OrderByDescending(x => x.Revenue)
            .Take(take)
            .Select(x => x.Name)
            .ToList();
    }

    private static IReadOnlyList<string> BuildSellerTopProductNames(
        IReadOnlyList<SellerFinanceSalesLine> lines,
        int take)
    {
        return lines
            .GroupBy(l => l.ProductName)
            .Select(g => new { Name = g.Key, Revenue = g.Sum(x => x.LineTotal) })
            .OrderByDescending(x => x.Revenue)
            .Take(take)
            .Select(x => x.Name)
            .ToList();
    }

    private static IReadOnlyList<string> NormalizeStringList(
        IReadOnlyList<string>? primary,
        IReadOnlyList<string> fallback,
        int max)
    {
        var items = (primary ?? Array.Empty<string>())
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s.Trim())
            .Take(max)
            .ToList();
        return items.Count > 0 ? items : fallback.Take(max).ToList();
    }

    private static IReadOnlyList<AiAnalyticsAlertDto> NormalizeAlerts(
        IReadOnlyList<LlmAnalyticsAlertPayload>? alerts,
        IReadOnlyList<AiAnalyticsAlertDto> fallback)
    {
        if (alerts is null || alerts.Count == 0)
            return fallback;

        var normalized = alerts
            .Where(a => !string.IsNullOrWhiteSpace(a.Message))
            .Select(a => new AiAnalyticsAlertDto
            {
                Severity = NormalizeSeverity(a.Severity),
                Message = a.Message.Trim()
            })
            .Take(5)
            .ToList();

        return normalized.Count > 0 ? normalized : fallback;
    }

    private static string NormalizeSeverity(string? severity)
    {
        if (string.Equals(severity, AiConstants.AlertSeverityDanger, StringComparison.OrdinalIgnoreCase))
            return AiConstants.AlertSeverityDanger;
        if (string.Equals(severity, AiConstants.AlertSeverityWarning, StringComparison.OrdinalIgnoreCase))
            return AiConstants.AlertSeverityWarning;
        return AiConstants.AlertSeverityInfo;
    }

    private static string? NormalizeQuestion(string? question)
    {
        if (string.IsNullOrWhiteSpace(question))
            return null;

        var trimmed = question.Trim();
        if (trimmed.Length < AiConstants.MinAnalyticsQuestionLength)
            throw new AppException($"Question must be at least {AiConstants.MinAnalyticsQuestionLength} characters.");
        if (trimmed.Length > AiConstants.MaxAnalyticsQuestionLength)
            throw new AppException($"Question must not exceed {AiConstants.MaxAnalyticsQuestionLength} characters.");

        return trimmed;
    }

    private static (DateTime From, DateTime ToInclusive, DateTime ToExclusive) NormalizeRange(
        AiAnalyticsBriefQueryRequest request)
    {
        var today = DateTime.UtcNow.Date;
        var toInclusive = request.To.HasValue ? request.To.Value.Date : today;
        var from = request.From.HasValue
            ? request.From.Value.Date
            : toInclusive.AddDays(1 - AiConstants.DefaultAnalyticsDays);

        if (from > toInclusive)
            throw new AppException("From date must be on or before To date.");

        var days = (toInclusive - from).TotalDays + 1;
        if (days > AiConstants.MaxAnalyticsDays)
            throw new AppException($"Date range must not exceed {AiConstants.MaxAnalyticsDays} days.");

        from = DateTime.SpecifyKind(from, DateTimeKind.Utc);
        toInclusive = DateTime.SpecifyKind(toInclusive, DateTimeKind.Utc);
        var toExclusive = toInclusive.AddDays(1);
        return (from, toInclusive, toExclusive);
    }

    private static decimal RoundMoney(decimal value) =>
        Math.Round(value, 0, MidpointRounding.AwayFromZero);

    private static decimal Percent(decimal part, decimal whole) =>
        whole <= 0 ? 0 : Math.Round(part / whole * 100m, 1, MidpointRounding.AwayFromZero);

    private static decimal PercentChange(decimal current, decimal prior)
    {
        if (prior <= 0)
            return current > 0 ? 100m : 0m;
        return Math.Round((current - prior) / prior * 100m, 1, MidpointRounding.AwayFromZero);
    }

    private static string FormatVnd(decimal amount)
    {
        var rounded = RoundMoney(amount);
        return rounded.ToString("#,##0", CultureInfo.InvariantCulture).Replace(',', '.') + " ₫";
    }

    private static string FormatPercent(decimal value) =>
        value.ToString("0.#", CultureInfo.InvariantCulture) + "%";

    private static string FormatSignedPercent(decimal value)
    {
        var sign = value > 0 ? "+" : "";
        return sign + FormatPercent(value);
    }

    private static string FormatDate(DateTime date) =>
        date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private interface IMetricsContext
    {
        DateTime From { get; }
        DateTime ToInclusive { get; }
    }

    private sealed record AdminMetricsContext(
        DateTime From,
        DateTime ToInclusive,
        int TotalUsers,
        int ActiveUsers,
        int NewUsersInPeriod,
        int OrderCount,
        int PriorOrderCount,
        decimal Gmv,
        decimal PriorGmv,
        int UnitsSold,
        int BuyersWithOrders,
        int NewBuyers,
        int ReturningBuyers,
        int PendingProducts,
        int PendingReturns,
        int PendingSellerRegistrations,
        int ActiveShops,
        IReadOnlyList<string> TopProducts,
        string? Question) : IMetricsContext;

    private sealed record SellerMetricsContext(
        DateTime From,
        DateTime ToInclusive,
        int AwaitingFulfillmentCount,
        int ShippingCount,
        int ReturnRequestedCount,
        decimal RevenueToday,
        decimal RevenueThisMonth,
        decimal AvailableBalance,
        decimal PendingBalance,
        int LowStockCount,
        int PendingProductCount,
        int OrderCount,
        decimal ProductRevenue,
        decimal PriorProductRevenue,
        decimal GrossMargin,
        decimal GrossMarginPercent,
        int UnitsSold,
        IReadOnlyList<string> TopProducts,
        IReadOnlyList<string> LowStockProductNames,
        string? Question) : IMetricsContext;

    private sealed class LlmAnalyticsBriefPayload
    {
        public string? Headline { get; set; }
        public string? Summary { get; set; }
        public List<string>? Insights { get; set; }
        public List<string>? Recommendations { get; set; }
        public List<LlmAnalyticsAlertPayload>? Alerts { get; set; }
        public string? Answer { get; set; }
    }

    private sealed class LlmAnalyticsAlertPayload
    {
        public string? Severity { get; set; }
        public string Message { get; set; } = null!;
    }
}
