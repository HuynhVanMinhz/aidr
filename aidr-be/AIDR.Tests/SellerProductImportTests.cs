using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Modules.SellerCenter.Services;
using AIDR.Shared.Dtos.Seller;
using Xunit;

namespace AIDR.Tests;

/// <summary>
/// The rules the import applies to a sheet, tested through the service with the
/// spreadsheet itself stubbed out — these are decisions about stock and products,
/// not about Excel.
/// </summary>
public class SellerProductImportTests
{
    private static readonly Guid PhoneId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid VariantBlackId = Guid.Parse("44444444-4444-4444-4444-444444444444");

    private readonly FakeProductRepository _repository = new();
    private readonly FakeProductService _products;
    private readonly RecordingInventoryService _inventory = new();
    private readonly StubWorkbook _workbook = new();
    private readonly StubImportImageStore _images = new();
    private readonly SellerProductExcelService _service;

    public SellerProductImportTests()
    {
        _products = new FakeProductService(_repository);
        _service = new SellerProductExcelService(_repository, _products, _inventory, _workbook, _images);
    }

    private Task<SellerProductImportPreviewDto> Preview() =>
        _service.PreviewImportAsync(FakeProductRepository.OwnerId, Stream.Null);

    private Task<SellerProductImportResultDto> Import() =>
        _service.ImportAsync(FakeProductRepository.OwnerId, Stream.Null);

    private void GivenSingleConfigProduct() =>
        _repository.Add(new SellerProductRecord
        {
            ProductId = PhoneId,
            ShopId = FakeProductRepository.ShopId,
            Name = "Galaxy S24",
            Slug = "galaxy-s24",
            ConditionType = "New",
            Status = "Active",
        });

    private void GivenProductWithVariants() =>
        _repository.Add(new SellerProductRecord
        {
            ProductId = PhoneId,
            ShopId = FakeProductRepository.ShopId,
            Name = "Galaxy S24",
            Slug = "galaxy-s24",
            ConditionType = "New",
            Status = "Active",
            Variants =
            [
                new() { VariantId = VariantBlackId, Sku = "S24-256-BLK", VariantName = "256GB / Black" },
                new() { VariantId = Guid.NewGuid(), Sku = "S24-512-GRY", VariantName = "512GB / Grey" },
            ],
        });

    private static SellerProductSheetRow ProductRow(string name, string slug) => new()
    {
        RowNumber = 2,
        Name = name,
        Slug = slug,
        CategoryId = "7",
        BasePrice = "29990000",
    };

    private static SellerInventorySheetRow StockRow(
        string? slug = "galaxy-s24",
        string? quantity = "5",
        string? unitCost = "24000000",
        string? variantSku = null,
        int rowNumber = 2) => new()
        {
            RowNumber = rowNumber,
            Slug = slug,
            Quantity = quantity,
            UnitCost = unitCost,
            VariantSku = variantSku,
        };

    /* ------------------------------------------------------- receiving stock */

    [Fact]
    public async Task A_stock_row_receives_a_lot_against_the_matching_product()
    {
        GivenSingleConfigProduct();
        _workbook.Inventory.Add(StockRow());

        var result = await Import();

        var (productId, request) = Assert.Single(_inventory.Lots);
        Assert.Equal(PhoneId, productId);
        Assert.Equal(5, request.Quantity);
        Assert.Equal(24_000_000m, request.UnitCost);
        Assert.Null(request.VariantId);
        Assert.Equal(1, result.StockLotsReceived);
        Assert.Equal(5, result.StockUnitsReceived);
    }

    [Fact]
    public async Task Stock_can_be_received_for_a_product_the_same_file_creates()
    {
        // The point of one file: add the product and stock it in a single pass.
        _workbook.Products.Add(ProductRow("Galaxy S25", "galaxy-s25"));
        _workbook.Inventory.Add(StockRow(slug: "galaxy-s25", quantity: "3"));

        var result = await Import();

        Assert.Equal(1, result.Created);
        var (_, request) = Assert.Single(_inventory.Lots);
        Assert.Equal(3, request.Quantity);
    }

    [Fact]
    public async Task Stock_is_not_received_when_the_row_that_would_create_its_product_fails()
    {
        _products.RejectSlugs.Add("galaxy-s25");
        _workbook.Products.Add(ProductRow("Galaxy S25", "galaxy-s25"));
        _workbook.Inventory.Add(StockRow(slug: "galaxy-s25"));

        var result = await Import();

        Assert.Empty(_inventory.Lots);
        Assert.Equal(1, result.StockFailed);
        Assert.Contains("did not run", Assert.Single(result.FailedStockRows).Errors.Single());
    }

    [Fact]
    public async Task A_refused_lot_does_not_stop_the_others()
    {
        GivenSingleConfigProduct();
        _inventory.RejectProducts.Add(PhoneId);
        _workbook.Products.Add(ProductRow("Galaxy S25", "galaxy-s25"));
        _workbook.Inventory.Add(StockRow(rowNumber: 2));
        _workbook.Inventory.Add(StockRow(slug: "galaxy-s25", quantity: "2", rowNumber: 3));

        var result = await Import();

        Assert.Equal(1, result.StockFailed);
        Assert.Equal(1, result.StockLotsReceived);
        Assert.Equal(2, result.StockUnitsReceived);
    }

