using AIDR.Api.Extensions;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/admin/accounts")]
[Authorize(Policy = "Admin")]
public sealed class AdminAccountsController : ControllerBase
{
    private readonly IAdminAccountService _accounts;

    public AdminAccountsController(IAdminAccountService accounts) => _accounts = accounts;

    /// <summary>
    /// List user accounts with roles and status.
    /// Default status/role is all; supports q search and server-side paging.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResult<AdminAccountListResultDto>>> List(
        [FromQuery] string? status,
        [FromQuery] string? role,
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var result = await _accounts.ListAsync(status, role, q, page, pageSize, cancellationToken);
        return Ok(ApiResult<AdminAccountListResultDto>.Ok(result));
    }

    /// <summary>Get a user account by id.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResult<AdminAccountDto>>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _accounts.GetByIdAsync(id, cancellationToken);
        return Ok(ApiResult<AdminAccountDto>.Ok(result));
    }

    /// <summary>Lock a user account (status Active → Locked).</summary>
    [HttpPost("{id:guid}/lock")]
    public async Task<ActionResult<ApiResult<AdminAccountDto>>> Lock(
        Guid id,
        CancellationToken cancellationToken)
    {
        var adminUserId = User.GetUserId();
        var result = await _accounts.LockAsync(id, adminUserId, cancellationToken);
        return Ok(ApiResult<AdminAccountDto>.Ok(result, "Account locked."));
    }

    /// <summary>Unlock a user account (status Locked → Active).</summary>
    [HttpPost("{id:guid}/unlock")]
    public async Task<ActionResult<ApiResult<AdminAccountDto>>> Unlock(
        Guid id,
        CancellationToken cancellationToken)
    {
        var adminUserId = User.GetUserId();
        var result = await _accounts.UnlockAsync(id, adminUserId, cancellationToken);
        return Ok(ApiResult<AdminAccountDto>.Ok(result, "Account unlocked."));
    }
}
