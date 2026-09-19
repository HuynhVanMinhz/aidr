using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Modules.SellerCenter.Services;
using AIDR.Shared.Dtos.Seller;
using Xunit;

namespace AIDR.Tests;

/// <summary>
/// What a spreadsheet can say about configurations and photos.
///
/// The two go together on purpose: the reason to describe a variant in a sheet at
/// all is usually the picture - a shop with six colours wants six photos in, not
/// six visits to the product form.
/// </summary>
public class SellerProductImportVariantTests
{
    private static readonly Guid PhoneId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid BlackId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid PinkId = Guid.Parse("55555555-5555-5555-5555-555555555555");

    private readonly FakeProductRepository _repository = new();
    private readonly FakeProductService _products;
    private readonly RecordingInventoryService _inventory = new();
    private readonly StubWorkbook _workbook = new();
    private readonly StubImportImageStore _images = new();
    private readonly SellerProductExcelService _service;

    public SellerProductImportVariantTests()
    {
        _products = new FakeProductService(_repository);
        _service = new SellerProductExcelService(_repository, _products, _inventory, _workbook, _images);
    }

    private Task<SellerProductImportPreviewDto> Preview() =>
        _service.PreviewImportAsync(FakeProductRepository.OwnerId, Stream.Null);

    private Task<SellerProductImportResultDto> Import() =>
        _service.ImportAsync(FakeProductRepository.OwnerId, Stream.Null);

    private static SellerProductSheetRow ProductRow(
        string slug = "galaxy-s24",
        string name = "Galaxy S24",
        string? imageUrls = null,
        IReadOnlyList<SheetImage>? images = null,
        int rowNumber = 2) => new()
        {
            RowNumber = rowNumber,
            Name = name,
            Slug = slug,
            CategoryId = "7",
            BasePrice = "29990000",
            ImageUrls = imageUrls,
            Images = images ?? [],
        };

    private static SellerProductVariantSheetRow VariantRow(
        string attributes,
        string price = "29990000",
        string? sku = null,
        string? imageUrl = null,
        string? active = null,
        string slug = "galaxy-s24",
        int rowNumber = 2,
        IReadOnlyList<SheetImage>? images = null) => new()
        {
            RowNumber = rowNumber,
            Slug = slug,
            Sku = sku,
            Attributes = attributes,
            Price = price,
            ImageUrl = imageUrl,
            IsActive = active,
            Images = images ?? [],
        };

    private static SheetImage Picture(int rowNumber = 2, string extension = "png", int size = 64) => new()
    {
        Content = new byte[size],
        Extension = extension,
        RowNumber = rowNumber,
    };

