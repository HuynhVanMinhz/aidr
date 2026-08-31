namespace AIDR.Shared.Dtos.Seller;

public sealed class SellerInventoryQueryRequest
{
    public string? Q { get; set; }
    public bool? LowStock { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public sealed class SellerInventorySummaryDto
{
    public int ProductCount { get; init; }
    public int LowStockCount { get; init; }
    public int TotalUnits { get; init; }
    public int ReservedUnits { get; init; }
}

public sealed class SellerInventoryListItemDto
{
    public Guid ProductId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string Status { get; init; } = null!;
    public string? PrimaryImageUrl { get; init; }
    public int StockQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public int AvailableQuantity { get; init; }
    public int LowStockThreshold { get; init; }
    public bool IsLowStock { get; init; }
    public decimal? LastCostPrice { get; init; }
    public decimal? AvgCostPrice { get; init; }
    /// <summary>Effective selling price minus AvgCostPrice (null if cost unknown).</summary>
    public decimal? EstimatedMarginPerUnit { get; init; }
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public decimal EffectivePrice { get; init; }
    public string Currency { get; init; } = "VND";
    public DateTime UpdatedAt { get; init; }
}

public sealed class SellerInventoryListResult
{
    public IReadOnlyList<SellerInventoryListItemDto> Items { get; init; } = Array.Empty<SellerInventoryListItemDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
    public SellerInventorySummaryDto Summary { get; init; } = new();
}

public sealed class SellerInventoryLotDto
{
    public Guid LotId { get; init; }
    public Guid? VariantId { get; init; }
    public string? VariantName { get; init; }
    public string LotCode { get; init; } = null!;
    public int QuantityReceived { get; init; }
    public int QuantityRemaining { get; init; }
    public decimal UnitCost { get; init; }
    /// <summary>Effective selling price minus this lot's UnitCost.</summary>
    public decimal? EstimatedMarginPerUnit { get; init; }
    public string Currency { get; init; } = "VND";
    public string? SupplierName { get; init; }
    public string? InvoiceNumber { get; init; }
    public DateTime ReceivedAt { get; init; }
    public DateTime? ExpiresAt { get; init; }
    public string Status { get; init; } = null!;
    public string? Note { get; init; }
}

public sealed class SellerInventoryTransactionDto
{
    public long InventoryTxId { get; init; }
    public Guid? LotId { get; init; }
    public string? LotCode { get; init; }
    public int ChangeQty { get; init; }
    public decimal? UnitCost { get; init; }
    public string Reason { get; init; } = null!;
    public string? ReferenceType { get; init; }
    public Guid? ReferenceId { get; init; }
    public string? Note { get; init; }
    public DateTime CreatedAt { get; init; }
}

/// <summary>Stock for one configuration, so the seller can see which colour ran out.</summary>
public sealed class SellerInventoryVariantDto
{
    public Guid VariantId { get; init; }
    public string VariantName { get; init; } = null!;
    public string? Sku { get; init; }
    public int StockQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public int AvailableQuantity { get; init; }
    public decimal Price { get; init; }
    public decimal? SalePrice { get; init; }
    public decimal EffectivePrice { get; init; }
    public decimal? AvgCostPrice { get; init; }
    public decimal? EstimatedMarginPerUnit { get; init; }
    public bool IsActive { get; init; }
}

public sealed class SellerInventoryDetailDto
{
    public Guid ProductId { get; init; }
    public string Name { get; init; } = null!;
    public string Status { get; init; } = null!;
    public int StockQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public int AvailableQuantity { get; init; }
    public int LowStockThreshold { get; init; }
    public bool IsLowStock { get; init; }
    public decimal? LastCostPrice { get; init; }
    public decimal? AvgCostPrice { get; init; }
    /// <summary>Effective selling price minus AvgCostPrice (null if cost unknown).</summary>
    public decimal? EstimatedMarginPerUnit { get; init; }
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public decimal EffectivePrice { get; init; }
    public string Currency { get; init; } = "VND";
    /// <summary>Empty when the product is sold as a single configuration.</summary>
    public IReadOnlyList<SellerInventoryVariantDto> Variants { get; init; } =
        Array.Empty<SellerInventoryVariantDto>();
    public IReadOnlyList<SellerInventoryLotDto> Lots { get; init; } = Array.Empty<SellerInventoryLotDto>();
    public IReadOnlyList<SellerInventoryTransactionDto> RecentTransactions { get; init; } =
        Array.Empty<SellerInventoryTransactionDto>();
}

public sealed class UpdateSellerInventoryRequest
{
    public int LowStockThreshold { get; set; }
}

public sealed class AdjustSellerInventoryRequest
{
    /// <summary>Which configuration to adjust. Required when the product has variants and no LotId is given.</summary>
    public Guid? VariantId { get; set; }
    public int ChangeQty { get; set; }
    public Guid? LotId { get; set; }
    public string? Note { get; set; }
}

public sealed class ImportStockLotRequest
{
    /// <summary>Which configuration the stock is for. Required when the product has variants.</summary>
    public Guid? VariantId { get; set; }
    public string? LotCode { get; set; }
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public string? SupplierName { get; set; }
    public string? InvoiceNumber { get; set; }
    public DateTime? ReceivedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string? Note { get; set; }
}

public sealed class UpdateSellingPriceRequest
{
    public decimal BasePrice { get; set; }
    public decimal? SalePrice { get; set; }
    public string? Reason { get; set; }
}

public sealed class SellerPriceUpdateDto
{
    public Guid ProductId { get; init; }
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public decimal? OldBasePrice { get; init; }
    public decimal? OldSalePrice { get; init; }
    public long PriceHistoryId { get; init; }
    public string Currency { get; init; } = "VND";
}
