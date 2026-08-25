using AIDR.Api.Extensions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/seller")]
[Authorize(Policy = "Seller")]
public sealed class SellerFinanceController : ControllerBase
{
    private readonly ISellerFinanceService _finance;

    public SellerFinanceController(ISellerFinanceService finance) => _finance = finance;

    /// <summary>Shop KPIs: orders, recognized revenue, low stock, pending products, wallet snapshot.</summary>
    [HttpGet("dashboard")]
    public async Task<ActionResult<ApiResult<SellerDashboardDto>>> GetDashboard(
        CancellationToken cancellationToken)
    {
        var result = await _finance.GetDashboardAsync(User.GetUserId(), cancellationToken);
        return Ok(ApiResult<SellerDashboardDto>.Ok(result));
    }

    /// <summary>
    /// Sales report by day, week, or month with COGS and gross margin from lot cost snapshots.
    /// </summary>
    [HttpGet("reports")]
    public async Task<ActionResult<ApiResult<SellerSalesReportDto>>> GetReports(
        [FromQuery] SellerSalesReportQueryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _finance.GetSalesReportAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<SellerSalesReportDto>.Ok(result));
    }

    /// <summary>Wallet available/pending balances and paged ledger history.</summary>
    [HttpGet("wallet")]
    public async Task<ActionResult<ApiResult<SellerWalletDto>>> GetWallet(
        [FromQuery] SellerWalletQueryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _finance.GetWalletAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<SellerWalletDto>.Ok(result));
    }
}
