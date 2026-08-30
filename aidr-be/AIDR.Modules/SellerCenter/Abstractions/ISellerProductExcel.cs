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
    IReadOnlyList<SellerProductSheetRow> Read(Stream stream);

    byte[] WriteProducts(
        IReadOnlyList<SellerProductSheetExport> products,
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
