using System.Globalization;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Exceptions;
using ClosedXML.Excel;

namespace AIDR.Infrastructure.SellerCenter;

/// <summary>
/// The spreadsheet shape, in one place. Export, template and import all agree on
/// the same header list on purpose: a seller can export, edit in Excel and import
/// the very same file back without rearranging anything.
/// </summary>
public sealed class ClosedXmlSellerProductWorkbook : ISellerProductWorkbook
{
    private const string ProductsSheet = "Products";
    private const string CategoriesSheet = "Categories";
    private const string InventorySheet = "Inventory";
    private const string GuideSheet = "How to fill this in";

    /// <summary>Excel refuses more than this in one cell, long before our own limits bite.</summary>
    private const int MaxCellLength = 32000;

    /// <summary>
    /// The first three are written by us and ignored on the way back in — they are
    /// there so the seller can see what a row currently is, not to be edited.
    /// </summary>
    private static readonly string[] Headers =
    [
        "ProductId",
        "Status",
        "Stock",
        "CategoryId",
        "Category",
        "Name",
        "Slug",
        "Brand",
        "ModelNumber",
        "Condition",
        "BasePrice",
        "SalePrice",
        "WarrantyMonths",
        "OriginCountry",
        "ShortDescription",
        "Description",
        "Tags",
        "Specs",
        "ImageUrls",
    ];

    /// <summary>
    /// The Inventory sheet. Slug / Product / OnHand are written by the export for
    /// orientation; Quantity and UnitCost are the two cells that actually do
    /// something, and the export deliberately leaves them blank.
    /// </summary>
    private static readonly string[] InventoryHeaders =
    [
        "Slug",
        "Product",
        "VariantSku",
        "OnHand",
        "Quantity",
        "UnitCost",
        "LotCode",
        "Supplier",
        "InvoiceNumber",
        "ReceivedAt",
        "Note",
    ];

    private static readonly (string Column, string Rule)[] InventoryGuide =
    [
        ("Slug", "Required. The product to receive stock for — the same slug as on the Products sheet, including a product this file is creating."),
        ("Product / OnHand", "Written by the export so you can see what you have. The import ignores them."),
        ("VariantSku", "Required only when the product is sold in variants; it says which configuration the stock is for. Leave blank for a single-configuration product."),
        ("Quantity", "How many units to receive as a NEW lot. Blank means this row does nothing — that is why an untouched export cannot double your stock."),
        ("UnitCost", "Required with Quantity: what you paid per unit for this lot. Digits only. Existing lots are never changed."),
        ("LotCode", "Optional. Letters, numbers, hyphen and underscore only."),
        ("ReceivedAt", "Optional date, e.g. 2026-09-04. Blank means today."),
    ];

    private static readonly (string Column, string Rule)[] Guide =
    [
        ("ProductId / Status / Stock", "Written by the export. Leave them alone — the import ignores them."),
        ("CategoryId", "Required. Copy it from the Categories sheet. If you leave it blank, Category is used instead."),
        ("Category", "Optional shortcut: the category name, or its full path like \"Phones > Samsung Galaxy\"."),
        ("Name", "Required."),
        ("Slug", "Optional. This is what decides create vs update: a slug already in your shop updates that product. Blank means one is generated from the name."),
        ("Condition", "One of New, LikeNew, Refurbished, Used. Blank means New."),
        ("BasePrice", "Required. Digits only — 5990000, not 5.990.000 d."),
        ("SalePrice", "Optional, and must be at or below BasePrice."),
        ("WarrantyMonths", "Optional whole number of months."),
        ("Tags", "Comma separated, e.g. flagship, 5g."),
        ("Specs", "Semicolon separated name=value pairs, e.g. ram=12GB; storage=256GB."),
        ("ImageUrls", "Comma separated http(s) links. The first one becomes the primary image. On a row that updates an existing product, leaving this blank keeps the photos it already has."),
    ];

