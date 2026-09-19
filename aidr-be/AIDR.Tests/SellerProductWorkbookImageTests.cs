using AIDR.Infrastructure.SellerCenter;
using AIDR.Modules.SellerCenter.Abstractions;
using ClosedXML.Excel;
using ClosedXML.Excel.Drawings;
using Xunit;

namespace AIDR.Tests;

/// <summary>
/// The two things a seller does to a downloaded file that the old format had no
/// answer for: describing a configuration, and pasting a photo in rather than
/// hunting for a link to it.
/// </summary>
public class SellerProductWorkbookImageTests
{
    private readonly ClosedXmlSellerProductWorkbook _workbook = new();

    /// <summary>A real 1x1 PNG - ClosedXML reads the file's dimensions when it is added.</summary>
    private static readonly byte[] OnePixelPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

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

    private static IReadOnlyList<SellerProductVariantSheetExport> TwoVariants() =>
    [
        new()
        {
            Slug = "galaxy-s24",
            ProductName = "Galaxy S24",
            Sku = "S24-BLK",
            VariantName = "Black / 256GB",
            Attributes = "Color=Black; Storage=256GB",
            Price = 29_990_000m,
            ImageUrl = "https://cdn.test/black.jpg",
            IsActive = true,
        },
        new()
        {
            Slug = "galaxy-s24",
            ProductName = "Galaxy S24",
            Sku = "S24-PNK",
            VariantName = "Pink / 256GB",
            Attributes = "Color=Pink; Storage=256GB",
            Price = 30_490_000m,
            SalePrice = 29_490_000m,
            ImageUrl = "https://cdn.test/pink.jpg",
            IsActive = false,
        },
    ];

    /* ---------------------------------------------------------------- variants */

    [Fact]
    public void Export_round_trips_the_variant_columns_it_wrote()
    {
        var file = _workbook.WriteProducts(OneProduct(), TwoVariants(), [], Categories);

        var read = _workbook.Read(new MemoryStream(file));

        Assert.Collection(
            read.Variants,
            black =>
            {
                Assert.Equal("galaxy-s24", black.Slug);
                Assert.Equal("S24-BLK", black.Sku);
                Assert.Equal("Color=Black; Storage=256GB", black.Attributes);
                Assert.Equal("29990000", black.Price);
                Assert.Equal("https://cdn.test/black.jpg", black.ImageUrl);
                Assert.Equal("Yes", black.IsActive);
            },
            pink =>
            {
                Assert.Equal("S24-PNK", pink.Sku);
                Assert.Equal("30490000", pink.Price);
                Assert.Equal("29490000", pink.SalePrice);
                Assert.Equal("No", pink.IsActive);
            });
    }

    [Fact]
    public void A_workbook_with_no_variants_sheet_says_nothing_about_variants()
    {
        // Every file saved before the Variants sheet existed. Reading it as "this
        // product has no configurations" would delete them.
        var file = Mutate(
            _workbook.WriteProducts(OneProduct(), TwoVariants(), [], Categories),
            book => book.Worksheet("Variants").Delete());

        var read = _workbook.Read(new MemoryStream(file));

        Assert.NotEmpty(read.Products);
        Assert.Empty(read.Variants);
    }

    [Fact]
    public void The_template_shows_a_worked_variant_example()
    {
        var file = _workbook.WriteTemplate(Categories);

        var read = _workbook.Read(new MemoryStream(file));

        Assert.Equal(2, read.Variants.Count);
        Assert.All(read.Variants, v => Assert.Equal("galaxy-s24-ultra-256gb", v.Slug));
        Assert.Contains(read.Variants, v => v.Attributes == "Color=Violet; Storage=256GB");
    }

    /* ---------------------------------------------------------------- pictures */

    [Fact]
    public void A_picture_anchored_on_a_product_row_is_read_as_that_rows_photo()
    {
        var file = Mutate(
            _workbook.WriteProducts(OneProduct(), TwoVariants(), [], Categories),
            book => Paste(book.Worksheet("Products"), row: 2, column: 20));

        var read = _workbook.Read(new MemoryStream(file));

        var product = Assert.Single(read.Products);
        var picture = Assert.Single(product.Images);
        Assert.Equal("png", picture.Extension);
        Assert.Equal(2, picture.RowNumber);
        Assert.Equal(OnePixelPng, picture.Content);
    }

    [Fact]
    public void A_picture_belongs_to_the_row_it_sits_on_not_to_the_first_one()
    {
        var file = Mutate(
            _workbook.WriteProducts(OneProduct(), TwoVariants(), [], Categories),
            book => Paste(book.Worksheet("Variants"), row: 3, column: 8));

        var read = _workbook.Read(new MemoryStream(file));

        Assert.Collection(
            read.Variants,
            black => Assert.Empty(black.Images),
            pink => Assert.Single(pink.Images));
    }

    [Fact]
    public void A_free_floating_picture_still_lands_on_a_row()
    {
        // What a pasted screenshot often is: positioned by offset rather than
        // anchored to a cell. Dropping it would look like the photo was ignored.
        var file = Mutate(
            _workbook.WriteProducts(OneProduct(), TwoVariants(), [], Categories),
            book =>
            {
                var sheet = book.Worksheet("Products");
                // 30px down is past the header row and inside the product's own row.
                sheet.AddPicture(new MemoryStream(OnePixelPng))
                    .WithPlacement(XLPicturePlacement.FreeFloating)
                    .MoveTo(600, 30);
            });

        var read = _workbook.Read(new MemoryStream(file));

        Assert.Single(Assert.Single(read.Products).Images);
    }

    [Fact]
    public void An_export_with_no_pictures_reads_back_none()
    {
        var file = _workbook.WriteProducts(OneProduct(), TwoVariants(), [], Categories);

        var read = _workbook.Read(new MemoryStream(file));

        Assert.All(read.Products, p => Assert.Empty(p.Images));
        Assert.All(read.Variants, v => Assert.Empty(v.Images));
    }

    /* ----------------------------------------------------------------- helpers */

    private static void Paste(IXLWorksheet sheet, int row, int column) =>
        sheet.AddPicture(new MemoryStream(OnePixelPng))
            .MoveTo(sheet.Cell(row, column))
            .WithPlacement(XLPicturePlacement.Move);

    private static byte[] Mutate(byte[] source, Action<XLWorkbook> edit)
    {
        using var book = new XLWorkbook(new MemoryStream(source));
        edit(book);
        using var buffer = new MemoryStream();
        book.SaveAs(buffer);
        return buffer.ToArray();
    }
}
