using AIDR.Api.Extensions;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/admin/products")]
[Authorize(Policy = "Admin")]
public sealed class AdminProductsController : ControllerBase
{
    private readonly IAdminProductModerationService _products;

    public AdminProductsController(IAdminProductModerationService products) => _products = products;

    /// <summary>
    /// List products for moderation with server-side paging.
    /// Default status is Pending; pass status=all for every non-deleted status.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<AdminProductListResultDto>>> List(
        [FromQuery] string? status,
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var filter = string.IsNullOrWhiteSpace(status)
            ? AdminConstants.ProductStatusPending
            : status;

        var result = await _products.ListAsync(filter, q, page, pageSize, cancellationToken);
        return Ok(ApiResult<AdminProductListResultDto>.Ok(result));
    }

    /// <summary>Get a product by id for moderation review.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResult<AdminProductDetailDto>>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _products.GetByIdAsync(id, cancellationToken);
        return Ok(ApiResult<AdminProductDetailDto>.Ok(result));
    }

    /// <summary>Approve a pending product and record moderation history.</summary>
    [HttpPost("{id:guid}/approve")]
    public async Task<ActionResult<ApiResult<AdminProductDetailDto>>> Approve(
        Guid id,
        CancellationToken cancellationToken)
    {
        var adminUserId = User.GetUserId();
        var result = await _products.ApproveAsync(id, adminUserId, cancellationToken);
        return Ok(ApiResult<AdminProductDetailDto>.Ok(result, "Product approved."));
    }

    /// <summary>Reject a pending product with a reason and record moderation history.</summary>
    [HttpPost("{id:guid}/reject")]
    public async Task<ActionResult<ApiResult<AdminProductDetailDto>>> Reject(
        Guid id,
        [FromBody] RejectProductRequest request,
        CancellationToken cancellationToken)
    {
        var adminUserId = User.GetUserId();
        var result = await _products.RejectAsync(id, adminUserId, request, cancellationToken);
        return Ok(ApiResult<AdminProductDetailDto>.Ok(result, "Product rejected."));
    }

    /// <summary>View Approve/Reject moderation timeline for a product.</summary>
    [HttpGet("{id:guid}/moderation-history")]
    public async Task<ActionResult<ApiResult<ProductModerationHistoryResultDto>>> GetModerationHistory(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _products.GetModerationHistoryAsync(id, cancellationToken);
        return Ok(ApiResult<ProductModerationHistoryResultDto>.Ok(result));
    }
}