    public SellerImportSheets Read(Stream stream)
    {
        using var workbook = OpenWorkbook(stream);

        return new SellerImportSheets
        {
            Products = ReadProducts(workbook),
            Inventory = ReadInventory(workbook),
        };
    }

    private static IReadOnlyList<SellerProductSheetRow> ReadProducts(XLWorkbook workbook)
    {
        var sheet = workbook.Worksheets.FirstOrDefault(w =>
            string.Equals(w.Name, ProductsSheet, StringComparison.OrdinalIgnoreCase));

        if (sheet is null)
        {
            // A file whose only sheet is Inventory is a stock delivery, not a broken
            // catalogue upload; reading the first sheet as products would reject it
            // for having no Name column.
            if (workbook.Worksheets.Any(w =>
                    string.Equals(w.Name, InventorySheet, StringComparison.OrdinalIgnoreCase)))
            {
                return [];
            }

            sheet = workbook.Worksheets.FirstOrDefault()
                ?? throw new AppException("The workbook has no sheets.");
        }

        var used = sheet.RangeUsed();
        if (used is null)
            throw new AppException("The sheet is empty.");

        var columns = MapHeaderColumns(used.FirstRow());

        if (!columns.ContainsKey("name"))
        {
            throw new AppException(
                "The first row must be the header row, and it must contain a \"Name\" column. " +
                "Start from the exported file or the template.");
        }

        var rows = new List<SellerProductSheetRow>();

        foreach (var row in used.RowsUsed().Skip(1))
        {
            var parsed = new SellerProductSheetRow
            {
                RowNumber = row.RowNumber(),
                Name = Read(row, columns, "name"),
                Slug = Read(row, columns, "slug"),
                CategoryId = Read(row, columns, "categoryid"),
                Category = Read(row, columns, "category"),
                Brand = Read(row, columns, "brand"),
                ModelNumber = Read(row, columns, "modelnumber"),
                Condition = Read(row, columns, "condition"),
                BasePrice = Read(row, columns, "baseprice"),
                SalePrice = Read(row, columns, "saleprice"),
                WarrantyMonths = Read(row, columns, "warrantymonths"),
                OriginCountry = Read(row, columns, "origincountry"),
                ShortDescription = Read(row, columns, "shortdescription"),
                Description = Read(row, columns, "description"),
                Tags = Read(row, columns, "tags"),
                Specs = Read(row, columns, "specs"),
                ImageUrls = Read(row, columns, "imageurls"),
            };

            // A row someone cleared still sits inside the used range; that is not an error.
            if (parsed.IsEmpty) continue;

            rows.Add(parsed);
        }

        return rows;
    }

    /// <summary>
    /// The Inventory sheet is optional: a file saved from an older export, or one
    /// the seller built by hand, simply has no stock to receive.
    /// </summary>
    private static IReadOnlyList<SellerInventorySheetRow> ReadInventory(XLWorkbook workbook)
    {
        var sheet = workbook.Worksheets.FirstOrDefault(w =>
            string.Equals(w.Name, InventorySheet, StringComparison.OrdinalIgnoreCase));

        var used = sheet?.RangeUsed();
        if (used is null) return [];

        var columns = MapHeaderColumns(used.FirstRow());
        if (!columns.ContainsKey("slug")) return [];

        var rows = new List<SellerInventorySheetRow>();

        foreach (var row in used.RowsUsed().Skip(1))
        {
            var parsed = new SellerInventorySheetRow
            {
                RowNumber = row.RowNumber(),
                Slug = Read(row, columns, "slug"),
                VariantSku = Read(row, columns, "variantsku"),
                Quantity = Read(row, columns, "quantity"),
                UnitCost = Read(row, columns, "unitcost"),
                LotCode = Read(row, columns, "lotcode"),
                SupplierName = Read(row, columns, "supplier"),
                InvoiceNumber = Read(row, columns, "invoicenumber"),
                ReceivedAt = Read(row, columns, "receivedat"),
                Note = Read(row, columns, "note"),
            };

            // An export row nobody edited carries only the read-only cells.
            if (parsed.IsEmpty) continue;

            rows.Add(parsed);
        }

        return rows;
    }