    /* ------------------------------------------------------------- variants */

    [Fact]
    public async Task A_variant_sku_resolves_to_that_variant()
    {
        GivenProductWithVariants();
        _workbook.Inventory.Add(StockRow(variantSku: "S24-256-BLK"));

        await Import();

        var (_, request) = Assert.Single(_inventory.Lots);
        Assert.Equal(VariantBlackId, request.VariantId);
    }

    [Fact]
    public async Task A_variant_product_without_a_sku_is_refused_and_lists_the_choices()
    {
        // Guessing a configuration would put the stock, and its cost, on the wrong one.
        GivenProductWithVariants();
        _workbook.Inventory.Add(StockRow());

        var preview = await Preview();

        Assert.Equal(1, preview.StockErrorCount);
        var error = Assert.Single(Assert.Single(preview.StockRows).Errors);
        Assert.Contains("S24-256-BLK", error);
        Assert.Contains("S24-512-GRY", error);
    }

    [Fact]
    public async Task An_unknown_variant_sku_is_refused()
    {
        GivenProductWithVariants();
        _workbook.Inventory.Add(StockRow(variantSku: "NOPE"));

        var preview = await Preview();

        Assert.Contains("NOPE", Assert.Single(Assert.Single(preview.StockRows).Errors));
    }

    [Fact]
    public async Task A_sku_on_a_single_configuration_product_is_refused()
    {
        GivenSingleConfigProduct();
        _workbook.Inventory.Add(StockRow(variantSku: "S24-256-BLK"));

        var preview = await Preview();

        Assert.Contains("single configuration", Assert.Single(Assert.Single(preview.StockRows).Errors));
    }

    /* ------------------------------------------------------------ validation */

    [Theory]
    [InlineData(null, "24000000", "Quantity is required")]
    [InlineData("0", "24000000", "between 1 and")]
    [InlineData("-4", "24000000", "between 1 and")]
    [InlineData("two", "24000000", "not a whole number")]
    [InlineData("5", null, "UnitCost is required")]
    [InlineData("5", "abc", "not a number")]
    public async Task A_row_that_cannot_be_received_says_why(string? quantity, string? cost, string expected)
    {
        GivenSingleConfigProduct();
        _workbook.Inventory.Add(StockRow(quantity: quantity, unitCost: cost));

        var preview = await Preview();

        Assert.Equal(0, preview.StockRowCount);
        Assert.Contains(expected, string.Join(" ", Assert.Single(preview.StockRows).Errors));
    }

    [Fact]
    public async Task A_slug_that_matches_nothing_is_refused_rather_than_guessed()
    {
        _workbook.Inventory.Add(StockRow(slug: "not-a-product"));

        var preview = await Preview();

        Assert.Contains("No product with slug", Assert.Single(Assert.Single(preview.StockRows).Errors));
        Assert.Equal(0, preview.StockRowCount);
    }

    [Fact]
    public async Task A_bad_row_is_never_written()
    {
        GivenProductWithVariants();
        _workbook.Inventory.Add(StockRow());

        await Import();

        Assert.Empty(_inventory.Lots);
    }

    /* -------------------------------------------------------------- preview */

    [Fact]
    public async Task Preview_totals_the_units_the_file_would_receive()
    {
        GivenSingleConfigProduct();
        _workbook.Inventory.Add(StockRow(quantity: "5", rowNumber: 2));
        _workbook.Inventory.Add(StockRow(quantity: "7", rowNumber: 3));

        var preview = await Preview();

        Assert.Equal(2, preview.StockRowCount);
        Assert.Equal(12, preview.StockUnitCount);
    }

    [Fact]
    public async Task Repeated_rows_for_one_configuration_are_flagged_as_separate_lots()
    {
        // Legal, but also exactly what a duplicated paste looks like.
        GivenSingleConfigProduct();
        _workbook.Inventory.Add(StockRow(quantity: "5", rowNumber: 2));
        _workbook.Inventory.Add(StockRow(quantity: "5", rowNumber: 3));

        var preview = await Preview();

        var warning = Assert.Single(preview.Warnings);
        Assert.Contains("2, 3", warning);
        Assert.Contains("10 units", warning);
    }

    [Fact]
    public async Task Preview_writes_nothing()
    {
        GivenSingleConfigProduct();
        _workbook.Products.Add(ProductRow("Galaxy S25", "galaxy-s25"));
        _workbook.Inventory.Add(StockRow());

        await Preview();

        Assert.Empty(_inventory.Lots);
        Assert.Empty(_products.Created);
        Assert.Empty(_products.Updated);
    }

    [Fact]
    public async Task A_file_with_only_stock_rows_is_a_valid_import()
    {
        GivenSingleConfigProduct();
        _workbook.Inventory.Add(StockRow());

        var result = await Import();

        Assert.Equal(0, result.Created);
        Assert.Equal(1, result.StockLotsReceived);
    }
}
