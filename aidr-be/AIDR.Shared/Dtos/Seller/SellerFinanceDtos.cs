namespace AIDR.Shared.Dtos.Seller;

public sealed class SellerSalesReportQueryRequest
{
    /// <summary>Inclusive start (UTC date). Defaults to 30 days before <see cref="To"/>.</summary>
    public DateTime? From { get; set; }

    /// <summary>Inclusive end (UTC date). Defaults to today (UTC).</summary>
    public DateTime? To { get; set; }

    /// <summary>day | week | month</summary>
    public string? Granularity { get; set; }
}

public sealed class SellerWalletQueryRequest
{
    public string? TxType { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public sealed class SellerDashboardDto
{
    public Guid ShopId { get; init; }
    public string Currency { get; init; } = "VND";
    public SellerDashboardOrderKpiDto Orders { get; init; } = new();
    public SellerDashboardRevenueKpiDto Revenue { get; init; } = new();
    public SellerDashboardCatalogKpiDto Catalog { get; init; } = new();
    public SellerDashboardWalletKpiDto Wallet { get; init; } = new();
    public IReadOnlyList<SellerDashboardRecentOrderDto> RecentOrders { get; init; } =
        Array.Empty<SellerDashboardRecentOrderDto>();
    public IReadOnlyList<SellerDashboardLowStockItemDto> LowStockItems { get; init; } =
        Array.Empty<SellerDashboardLowStockItemDto>();
    public DateTime GeneratedAt { get; init; }
}

public sealed class SellerDashboardOrderKpiDto
{
    public int TotalCount { get; init; }
    public int PendingPaymentCount { get; init; }
    public int AwaitingFulfillmentCount { get; init; }
    public int ShippingCount { get; init; }
    public int DeliveredCount { get; init; }
    public int CompletedCount { get; init; }
    public int CancelledCount { get; init; }
    public int ReturnRequestedCount { get; init; }
    public int ReturnedCount { get; init; }
}

public sealed class SellerDashboardRevenueKpiDto
{
    public decimal Today { get; init; }
    public decimal ThisWeek { get; init; }
    public decimal ThisMonth { get; init; }
    public decimal AllTime { get; init; }
}

public sealed class SellerDashboardCatalogKpiDto
{
    public int PendingProductCount { get; init; }
    public int LowStockCount { get; init; }
    public int ActiveProductCount { get; init; }
}

public sealed class SellerDashboardWalletKpiDto
{
    public decimal AvailableBalance { get; init; }
    public decimal PendingBalance { get; init; }
}

public sealed class SellerDashboardRecentOrderDto
{
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public string Status { get; init; } = null!;
    public decimal TotalAmount { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class SellerDashboardLowStockItemDto
{
    public Guid ProductId { get; init; }
    public string Name { get; init; } = null!;
    public int AvailableQuantity { get; init; }
    public int LowStockThreshold { get; init; }
}

public sealed class SellerSalesReportDto
{
    public Guid ShopId { get; init; }
    public string Currency { get; init; } = "VND";
    public string Granularity { get; init; } = null!;
    public DateTime From { get; init; }
    public DateTime To { get; init; }
    public SellerSalesReportTotalsDto Totals { get; init; } = new();
    public IReadOnlyList<SellerSalesReportPeriodDto> Series { get; init; } =
        Array.Empty<SellerSalesReportPeriodDto>();
    public IReadOnlyList<SellerSalesReportProductDto> TopProducts { get; init; } =
        Array.Empty<SellerSalesReportProductDto>();
}

public sealed class SellerSalesReportTotalsDto
{
    public int OrderCount { get; init; }
    public int UnitsSold { get; init; }
    public decimal OrderRevenue { get; init; }
    public decimal ProductRevenue { get; init; }
    public decimal Cogs { get; init; }
    public decimal GrossMargin { get; init; }
    public decimal GrossMarginPercent { get; init; }
}

public sealed class SellerSalesReportPeriodDto
{
    public string PeriodKey { get; init; } = null!;
    public DateTime PeriodStart { get; init; }
    public DateTime PeriodEnd { get; init; }
    public int OrderCount { get; init; }
    public int UnitsSold { get; init; }
    public decimal OrderRevenue { get; init; }
    public decimal ProductRevenue { get; init; }
    public decimal Cogs { get; init; }
    public decimal GrossMargin { get; init; }
    public decimal GrossMarginPercent { get; init; }
}

public sealed class SellerSalesReportProductDto
{
    public Guid ProductId { get; init; }
    public string ProductName { get; init; } = null!;
    public int UnitsSold { get; init; }
    public decimal ProductRevenue { get; init; }
    public decimal Cogs { get; init; }
    public decimal GrossMargin { get; init; }
    public decimal GrossMarginPercent { get; init; }
}

public sealed class SellerWalletDto
{
    public Guid WalletId { get; init; }
    public Guid ShopId { get; init; }
    public decimal AvailableBalance { get; init; }
    public decimal PendingBalance { get; init; }
    public string Currency { get; init; } = "VND";
    public DateTime UpdatedAt { get; init; }
    public IReadOnlyList<SellerWalletTransactionDto> Transactions { get; init; } =
        Array.Empty<SellerWalletTransactionDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public sealed class SellerWalletTransactionDto
{
    public long WalletTxId { get; init; }
    public string TxType { get; init; } = null!;
    public decimal Amount { get; init; }
    public decimal BalanceAfter { get; init; }
    public string? ReferenceType { get; init; }
    public Guid? ReferenceId { get; init; }
    public string? Note { get; init; }
    public DateTime CreatedAt { get; init; }
}
