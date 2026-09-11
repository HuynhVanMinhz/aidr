using AIDR.Shared.Dtos.Seller;

namespace AIDR.Modules.SellerCenter.Abstractions;

/// <summary>
/// A picture the seller pasted into the sheet instead of typing a link.
///
/// It arrives as bytes because a workbook stores the file itself, not a URL; the
/// import hands it to <see cref="ISellerImportImageStore"/> to become one.
/// </summary>
public sealed class SheetImage
{
    public required byte[] Content { get; init; }

    /// <summary>Lower-case, no dot — "png", "jpg", "webp". Decides the upload's file name.</summary>
    public required string Extension { get; init; }

    /// <summary>Which sheet row the picture sits on, so an error can name it.</summary>
    public int RowNumber { get; init; }
}

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

    /// <summary>Pictures pasted onto this row, in the order the sheet holds them.</summary>
    public IReadOnlyList<SheetImage> Images { get; init; } = Array.Empty<SheetImage>();

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
/// One variant as read from the Variants sheet.
///
/// Variants belong to the product the Products sheet declares on the same slug,
/// which is what lets one file create a product and its configurations together.
/// </summary>
public sealed class SellerProductVariantSheetRow
{
    public int RowNumber { get; init; }

    /// <summary>Which product this configuration belongs to. Matches the Products sheet slug.</summary>
    public string? Slug { get; init; }

    public string? Sku { get; init; }

    /// <summary>The axes and their chosen values, e.g. "Color=Pink; Storage=256GB".</summary>
    public string? Attributes { get; init; }

    public string? Price { get; init; }
    public string? SalePrice { get; init; }

    /// <summary>An http(s) link. A picture pasted on the row is used when this is blank.</summary>
    public string? ImageUrl { get; init; }

    /// <summary>Blank means the variant is on sale.</summary>
    public string? IsActive { get; init; }

    /// <summary>Pictures pasted onto this row; the first one is the variant's photo.</summary>
    public IReadOnlyList<SheetImage> Images { get; init; } = Array.Empty<SheetImage>();

    /// <summary>An export row nobody touched still carries Slug and Product; that is not a variant to write.</summary>
    public bool IsEmpty =>
        string.IsNullOrWhiteSpace(Attributes) &&
        string.IsNullOrWhiteSpace(Sku) &&
        string.IsNullOrWhiteSpace(Price) &&
        string.IsNullOrWhiteSpace(SalePrice) &&
        string.IsNullOrWhiteSpace(ImageUrl) &&
        Images.Count == 0;
}

/// <summary>One variant as written out to the Variants sheet.</summary>
public sealed class SellerProductVariantSheetExport
{
    public string Slug { get; init; } = null!;
    public string ProductName { get; init; } = null!;
    public string? Sku { get; init; }
    public string VariantName { get; init; } = null!;
    public string Attributes { get; init; } = null!;
    public decimal Price { get; init; }
    public decimal? SalePrice { get; init; }
    public string? ImageUrl { get; init; }
    public bool IsActive { get; init; }
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

/// <summary>Every sheet of an uploaded workbook, read in a single pass.</summary>
public sealed class SellerImportSheets
{
    public IReadOnlyList<SellerProductSheetRow> Products { get; init; } =
        Array.Empty<SellerProductSheetRow>();

    public IReadOnlyList<SellerProductVariantSheetRow> Variants { get; init; } =
        Array.Empty<SellerProductVariantSheetRow>();

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
        IReadOnlyList<SellerProductVariantSheetExport> variants,
        IReadOnlyList<SellerInventorySheetExport> inventory,
        IReadOnlyList<SellerCategoryChoice> categories);

    byte[] WriteTemplate(IReadOnlyList<SellerCategoryChoice> categories);
}

/// <summary>
/// Where a picture pasted into a spreadsheet ends up.
///
/// The catalogue stores photos as URLs, so an embedded image has to be given one
/// before it can be saved. Kept behind a port: the import rules do not care which
/// host serves the file, only that it comes back addressable.
/// </summary>
public interface ISellerImportImageStore
{
    /// <summary>
    /// False when the deployment has no image host configured. The import says so
    /// against the row instead of failing halfway through with a stack trace.
    /// </summary>
    bool IsConfigured { get; }

    /// <summary>The largest picture worth accepting from a sheet.</summary>
    int MaxBytes { get; }

    /// <summary>Extensions this store accepts, lower-case and without the dot.</summary>
    IReadOnlyCollection<string> AllowedExtensions { get; }

    /// <summary>Uploads the picture and returns the URL it is served from.</summary>
    Task<string> SaveAsync(SheetImage image, CancellationToken cancellationToken = default);
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
