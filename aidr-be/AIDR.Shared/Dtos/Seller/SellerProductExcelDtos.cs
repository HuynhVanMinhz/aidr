namespace AIDR.Shared.Dtos.Seller;

/// <summary>
/// What one spreadsheet row would do, decided before anything is written. The
/// seller sees this table and only then confirms, so every field here exists to
/// answer "what will happen to this row, and why".
/// </summary>
public sealed record SellerProductImportRowDto
{
    /// <summary>The row number in the sheet, so the seller can find it to fix it.</summary>
    public int RowNumber { get; init; }

    public string? Name { get; init; }

    public string? Slug { get; init; }

    /// <summary>Create, Update or Error.</summary>
    public string Action { get; init; } = null!;

    /// <summary>Set when Action is Update: the product this row would overwrite.</summary>
    public Guid? ProductId { get; init; }

    /// <summary>Resolved category name, so a wrong-but-valid id is still visible.</summary>
    public string? CategoryName { get; init; }

    public decimal? BasePrice { get; init; }

    /// <summary>Everything wrong with this row. Empty means it is ready to import.</summary>
    public IReadOnlyList<string> Errors { get; init; } = Array.Empty<string>();
}

/// <summary>
/// What one Inventory row would receive. Stock arrives as a lot with a cost, so
/// the preview states the quantity and the cost the seller is committing to
/// before any of it is written.
/// </summary>
public sealed record SellerInventoryImportRowDto
{
    public int RowNumber { get; init; }
    public string? Slug { get; init; }

    /// <summary>The product this row resolved to, so a typo'd slug is visible.</summary>
    public string? ProductName { get; init; }

    /// <summary>Blank for a single-configuration product.</summary>
    public string? VariantSku { get; init; }

    /// <summary>Receive or Error.</summary>
    public string Action { get; init; } = null!;

    public int? Quantity { get; init; }
    public decimal? UnitCost { get; init; }

    public IReadOnlyList<string> Errors { get; init; } = Array.Empty<string>();
}

public sealed class SellerProductImportPreviewDto
{
    public int TotalRows { get; init; }
    public int CreateCount { get; init; }
    public int UpdateCount { get; init; }
    public int ErrorCount { get; init; }

    /// <summary>Inventory rows that would receive stock, and the ones that cannot.</summary>
    public int StockRowCount { get; init; }
    public int StockErrorCount { get; init; }

    /// <summary>Total units this file would receive, so a stray zero is obvious.</summary>
    public int StockUnitCount { get; init; }

    public IReadOnlyList<SellerInventoryImportRowDto> StockRows { get; init; } =
        Array.Empty<SellerInventoryImportRowDto>();

    /// <summary>Rows the sheet lists twice under one slug; the last one would win.</summary>
    public IReadOnlyList<string> Warnings { get; init; } = Array.Empty<string>();

    public IReadOnlyList<SellerProductImportRowDto> Rows { get; init; } =
        Array.Empty<SellerProductImportRowDto>();
}

public sealed class SellerProductImportResultDto
{
    public int Created { get; init; }
    public int Updated { get; init; }
    public int Failed { get; init; }

    /// <summary>Lots received and units added, counted separately from the products.</summary>
    public int StockLotsReceived { get; init; }
    public int StockUnitsReceived { get; init; }
    public int StockFailed { get; init; }

    public IReadOnlyList<SellerInventoryImportRowDto> FailedStockRows { get; init; } =
        Array.Empty<SellerInventoryImportRowDto>();

    /// <summary>Only the rows that failed — the successes need no explanation.</summary>
    public IReadOnlyList<SellerProductImportRowDto> FailedRows { get; init; } =
        Array.Empty<SellerProductImportRowDto>();
}
