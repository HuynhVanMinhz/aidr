using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/admin/categories")]
[Authorize(Policy = "Admin")]
public sealed class AdminCategoriesController : ControllerBase
{
    private readonly IAdminCategoryService _categories;

    public AdminCategoriesController(IAdminCategoryService categories) => _categories = categories;

    /// <summary>List categories with server-side paging, optional search, and summary counts.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<AdminCategoryListResultDto>>> List(
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var result = await _categories.ListAsync(q, page, pageSize, cancellationToken);
        return Ok(ApiResult<AdminCategoryListResultDto>.Ok(result));
    }

    /// <summary>List compact category options for parent selection (not paginated).</summary>
    [HttpGet("options")]
    public async Task<ActionResult<ApiResult<IReadOnlyList<AdminCategoryOptionDto>>>> ListOptions(
        CancellationToken cancellationToken)
    {
        var result = await _categories.ListOptionsAsync(cancellationToken);
        return Ok(ApiResult<IReadOnlyList<AdminCategoryOptionDto>>.Ok(result));
    }

    /// <summary>Get a category by id.</summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApiResult<AdminCategoryDto>>> GetById(
        int id,
        CancellationToken cancellationToken)
    {
        var result = await _categories.GetByIdAsync(id, cancellationToken);
        return Ok(ApiResult<AdminCategoryDto>.Ok(result));
    }

    /// <summary>Create a new category.</summary>
    [HttpPost]
    public async Task<ActionResult<ApiResult<AdminCategoryDto>>> Create(
        [FromBody] CreateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _categories.CreateAsync(request, cancellationToken);
        return CreatedAtAction(
            nameof(GetById),
            new { id = result.CategoryId },
            ApiResult<AdminCategoryDto>.Ok(result, "Category created."));
    }

    /// <summary>Update category name, description, image, and sort order.</summary>
    [HttpPut("{id:int}")]
    public async Task<ActionResult<ApiResult<AdminCategoryDto>>> Update(
        int id,
        [FromBody] UpdateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _categories.UpdateAsync(id, request, cancellationToken);
        return Ok(ApiResult<AdminCategoryDto>.Ok(result, "Category updated."));
    }

    /// <summary>Activate or disable a category.</summary>
    [HttpPatch("{id:int}/status")]
    public async Task<ActionResult<ApiResult<AdminCategoryDto>>> UpdateStatus(
        int id,
        [FromBody] UpdateCategoryStatusRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _categories.UpdateStatusAsync(id, request, cancellationToken);
        var message = request.IsActive ? "Category activated." : "Category disabled.";
        return Ok(ApiResult<AdminCategoryDto>.Ok(result, message));
    }

    /// <summary>Delete a category when it has no products or child categories.</summary>
    [HttpDelete("{id:int}")]
    public async Task<ActionResult<ApiResult<object>>> Delete(
        int id,
        CancellationToken cancellationToken)
    {
        await _categories.DeleteAsync(id, cancellationToken);
        return Ok(ApiResult<object>.Ok(new { }, "Category deleted."));
    }
}
