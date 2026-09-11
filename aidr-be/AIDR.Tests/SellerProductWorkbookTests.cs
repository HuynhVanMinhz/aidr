using AIDR.Infrastructure.SellerCenter;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Exceptions;
using ClosedXML.Excel;
using Xunit;

namespace AIDR.Tests;

/// <summary>
/// The spreadsheet contract. These are the rules a seller relies on without ever
/// being told them: that the file they downloaded can go straight back in, that
/// doing so changes nothing, and that the one edit they make is the one thing
/// that happens.
/// </summary>
public class SellerProductWorkbookTests
{
    private readonly ClosedXmlSellerProductWorkbook _workbook = new();

    private static readonly IReadOnlyList<SellerProductVariantSheetExport> NoVariants = [];

    private static readonly IReadOnlyList<SellerCategoryChoice> Categories =
    [
        new() { CategoryId = 7, Path = "Phones > Samsung" },
    ];

    private static IReadOnlyList<SellerProductSheetExport> OneProduct() =>
    [
        new()
        {
            ProductId = Guid.NewGuid(),
            Status = "Active",
            StockQuantity = 12,
            CategoryId = 7,
            CategoryPath = "Phones > Samsung",
            Name = "Galaxy S24",
            Slug = "galaxy-s24",
            ConditionType = "New",
            BasePrice = 29_990_000m,
        },
    ];

    private static IReadOnlyList<SellerInventorySheetExport> TwoStockLines() =>
    [
        new() { Slug = "galaxy-s24", ProductName = "Galaxy S24", OnHand = 12 },
        new()
        {
            Slug = "galaxy-s24",
            ProductName = "Galaxy S24",
            VariantSku = "S24-256-BLK",
            VariantName = "256GB / Black",
            OnHand = 5,
        },
    ];

    /* ------------------------------------------------------------- round trip */

    [Fact]
    public void Export_reimported_untouched_receives_no_stock()
    {
        // The whole safety story of the Inventory sheet: the export never fills in
        // a quantity, so re-importing it cannot silently double a shop's stock.
        var file = _workbook.WriteProducts(OneProduct(), NoVariants, TwoStockLines(), Categories);

        var read = _workbook.Read(new MemoryStream(file));

        Assert.Single(read.Products);
        Assert.Empty(read.Inventory);
    }

    [Fact]
    public void Export_round_trips_the_product_columns_it_wrote()
    {
        var file = _workbook.WriteProducts(OneProduct(), NoVariants, TwoStockLines(), Categories);

        var row = Assert.Single(_workbook.Read(new MemoryStream(file)).Products);

        Assert.Equal("Galaxy S24", row.Name);
        Assert.Equal("galaxy-s24", row.Slug);
        Assert.Equal("7", row.CategoryId);
        Assert.Equal("New", row.Condition);
        Assert.Equal("29990000", row.BasePrice);
    }

    [Fact]
    public void Typing_a_quantity_into_an_export_receives_exactly_that_line()
    {
        var file = _workbook.WriteProducts(OneProduct(), NoVariants, TwoStockLines(), Categories);

        // The seller fills in the first stock line only.
        var edited = EditInventory(file, dataRow: 2, quantity: 8, unitCost: 24_000_000m);

        var row = Assert.Single(_workbook.Read(new MemoryStream(edited)).Inventory);
        Assert.Equal("galaxy-s24", row.Slug);
        Assert.Equal("8", row.Quantity);
        Assert.Equal("24000000", row.UnitCost);
        Assert.Null(row.VariantSku);
    }

    [Fact]
    public void A_variant_line_keeps_the_sku_that_addresses_it()
    {
        var file = _workbook.WriteProducts(OneProduct(), NoVariants, TwoStockLines(), Categories);

        var edited = EditInventory(file, dataRow: 3, quantity: 4, unitCost: 25_000_000m);

        var row = Assert.Single(_workbook.Read(new MemoryStream(edited)).Inventory);
        Assert.Equal("S24-256-BLK", row.VariantSku);
        Assert.Equal("4", row.Quantity);
    }