    private void GivenPinkAndBlack(int blackStock = 0) =>
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
                new()
                {
                    VariantId = BlackId,
                    Sku = "S24-BLK",
                    VariantName = "Black",
                    AttributesJson = """{"Color":"Black"}""",
                    Price = 29_990_000m,
                    StockQuantity = blackStock,
                    IsActive = true,
                },
                new()
                {
                    VariantId = PinkId,
                    Sku = "S24-PNK",
                    VariantName = "Pink",
                    AttributesJson = """{"Color":"Pink"}""",
                    Price = 30_490_000m,
                    IsActive = true,
                },
            ],
        });

    /* ---------------------------------------------------------- declaring them */

    [Fact]
    public async Task Variant_rows_create_the_product_with_its_options()
    {
        _workbook.Products.Add(ProductRow("galaxy-s25", "Galaxy S25"));
        _workbook.Variants.Add(VariantRow(
            "Color=Black; Storage=256GB", sku: "S25-BLK", slug: "galaxy-s25", rowNumber: 2));
        _workbook.Variants.Add(VariantRow(
            "Color=Pink; Storage=256GB", price: "30490000", sku: "S25-PNK", slug: "galaxy-s25", rowNumber: 3));

        var result = await Import();

        Assert.Equal(1, result.Created);
        var request = Assert.Single(_products.CreateRequests);

        Assert.Collection(
            request.VariantOptions!,
            color =>
            {
                Assert.Equal("Color", color.Name);
                Assert.Equal(["Black", "Pink"], color.Values);
            },
            storage =>
            {
                Assert.Equal("Storage", storage.Name);
                Assert.Equal(["256GB"], storage.Values);
            });

        Assert.Equal(2, request.Variants!.Count);
        Assert.Equal(30_490_000m, request.Variants[1].Price);
        // Nothing to update: these configurations do not exist yet.
        Assert.All(request.Variants, v => Assert.Null(v.VariantId));
    }

    [Fact]
    public async Task A_file_with_no_variants_sheet_leaves_the_configurations_alone()
    {
        // The difference that matters: silence is not "delete every variant".
        GivenPinkAndBlack();
        _workbook.Products.Add(ProductRow());

        await Import();

        var request = Assert.Single(_products.UpdateRequests);
        Assert.Null(request.Variants);
        Assert.Null(request.VariantOptions);
    }

    [Fact]
    public async Task Editing_a_variant_keeps_the_id_it_already_had()
    {
        // Re-importing an export must not read as "delete these and add those":
        // that strands the inventory lots and order history behind each id.
        GivenPinkAndBlack();
        _workbook.Products.Add(ProductRow());
        _workbook.Variants.Add(VariantRow("Color=Black", sku: "S24-BLK", rowNumber: 2));
        _workbook.Variants.Add(VariantRow(
            "Color=Pink",
            price: "30490000",
            sku: "S24-PNK",
            imageUrl: "https://cdn.test/pink.jpg",
            rowNumber: 3));

        await Import();

        var request = Assert.Single(_products.UpdateRequests);
        Assert.Equal([BlackId, PinkId], request.Variants!.Select(v => v.VariantId).ToList());
        Assert.Equal("https://cdn.test/pink.jpg", request.Variants![1].ImageUrl);
    }

    [Fact]
    public async Task A_variant_with_no_sku_is_matched_by_its_option_values()
    {
        GivenPinkAndBlack();
        _workbook.Products.Add(ProductRow());
        _workbook.Variants.Add(VariantRow("Color=Black", rowNumber: 2));
        _workbook.Variants.Add(VariantRow("Color=Pink", price: "30490000", rowNumber: 3));

        await Import();

        var request = Assert.Single(_products.UpdateRequests);
        Assert.Equal([BlackId, PinkId], request.Variants!.Select(v => v.VariantId).ToList());
    }

    [Fact]
    public async Task Dropping_a_variant_that_still_holds_stock_is_refused_with_its_name()
    {
        GivenPinkAndBlack(blackStock: 4);
        _workbook.Products.Add(ProductRow());
        _workbook.Variants.Add(VariantRow("Color=Pink", price: "30490000", sku: "S24-PNK", rowNumber: 2));

        var preview = await Preview();

        var row = Assert.Single(preview.Rows);
        Assert.Equal("Error", row.Action);
        Assert.Contains(row.Errors, e => e.Contains("Black") && e.Contains("4 unit"));
    }

    [Fact]
    public async Task Rows_that_disagree_about_the_option_names_are_refused()
    {
        _workbook.Products.Add(ProductRow("galaxy-s25", "Galaxy S25"));
        _workbook.Variants.Add(VariantRow("Color=Black", rowNumber: 2, slug: "galaxy-s25"));
        _workbook.Variants.Add(VariantRow("Colour=Pink", rowNumber: 3, slug: "galaxy-s25"));

        var preview = await Preview();

        var row = Assert.Single(preview.Rows);
        Assert.Equal("Error", row.Action);
        Assert.Contains(row.Errors, e => e.Contains("same option names"));
        Assert.Equal(0, preview.CreateCount);
    }

    [Fact]
    public async Task Variants_for_a_product_the_file_does_not_list_are_reported_not_applied()
    {
        GivenPinkAndBlack();
        _workbook.Variants.Add(VariantRow("Color=Pink", slug: "galaxy-s24", rowNumber: 2));

        var preview = await Preview();

        Assert.Empty(preview.Rows);
        Assert.Contains(preview.Warnings, w => w.Contains("not on the Products sheet"));
    }

    [Fact]
    public async Task Stock_can_be_received_for_a_variant_the_same_file_creates()
    {
        // Create the product, its configurations, and the first delivery, in one pass.
        _workbook.Products.Add(ProductRow("galaxy-s25", "Galaxy S25"));
        _workbook.Variants.Add(VariantRow("Color=Black", sku: "S25-BLK", slug: "galaxy-s25", rowNumber: 2));
        _workbook.Inventory.Add(new SellerInventorySheetRow
        {
            RowNumber = 2,
            Slug = "galaxy-s25",
            VariantSku = "S25-BLK",
            Quantity = "3",
            UnitCost = "24000000",
        });

        var result = await Import();

        Assert.Equal(1, result.Created);
        var (_, lot) = Assert.Single(_inventory.Lots);
        Assert.Equal(3, lot.Quantity);
        Assert.NotNull(lot.VariantId);
    }

    /* ------------------------------------------------------------- photographs */

    [Fact]
    public async Task A_picture_pasted_on_a_product_row_becomes_one_of_its_photos()
    {
        _workbook.Products.Add(ProductRow(
            "galaxy-s25",
            "Galaxy S25",
            imageUrls: "https://cdn.test/front.jpg",
            images: [Picture()]));

        await Import();

        var request = Assert.Single(_products.CreateRequests);
        var uploaded = Assert.Single(_images.Saved);
        Assert.Equal("png", uploaded.Extension);

        // The typed links keep their order and the primary spot; the pasted picture
        // is added after them.
        Assert.Equal(2, request.Images!.Count);
        Assert.Equal("https://cdn.test/front.jpg", request.Images[0].ImageUrl);
        Assert.True(request.Images[0].IsPrimary);
        Assert.StartsWith("https://cdn.test/import/", request.Images[1].ImageUrl);
    }

    [Fact]
    public async Task A_picture_pasted_on_a_variant_row_becomes_that_variants_photo()
    {
        _workbook.Products.Add(ProductRow("galaxy-s25", "Galaxy S25"));
        _workbook.Variants.Add(VariantRow("Color=Pink", sku: "S25-PNK", slug: "galaxy-s25", images: [Picture()]));

        await Import();

        var request = Assert.Single(_products.CreateRequests);
        Assert.Single(_images.Saved);
        Assert.StartsWith("https://cdn.test/import/", Assert.Single(request.Variants!).ImageUrl!);
    }

    [Fact]
    public async Task A_typed_link_wins_over_a_picture_on_the_same_variant_row()
    {
        _workbook.Products.Add(ProductRow("galaxy-s25", "Galaxy S25"));
        _workbook.Variants.Add(VariantRow(
            "Color=Pink",
            sku: "S25-PNK",
            slug: "galaxy-s25",
            imageUrl: "https://cdn.test/pink.jpg",
            images: [Picture()]));

        await Import();

        var request = Assert.Single(_products.CreateRequests);
        Assert.Equal("https://cdn.test/pink.jpg", Assert.Single(request.Variants!).ImageUrl);
        Assert.Empty(_images.Saved);
    }

    [Fact]
    public async Task Previewing_a_sheet_full_of_pictures_uploads_nothing()
    {
        // A preview is a read. A seller who looks at the plan and closes the page
        // must not have filled the image host with files.
        _workbook.Products.Add(ProductRow("galaxy-s25", "Galaxy S25", images: [Picture()]));
        _workbook.Variants.Add(VariantRow("Color=Pink", slug: "galaxy-s25", images: [Picture()]));

        var preview = await Preview();

        Assert.Equal(1, preview.CreateCount);
        Assert.Empty(_images.Saved);
    }

    [Fact]
    public async Task A_picture_is_refused_when_the_server_has_no_image_host()
    {
        _images.IsConfigured = false;
        _workbook.Products.Add(ProductRow("galaxy-s25", "Galaxy S25", images: [Picture()]));

        var preview = await Preview();

        var row = Assert.Single(preview.Rows);
        Assert.Equal("Error", row.Action);
        Assert.Contains(row.Errors, e => e.Contains("no image host"));
    }

    [Fact]
    public async Task A_picture_bigger_than_the_limit_is_refused_before_it_is_sent()
    {
        _images.MaxBytes = 1024;
        _workbook.Products.Add(ProductRow("galaxy-s25", "Galaxy S25", images: [Picture(size: 4096)]));

        var preview = await Preview();

        Assert.Equal("Error", Assert.Single(preview.Rows).Action);
        Assert.Empty(_images.Saved);
    }

    [Fact]
    public async Task A_failed_upload_fails_its_own_row_and_no_other()
    {
        _images.FailWith = "The image host rejected the picture.";
        _workbook.Products.Add(ProductRow("galaxy-s25", "Galaxy S25", images: [Picture()]));
        _workbook.Products.Add(ProductRow("galaxy-s26", "Galaxy S26", rowNumber: 3));

        var result = await Import();

        Assert.Equal(1, result.Created);
        Assert.Equal(1, result.Failed);
        Assert.Contains(result.FailedRows, r => r.Errors.Any(e => e.Contains("rejected the picture")));
    }
}
