using AIDR.Api.Extensions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Exceptions;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/seller/products")]
[Authorize(Policy = "Seller")]
public sealed class SellerProductsController : ControllerBase
{
    /// <summary>Excel refuses to open anything much larger, and so should we.</summary>
    private const long MaxImportBytes = 10 * 1024 * 1024;

    private const string XlsxContentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private readonly ISellerProductService _products;
    private readonly ISellerInventoryService _inventory;
    private readonly ISellerProductExcelService _excel;

    public SellerProductsController(
        ISellerProductService products,
        ISellerInventoryService inventory,
        ISellerProductExcelService excel)
    {
        _products = products;
        _inventory = inventory;
        _excel = excel;
    }

    /// <summary>List products belonging to the current seller's shop.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<PagedResult<SellerProductListItemDto>>>> List(
        [FromQuery] SellerProductQueryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _products.ListAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<PagedResult<SellerProductListItemDto>>.Ok(result));
    }

    /// <summary>Get a product owned by the current seller.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResult<SellerProductDetailDto>>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _products.GetByIdAsync(User.GetUserId(), id, cancellationToken);
        return Ok(ApiResult<SellerProductDetailDto>.Ok(result));
    }

    /// <summary>Download the seller's catalogue as .xlsx, using the same filters as the list.</summary>
    [HttpGet("export")]
    public async Task<IActionResult> Export(
        [FromQuery] SellerProductQueryRequest request,
        CancellationToken cancellationToken)
    {
        var bytes = await _excel.ExportAsync(User.GetUserId(), request, cancellationToken);
        return File(bytes, XlsxContentType, $"products-{DateTime.UtcNow:yyyyMMdd-HHmm}.xlsx");
    }

    /// <summary>Download an empty workbook with the headers, an example row and the category list.</summary>
    [HttpGet("import-template")]
    public async Task<IActionResult> ImportTemplate(CancellationToken cancellationToken)
    {
        var bytes = await _excel.BuildTemplateAsync(User.GetUserId(), cancellationToken);
        return File(bytes, XlsxContentType, "product-import-template.xlsx");
    }

    /// <summary>
    /// Check a workbook without writing anything: what each row would do, and what
    /// is wrong with it. The seller confirms this before <see cref="Import"/> runs.
    /// </summary>
    [HttpPost("import/preview")]
    [RequestSizeLimit(MaxImportBytes)]
    public async Task<ActionResult<ApiResult<SellerProductImportPreviewDto>>> PreviewImport(
        IFormFile file,
        CancellationToken cancellationToken)
    {
        await using var stream = await ReadUploadAsync(file, cancellationToken);
        var result = await _excel.PreviewImportAsync(User.GetUserId(), stream, cancellationToken);
        return Ok(ApiResult<SellerProductImportPreviewDto>.Ok(result));
    }

    /// <summary>Create or update products from a workbook. Rows with errors are skipped and reported.</summary>
    [HttpPost("import")]
    [RequestSizeLimit(MaxImportBytes)]
    public async Task<ActionResult<ApiResult<SellerProductImportResultDto>>> Import(
        IFormFile file,
        CancellationToken cancellationToken)
    {
        await using var stream = await ReadUploadAsync(file, cancellationToken);
        var result = await _excel.ImportAsync(User.GetUserId(), stream, cancellationToken);

        var summary = $"{result.Created} created, {result.Updated} updated, {result.Failed} skipped.";
        if (result.StockLotsReceived > 0 || result.StockFailed > 0)
        {
            summary +=
                $" {result.StockUnitsReceived} units received in {result.StockLotsReceived} lot(s)" +
                $", {result.StockFailed} lot(s) skipped.";
        }

        return Ok(ApiResult<SellerProductImportResultDto>.Ok(result, summary));
    }

    /// <summary>
    /// The workbook reader needs to seek, which an upload stream cannot do, so the
    /// file is buffered, bounded by the request size limit above.
    /// </summary>
    private static async Task<MemoryStream> ReadUploadAsync(
        IFormFile? file,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            throw new AppException("Choose an .xlsx file to import.");

        if (file.Length > MaxImportBytes)
            throw new AppException($"The file must be smaller than {MaxImportBytes / (1024 * 1024)} MB.");

        var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, cancellationToken);
        buffer.Position = 0;
        return buffer;
    }

    /// <summary>Create a product in Pending status for admin moderation.</summary>
    [HttpPost]
    public async Task<ActionResult<ApiResult<SellerProductDetailDto>>> Create(
        [FromBody] CreateSellerProductRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _products.CreateAsync(User.GetUserId(), request, cancellationToken);
        return CreatedAtAction(
            nameof(GetById),
            new { id = result.ProductId },
            ApiResult<SellerProductDetailDto>.Ok(result, "Product created."));
    }

    /// <summary>Update product details and reset status to Pending.</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResult<SellerProductDetailDto>>> Update(
        Guid id,
        [FromBody] UpdateSellerProductRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _products.UpdateAsync(User.GetUserId(), id, request, cancellationToken);
        return Ok(ApiResult<SellerProductDetailDto>.Ok(result, "Product updated."));
    }

    /// <summary>Soft-delete a product (status Deleted).</summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResult<object>>> Delete(
        Guid id,
        CancellationToken cancellationToken)
    {
        await _products.DeleteAsync(User.GetUserId(), id, cancellationToken);
        return Ok(ApiResult<object>.Ok(new { }, "Product deleted."));
    }

    /// <summary>Attach Cloudinary image URLs to a product.</summary>
    [HttpPost("{id:guid}/images")]
    public async Task<ActionResult<ApiResult<SellerProductDetailDto>>> UploadImages(
        Guid id,
        [FromBody] UploadSellerProductImagesRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _products.UploadImagesAsync(User.GetUserId(), id, request, cancellationToken);
        return Ok(ApiResult<SellerProductDetailDto>.Ok(result, "Product images saved."));
    }

    /// <summary>Get stock, reserved quantity, lots, and recent inventory movements.</summary>
    [HttpGet("{id:guid}/inventory")]
    public async Task<ActionResult<ApiResult<SellerInventoryDetailDto>>> GetInventory(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _inventory.GetByProductIdAsync(User.GetUserId(), id, cancellationToken);
        return Ok(ApiResult<SellerInventoryDetailDto>.Ok(result));
    }

    /// <summary>Update the low-stock threshold for a product.</summary>
    [HttpPatch("{id:guid}/inventory")]
    public async Task<ActionResult<ApiResult<SellerInventoryDetailDto>>> UpdateInventorySettings(
        Guid id,
        [FromBody] UpdateSellerInventoryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _inventory.UpdateLowStockThresholdAsync(User.GetUserId(), id, request, cancellationToken);
        return Ok(ApiResult<SellerInventoryDetailDto>.Ok(result, "Low-stock threshold updated."));
    }

    /// <summary>Manually adjust on-hand quantity and write an inventory transaction.</summary>
    [HttpPost("{id:guid}/inventory/adjust")]
    public async Task<ActionResult<ApiResult<SellerInventoryDetailDto>>> AdjustInventory(
        Guid id,
        [FromBody] AdjustSellerInventoryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _inventory.AdjustAsync(User.GetUserId(), id, request, cancellationToken);
        return Ok(ApiResult<SellerInventoryDetailDto>.Ok(result, "Inventory adjusted."));
    }

    /// <summary>Import a new stock lot with unit cost. Existing lots are not modified.</summary>
    [HttpPost("{id:guid}/lots")]
    public async Task<ActionResult<ApiResult<SellerInventoryDetailDto>>> ImportLot(
        Guid id,
        [FromBody] ImportStockLotRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _inventory.ImportLotAsync(User.GetUserId(), id, request, cancellationToken);
        return Ok(ApiResult<SellerInventoryDetailDto>.Ok(result, "Stock lot imported."));
    }

    /// <summary>Update catalog selling prices and append price history. Lot unit costs are unchanged.</summary>
    [HttpPatch("{id:guid}/price")]
    public async Task<ActionResult<ApiResult<SellerPriceUpdateDto>>> UpdatePrice(
        Guid id,
        [FromBody] UpdateSellingPriceRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _inventory.UpdateSellingPriceAsync(User.GetUserId(), id, request, cancellationToken);
        return Ok(ApiResult<SellerPriceUpdateDto>.Ok(result, "Selling price updated."));
    }
}
