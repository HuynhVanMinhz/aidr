using AIDR.Api.Extensions;
using AIDR.Modules.Settlement.Abstractions;
using AIDR.Shared.Dtos.Settlement;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/seller")]
[Authorize(Policy = "Seller")]
public sealed class SellerSettlementController : ControllerBase
{
    private readonly ISettlementService _settlements;

    public SellerSettlementController(ISettlementService settlements) => _settlements = settlements;

    /// <summary>Bank account this shop's payouts are sent to, plus its verification state.</summary>
    [HttpGet("bank-account")]
    public async Task<ActionResult<ApiResult<ShopBankAccountDto?>>> GetBankAccount(
        CancellationToken cancellationToken)
    {
        var result = await _settlements.GetSellerBankAccountAsync(User.GetUserId(), cancellationToken);
        return Ok(ApiResult<ShopBankAccountDto?>.Ok(result));
    }

    /// <summary>
    /// Register or change the payout bank account. Any change resets verification -
    /// payouts only run against an account an admin has approved.
    /// </summary>
    [HttpPut("bank-account")]
    public async Task<ActionResult<ApiResult<ShopBankAccountDto>>> UpsertBankAccount(
        [FromBody] UpsertShopBankAccountRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _settlements.UpsertSellerBankAccountAsync(
            User.GetUserId(),
            request,
            cancellationToken);

        return Ok(ApiResult<ShopBankAccountDto>.Ok(result, "Bank account saved. It needs admin verification before payouts run."));
    }

    /// <summary>Per-order settlement ledger: gross, platform fee, net, and when it is released.</summary>
    [HttpGet("settlements")]
    public async Task<ActionResult<ApiResult<SettlementEntryListDto>>> GetSettlements(
        [FromQuery] SettlementQueryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _settlements.GetSellerEntriesAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<SettlementEntryListDto>.Ok(result));
    }

    /// <summary>Money split across holding / eligible / approved / paid.</summary>
    [HttpGet("settlements/summary")]
    public async Task<ActionResult<ApiResult<SettlementSummaryDto>>> GetSummary(
        CancellationToken cancellationToken)
    {
        var result = await _settlements.GetSellerSummaryAsync(User.GetUserId(), cancellationToken);
        return Ok(ApiResult<SettlementSummaryDto>.Ok(result));
    }

    /// <summary>Payout history for this shop.</summary>
    [HttpGet("payouts")]
    public async Task<ActionResult<ApiResult<PayoutBatchListDto>>> GetPayouts(
        [FromQuery] PayoutBatchQueryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _settlements.GetSellerBatchesAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<PayoutBatchListDto>.Ok(result));
    }
}
