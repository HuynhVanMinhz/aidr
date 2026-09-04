using AIDR.Shared.Dtos.Seller;

namespace AIDR.Modules.SellerCenter.Abstractions;

/// <summary>
/// One row as it came out of the spreadsheet: every cell is still a string,
/// because a seller's typo has to survive parsing long enough to be reported
/// against the row it came from.
/// </summary>
public sealed class SellerProductSheetRow
{
    public int RowNumber { get; init; }
    public string? Name { get; init; }
    public string? Slug { get; init; }
    public string? CategoryId { get; init; }
    public string? Category { get; init; }
    public string? Brand { get; init; }
    public string? ModelNumber { get; init; }
    public string? Condition { get; init; }
    public string? BasePrice { get; init; }
    public string? SalePrice { get; init; }
    public string? WarrantyMonths { get; init; }
    public string? OriginCountry { get; init; }
    public string? ShortDescription { get; init; }
    public string? Description { get; init; }
    public string? Tags { get; init; }
    public string? Specs { get; init; }
    public string? ImageUrls { get; init; }

    /// <summary>True when every cell was blank, so trailing rows can be dropped.</summary>
    public bool IsEmpty =>
        string.IsNullOrWhiteSpace(Name) &&
        string.IsNullOrWhiteSpace(Slug) &&
        string.IsNullOrWhiteSpace(CategoryId) &&
        string.IsNullOrWhiteSpace(Category) &&
        string.IsNullOrWhiteSpace(BasePrice);
}

/// <summary>A product as it is written out to a sheet.</summary>
public sealed class SellerProductSheetExport
{
    public Guid ProductId { get; init; }
    public string Status { get; init; } = null!;
    public int StockQuantity { get; init; }
    public int CategoryId { get; init; }
    public string CategoryPath { get; init; } = null!;
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? Brand { get; init; }
    public string? ModelNumber { get; init; }
    public string ConditionType { get; init; } = null!;
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public int? WarrantyMonths { get; init; }
    public string? OriginCountry { get; init; }
    public string? ShortDescription { get; init; }
    public string? Description { get; init; }
    public string? Tags { get; init; }
    public string? Specs { get; init; }
    public string? ImageUrls { get; init; }
}

/// <summary>
/// One stock lot to receive, as read from the Inventory sheet.
///
/// Stock is never a number the sheet simply sets: it is a lot with a cost, the
/// same as receiving stock by hand. That is what keeps FIFO costing honest, and
/// it is why the export leaves Quantity blank — re-importing an untouched export
/// must not silently double a shop's stock.
/// </summary>
public sealed class SellerInventorySheetRow
{
    public int RowNumber { get; init; }

    /// <summary>Which product to receive stock for. Matches the Products sheet slug.</summary>
    public string? Slug { get; init; }

    /// <summary>Which configuration. Required when the product is sold in variants.</summary>
    public string? VariantSku { get; init; }

    public string? Quantity { get; init; }
    public string? UnitCost { get; init; }
    public string? LotCode { get; init; }
    public string? SupplierName { get; init; }
    public string? InvoiceNumber { get; init; }
    public string? ReceivedAt { get; init; }
    public string? Note { get; init; }

    /// <summary>A row with nothing to receive is skipped, not an error.</summary>
    public bool IsEmpty =>
        string.IsNullOrWhiteSpace(Quantity) &&
        string.IsNullOrWhiteSpace(UnitCost) &&
        string.IsNullOrWhiteSpace(LotCode) &&
        string.IsNullOrWhiteSpace(SupplierName) &&
        string.IsNullOrWhiteSpace(InvoiceNumber) &&
        string.IsNullOrWhiteSpace(Note);
}

/// <summary>Current stock as written out, one row per sellable configuration.</summary>
public sealed class SellerInventorySheetExport
{
    public string Slug { get; init; } = null!;
    public string ProductName { get; init; } = null!;
    public string? VariantSku { get; init; }
    public string? VariantName { get; init; }
    public int OnHand { get; init; }
}

/// <summary>Both sheets of an uploaded workbook, read in a single pass.</summary>
public sealed class SellerImportSheets
{
    public IReadOnlyList<SellerProductSheetRow> Products { get; init; } =
        Array.Empty<SellerProductSheetRow>();

    public IReadOnlyList<SellerInventorySheetRow> Inventory { get; init; } =
        Array.Empty<SellerInventorySheetRow>();
}

/// <summary>A category as offered to the seller on the reference sheet.</summary>
public sealed class SellerCategoryChoice
{
    public int CategoryId { get; init; }
    public string Path { get; init; } = null!;
}

/// <summary>
/// The spreadsheet format itself, kept behind a port so the business rules do
/// not depend on a file-format library.
/// </summary>
public interface ISellerProductWorkbook
{
    /// <summary>
    /// Reads every sheet in one pass — an uploaded stream is not always seekable,
    /// so it cannot be handed back for a second read.
    /// </summary>
    SellerImportSheets Read(Stream stream);

    byte[] WriteProducts(
        IReadOnlyList<SellerProductSheetExport> products,
        IReadOnlyList<SellerInventorySheetExport> inventory,
        IReadOnlyList<SellerCategoryChoice> categories);

    byte[] WriteTemplate(IReadOnlyList<SellerCategoryChoice> categories);
}

public interface ISellerProductExcelService
{
    Task<byte[]> ExportAsync(
        Guid ownerUserId,
        SellerProductQueryRequest request,
        CancellationToken cancellationToken = default);

    Task<byte[]> BuildTemplateAsync(Guid ownerUserId, CancellationToken cancellationToken = default);

    Task<SellerProductImportPreviewDto> PreviewImportAsync(
        Guid ownerUserId,
        Stream file,
        CancellationToken cancellationToken = default);

    Task<SellerProductImportResultDto> ImportAsync(
        Guid ownerUserId,
        Stream file,
        CancellationToken cancellationToken = default);
}