    /* --------------------------------------------------------------- template */

    [Fact]
    public void Template_offers_a_worked_inventory_example()
    {
        var file = _workbook.WriteTemplate(Categories);

        var read = _workbook.Read(new MemoryStream(file));

        Assert.NotEmpty(read.Products);
        var stock = Assert.Single(read.Inventory);
        Assert.Equal("galaxy-s24-ultra-256gb", stock.Slug);
        Assert.Equal("10", stock.Quantity);
        Assert.Equal("24500000", stock.UnitCost);
    }

    /* ------------------------------------------------------- tolerated shapes */

    [Fact]
    public void A_workbook_with_no_inventory_sheet_still_imports_its_products()
    {
        // What every file saved before the Inventory sheet existed looks like.
        var file = DeleteSheet(_workbook.WriteProducts(OneProduct(), NoVariants, TwoStockLines(), Categories), "Inventory");

        var read = _workbook.Read(new MemoryStream(file));

        Assert.Single(read.Products);
        Assert.Empty(read.Inventory);
    }

    [Fact]
    public void A_workbook_with_only_an_inventory_sheet_is_a_stock_delivery()
    {
        // Receiving stock should not require carrying the whole catalogue along.
        var file = _workbook.WriteProducts(OneProduct(), NoVariants, TwoStockLines(), Categories);
        var edited = EditInventory(file, dataRow: 2, quantity: 6, unitCost: 1_000m);
        var stockOnly = DeleteSheet(edited, "Products");

        var read = _workbook.Read(new MemoryStream(stockOnly));

        Assert.Empty(read.Products);
        var row = Assert.Single(read.Inventory);
        Assert.Equal("6", row.Quantity);
    }

    [Fact]
    public void Header_names_are_matched_loosely()
    {
        var file = _workbook.WriteProducts(OneProduct(), NoVariants, TwoStockLines(), Categories);
        var renamed = Mutate(file, book =>
        {
            var sheet = book.Worksheet("Inventory");
            sheet.Cell(1, 5).SetValue("  quantity ");
            sheet.Cell(1, 6).SetValue("Unit Cost");
            sheet.Cell(2, 5).SetValue(3);
            sheet.Cell(2, 6).SetValue(500);
        });

        var row = Assert.Single(_workbook.Read(new MemoryStream(renamed)).Inventory);
        Assert.Equal("3", row.Quantity);
        Assert.Equal("500", row.UnitCost);
    }

    [Fact]
    public void A_products_sheet_without_a_name_column_is_rejected_by_name()
    {
        var file = Mutate(
            _workbook.WriteProducts(OneProduct(), NoVariants, TwoStockLines(), Categories),
            book => book.Worksheet("Products").Cell(1, 6).SetValue("Titel"));

        var error = Assert.Throws<AppException>(() => _workbook.Read(new MemoryStream(file)));
        Assert.Contains("Name", error.Message);
    }

    [Fact]
    public void A_file_that_is_not_a_workbook_is_reported_as_such()
    {
        var notAWorkbook = new MemoryStream("slug,quantity\ngalaxy,4"u8.ToArray());

        var error = Assert.Throws<AppException>(() => _workbook.Read(notAWorkbook));
        Assert.Contains(".xlsx", error.Message);
    }

    /* ----------------------------------------------------------------- helpers */

    private static byte[] EditInventory(byte[] source, int dataRow, int quantity, decimal unitCost) =>
        Mutate(source, book =>
        {
            var sheet = book.Worksheet("Inventory");
            sheet.Cell(dataRow, 5).SetValue(quantity);
            sheet.Cell(dataRow, 6).SetValue(unitCost);
        });

    private static byte[] DeleteSheet(byte[] source, string name) =>
        Mutate(source, book => book.Worksheet(name).Delete());

    private static byte[] Mutate(byte[] source, Action<XLWorkbook> edit)
    {
        using var book = new XLWorkbook(new MemoryStream(source));
        edit(book);
        using var buffer = new MemoryStream();
        book.SaveAs(buffer);
        return buffer.ToArray();
    }
}