    public byte[] WriteProducts(
        IReadOnlyList<SellerProductSheetExport> products,
        IReadOnlyList<SellerInventorySheetExport> inventory,
        IReadOnlyList<SellerCategoryChoice> categories)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet(ProductsSheet);
        WriteHeaderRow(sheet);

        var rowIndex = 2;
        foreach (var product in products)
        {
            var row = sheet.Row(rowIndex);
            row.Cell(1).SetValue(product.ProductId.ToString());
            row.Cell(2).SetValue(product.Status);
            row.Cell(3).SetValue(product.StockQuantity);
            row.Cell(4).SetValue(product.CategoryId);
            row.Cell(5).SetValue(Clamp(product.CategoryPath));
            row.Cell(6).SetValue(Clamp(product.Name));
            row.Cell(7).SetValue(Clamp(product.Slug));
            row.Cell(8).SetValue(Clamp(product.Brand));
            row.Cell(9).SetValue(Clamp(product.ModelNumber));
            row.Cell(10).SetValue(product.ConditionType);
            row.Cell(11).SetValue(product.BasePrice);
            if (product.SalePrice is { } sale) row.Cell(12).SetValue(sale);
            if (product.WarrantyMonths is { } warranty) row.Cell(13).SetValue(warranty);
            row.Cell(14).SetValue(Clamp(product.OriginCountry));
            row.Cell(15).SetValue(Clamp(product.ShortDescription));
            row.Cell(16).SetValue(Clamp(product.Description));
            row.Cell(17).SetValue(Clamp(product.Tags));
            row.Cell(18).SetValue(Clamp(product.Specs));
            row.Cell(19).SetValue(Clamp(product.ImageUrls));
            rowIndex++;
        }

        // Prices stay plain integers: a currency format comes back as text on the
        // next import, which is exactly the round trip this is protecting.
        sheet.Columns(11, 12).Style.NumberFormat.Format = "0";
        FinishProductsSheet(sheet, rowIndex - 1);

        AddInventorySheet(workbook, inventory);
        AddCategoriesSheet(workbook, categories);
        AddGuideSheet(workbook);

