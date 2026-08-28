using AIDR.Api.Extensions;
using AIDR.Modules.AI.Abstractions;
using AIDR.Modules.Discovery.Abstractions;
using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/products")]
[AllowAnonymous]
public sealed class ProductsController : ControllerBase
{
    private readonly IDiscoveryService _discovery;
    private readonly IRecommendationService _recommendations;

    public ProductsController(IDiscoveryService discovery, IRecommendationService recommendations)
    {
        _discovery = discovery;
        _recommendations = recommendations;
    }

    /// <summary>List approved catalog products with optional filters and sort.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<PagedResult<ProductListItemDto>>>> List(
        [FromQuery] ProductQueryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _discovery.ListProductsAsync(request, cancellationToken);
        return Ok(ApiResult<PagedResult<ProductListItemDto>>.Ok(result));
    }

    /// <summary>Search approved products by keyword, with filters and sort.</summary>
    [HttpGet("search")]
    public async Task<ActionResult<ApiResult<PagedResult<ProductListItemDto>>>> Search(
        [FromQuery] ProductQueryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _discovery.SearchProductsAsync(request, cancellationToken);
        return Ok(ApiResult<PagedResult<ProductListItemDto>>.Ok(result));
    }

    /// <summary>
    /// Resolve several approved products by id for link previews (e.g. product cards in chat).
    /// Records no view, so rendering a shared link never inflates product analytics.
    /// </summary>
    [HttpGet("lookup")]
    public async Task<ActionResult<ApiResult<IReadOnlyList<ProductListItemDto>>>> Lookup(
        [FromQuery] string? ids,
        CancellationToken cancellationToken)
    {
        var parsed = (ids ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(part => Guid.TryParse(part, out var id) ? id : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .ToList();

        var result = await _discovery.LookupProductsAsync(parsed, cancellationToken);
        return Ok(ApiResult<IReadOnlyList<ProductListItemDto>>.Ok(result));
    }

    /// <summary>Distinct brand filter options for catalog sidebar.</summary>
    [HttpGet("brands")]
    public async Task<ActionResult<ApiResult<IReadOnlyList<BrandFilterOptionDto>>>> Brands(
        CancellationToken cancellationToken)
    {
        var result = await _discovery.GetBrandFilterOptionsAsync(cancellationToken);
        return Ok(ApiResult<IReadOnlyList<BrandFilterOptionDto>>.Ok(result));
    }

    /// <summary>Get approved product detail and record a view.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResult<ProductDetailDto>>> GetById(
        Guid id,
        [FromHeader(Name = "X-Session-Id")] string? sessionId,
        CancellationToken cancellationToken)
    {
        Guid? viewerUserId = null;
        if (User.Identity?.IsAuthenticated == true && User.TryGetUserId(out var userId))
            viewerUserId = userId;

        var result = await _discovery.GetProductAsync(id, viewerUserId, sessionId, cancellationToken);
        return Ok(ApiResult<ProductDetailDto>.Ok(result));
    }

    /// <summary>List similar approved products for cross-sell on product detail.</summary>
    [HttpGet("{id:guid}/similar")]
    public async Task<ActionResult<ApiResult<IReadOnlyList<SimilarProductDto>>>> Similar(
        Guid id,
        [FromQuery] SimilarProductsQueryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _recommendations.GetSimilarProductsAsync(id, request, cancellationToken);
        return Ok(ApiResult<IReadOnlyList<SimilarProductDto>>.Ok(result));
    }
}
