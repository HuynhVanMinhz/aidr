using AIDR.Modules.Discovery.Abstractions;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/categories")]
[AllowAnonymous]
public sealed class CategoriesController : ControllerBase
{
    private readonly IDiscoveryService _discovery;

    public CategoriesController(IDiscoveryService discovery) => _discovery = discovery;

    /// <summary>Get the active category tree for catalog navigation.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<IReadOnlyList<CategoryTreeNodeDto>>>> GetTree(
        CancellationToken cancellationToken)
    {
        var result = await _discovery.GetCategoryTreeAsync(cancellationToken);
        return Ok(ApiResult<IReadOnlyList<CategoryTreeNodeDto>>.Ok(result));
    }
}