        return Save(workbook);
    }

    public byte[] WriteTemplate(IReadOnlyList<SellerCategoryChoice> categories)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet(ProductsSheet);
        WriteHeaderRow(sheet);

        var example = categories.FirstOrDefault();
        var row = sheet.Row(2);
        row.Cell(4).SetValue(example?.CategoryId ?? 1);
        row.Cell(5).SetValue(example?.Path ?? string.Empty);
        row.Cell(6).SetValue("Galaxy S24 Ultra 256GB");
        row.Cell(7).SetValue("galaxy-s24-ultra-256gb");
        row.Cell(8).SetValue("Samsung");
        row.Cell(9).SetValue("SM-S928B");
        row.Cell(10).SetValue(SellerProductConstants.ConditionNew);
        row.Cell(11).SetValue(29990000);
        row.Cell(12).SetValue(27990000);
        row.Cell(13).SetValue(12);
        row.Cell(14).SetValue("Vietnam");
        row.Cell(15).SetValue("Flagship with a 200MP camera");
        row.Cell(16).SetValue("Longer description shown on the product page.");
        row.Cell(17).SetValue("flagship, 5g");
        row.Cell(18).SetValue("ram=12GB; storage=256GB");
        row.Cell(19).SetValue("https://example.com/galaxy-s24-front.jpg");
        row.Style.Font.FontColor = XLColor.Gray;
        row.Style.Font.Italic = true;

        sheet.Cell(3, 1).SetValue("The row above is an example. Delete it before importing.");
        sheet.Cell(3, 1).Style.Font.FontColor = XLColor.Gray;

        FinishProductsSheet(sheet, 2);

        // The template's inventory example receives stock for the product above it,
        // which is the whole point: one file can create a product and stock it.
        AddInventorySheet(workbook, [], example: new SellerInventorySheetExport
        {
            Slug = "galaxy-s24-ultra-256gb",
            ProductName = "Galaxy S24 Ultra 256GB",
            VariantSku = string.Empty,
        });

        AddCategoriesSheet(workbook, categories);
        AddGuideSheet(workbook);

        return Save(workbook);
    }

    private static void AddInventorySheet(
        XLWorkbook workbook,
        IReadOnlyList<SellerInventorySheetExport> inventory,
        SellerInventorySheetExport? example = null)
    {
        var sheet = workbook.AddWorksheet(InventorySheet);

        for (var i = 0; i < InventoryHeaders.Length; i++)
            sheet.Cell(1, i + 1).SetValue(InventoryHeaders[i]);

        var header = sheet.Range(1, 1, 1, InventoryHeaders.Length);
        header.Style.Font.Bold = true;
        header.Style.Fill.BackgroundColor = XLColor.FromHtml("#F1F3F5");
        // Product and OnHand are ours; the seller edits from Quantity rightwards.
        sheet.Range(1, 2, 1, 2).Style.Font.FontColor = XLColor.Gray;
        sheet.Range(1, 4, 1, 4).Style.Font.FontColor = XLColor.Gray;

        var rowIndex = 2;
        foreach (var line in inventory)
        {
            var row = sheet.Row(rowIndex);
            row.Cell(1).SetValue(Clamp(line.Slug));
            row.Cell(2).SetValue(Clamp(line.VariantName is null
                ? line.ProductName
                : $"{line.ProductName} — {line.VariantName}"));
            row.Cell(3).SetValue(Clamp(line.VariantSku));
            row.Cell(4).SetValue(line.OnHand);
            // Quantity and UnitCost stay empty on purpose: importing an untouched
            // export must be a no-op, not a second delivery of everything.
            rowIndex++;
        }

        if (example is not null)
        {
            var row = sheet.Row(rowIndex);
            row.Cell(1).SetValue(example.Slug);
            row.Cell(2).SetValue(example.ProductName);
            row.Cell(5).SetValue(10);
            row.Cell(6).SetValue(24500000);
            row.Cell(7).SetValue("LOT-2026-09");
            row.Cell(8).SetValue("Samsung Vietnam");
            row.Style.Font.FontColor = XLColor.Gray;
            row.Style.Font.Italic = true;
            rowIndex++;

            sheet.Cell(rowIndex, 1).SetValue("The row above is an example. Delete it before importing.");
            sheet.Cell(rowIndex, 1).Style.Font.FontColor = XLColor.Gray;
            rowIndex++;
        }

        sheet.Columns(6, 6).Style.NumberFormat.Format = "0";
        sheet.SheetView.FreezeRows(1);
        sheet.Columns(1, InventoryHeaders.Length)
            .AdjustToContents(1, Math.Max(rowIndex - 1, 1), 10d, 40d);
    }

    private static void WriteHeaderRow(IXLWorksheet sheet)
    {
        for (var i = 0; i < Headers.Length; i++)
            sheet.Cell(1, i + 1).SetValue(Headers[i]);

        var header = sheet.Range(1, 1, 1, Headers.Length);
        header.Style.Font.Bold = true;
        header.Style.Fill.BackgroundColor = XLColor.FromHtml("#F1F3F5");

        // The three export-only columns, greyed so nobody wastes time editing them.
        sheet.Range(1, 1, 1, 3).Style.Font.FontColor = XLColor.Gray;
    }

    private static void FinishProductsSheet(IXLWorksheet sheet, int lastRow)
    {
        sheet.SheetView.FreezeRows(1);
        sheet.Columns(1, Headers.Length).AdjustToContents(1, Math.Max(lastRow, 1), 8d, 42d);
        sheet.Column(16).Width = 42;
    }

    private static void AddCategoriesSheet(XLWorkbook workbook, IReadOnlyList<SellerCategoryChoice> categories)
    {
        var sheet = workbook.AddWorksheet(CategoriesSheet);
        sheet.Cell(1, 1).SetValue("CategoryId");
        sheet.Cell(1, 2).SetValue("Category");
        sheet.Range(1, 1, 1, 2).Style.Font.Bold = true;

        var rowIndex = 2;
        foreach (var category in categories)
        {
            sheet.Cell(rowIndex, 1).SetValue(category.CategoryId);
            sheet.Cell(rowIndex, 2).SetValue(Clamp(category.Path));
            rowIndex++;
        }

        sheet.SheetView.FreezeRows(1);
        sheet.Columns(1, 2).AdjustToContents(1, Math.Max(rowIndex - 1, 1), 10d, 60d);
    }

    private static void AddGuideSheet(XLWorkbook workbook)
    {
        var sheet = workbook.AddWorksheet(GuideSheet);
        sheet.Cell(1, 1).SetValue("Column");
        sheet.Cell(1, 2).SetValue("What goes in it");
        sheet.Range(1, 1, 1, 2).Style.Font.Bold = true;

        var rowIndex = 2;
        foreach (var (column, rule) in Guide)
        {
            sheet.Cell(rowIndex, 1).SetValue(column);
            sheet.Cell(rowIndex, 2).SetValue(rule);
            rowIndex++;
        }

        rowIndex++;
        sheet.Cell(rowIndex, 1).SetValue("Inventory sheet");
        sheet.Cell(rowIndex, 1).Style.Font.Bold = true;
        rowIndex++;

        foreach (var (column, rule) in InventoryGuide)
        {
            sheet.Cell(rowIndex, 1).SetValue(column);
            sheet.Cell(rowIndex, 2).SetValue(rule);
            rowIndex++;
        }

        sheet.Column(1).Width = 26;
        sheet.Column(2).Width = 96;
        sheet.Column(2).Style.Alignment.WrapText = true;
        sheet.SheetView.FreezeRows(1);
    }

    private static XLWorkbook OpenWorkbook(Stream stream)
    {
        try
        {
            return new XLWorkbook(stream);
        }
        catch (Exception ex)
        {
            // Almost always a .xls or a renamed .csv. Say that, rather than leaking
            // the library's own wording to the seller.
            throw new AppException($"This file could not be read as an .xlsx workbook: {ex.Message}");
        }
    }

    private static byte[] Save(XLWorkbook workbook)
    {
        using var buffer = new MemoryStream();
        workbook.SaveAs(buffer);
        return buffer.ToArray();
    }

    private static Dictionary<string, int> MapHeaderColumns(IXLRangeRow headerRow)
    {
        var columns = new Dictionary<string, int>(StringComparer.Ordinal);

        foreach (var cell in headerRow.Cells())
        {
            var key = Normalize(cell.GetString());
            if (key.Length == 0) continue;
            // First one wins: a duplicated header is the seller's to fix, not ours to guess.
            columns.TryAdd(key, cell.Address.ColumnNumber);
        }

        return columns;
    }

    /// <summary>"Base Price", "base_price" and "BASEPRICE" are all the same column.</summary>
    private static string Normalize(string header) =>
        new(header.Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());

    private static string? Read(IXLRangeRow row, Dictionary<string, int> columns, string key)
    {
        if (!columns.TryGetValue(key, out var column)) return null;

        var cell = row.Worksheet.Cell(row.RowNumber(), column);
        if (cell.IsEmpty()) return null;

        var value = cell.Value;
        var text = value.IsNumber
            ? value.GetNumber().ToString("0.##########", CultureInfo.InvariantCulture)
            : value.IsDateTime
                ? value.GetDateTime().ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
                : value.IsBoolean
                    ? value.GetBoolean().ToString()
                    : cell.GetString();

        text = text.Trim();
        return text.Length == 0 ? null : text;
    }

    private static string Clamp(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        return value.Length <= MaxCellLength ? value : value[..MaxCellLength];
    }
}
