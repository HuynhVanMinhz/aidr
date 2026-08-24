using AIDR.Api.Extensions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/seller/products")]
[Authorize(Policy = "Seller")]
public sealed class SellerProductsController : ControllerBase
{
    private readonly ISellerProductService _products;
    private readonly ISellerInventoryService _inventory;

    public SellerProductsController(ISellerProductService products, ISellerInventoryService inventory)
    {
        _products = products;
        _inventory = inventory;
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
