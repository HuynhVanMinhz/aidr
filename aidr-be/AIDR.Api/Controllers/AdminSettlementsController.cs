using AIDR.Api.Extensions;
using AIDR.Modules.Settlement.Abstractions;
using AIDR.Shared.Dtos.Settlement;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/admin/settlements")]
[Authorize(Policy = "Admin")]
public sealed class AdminSettlementsController : ControllerBase
{
    private readonly ISettlementService _settlements;

    public AdminSettlementsController(ISettlementService settlements) => _settlements = settlements;

    /// <summary>
    /// Shops whose hold window has elapsed, with the reason each one cannot be paid
    /// yet (no bank account, unverified account, below the minimum, batch already open).
    /// </summary>
    [HttpGet("eligible")]
    public async Task<ActionResult<ApiResult<IReadOnlyList<SettlementEligibleShopDto>>>> GetEligible(
        CancellationToken cancellationToken)
    {
        var result = await _settlements.GetEligibleShopsAsync(cancellationToken);
        return Ok(ApiResult<IReadOnlyList<SettlementEligibleShopDto>>.Ok(result));
    }

    /// <summary>Per-order settlement ledger across every shop.</summary>
    [HttpGet("entries")]
    public async Task<ActionResult<ApiResult<SettlementEntryListDto>>> GetEntries(
        [FromQuery] SettlementQueryRequest request,
        [FromQuery] Guid? shopId,
        CancellationToken cancellationToken)
    {
        var result = await _settlements.ListEntriesAsync(request, shopId, cancellationToken);
        return Ok(ApiResult<SettlementEntryListDto>.Ok(result));
    }

    /// <summary>Freeze one settlement (suspected fraud, dispute) so it cannot be paid out.</summary>
    [HttpPost("entries/{settlementEntryId:guid}/hold")]
    public async Task<ActionResult<ApiResult<PayoutBatchDto>>> HoldEntry(
        Guid settlementEntryId,
        [FromBody] HoldSettlementEntryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _settlements.HoldEntryAsync(settlementEntryId, request, cancellationToken);
        return Ok(ApiResult<PayoutBatchDto>.Ok(result, "Settlement put on hold."));
    }

    [HttpGet("batches")]
    public async Task<ActionResult<ApiResult<PayoutBatchListDto>>> GetBatches(
        [FromQuery] PayoutBatchQueryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _settlements.ListBatchesAsync(request, cancellationToken);
        return Ok(ApiResult<PayoutBatchListDto>.Ok(result));
    }

    /// <summary>Draft a batch: claim every eligible settlement for one shop up to the cut-off.</summary>
    [HttpPost("batches")]
    public async Task<ActionResult<ApiResult<PayoutBatchDto>>> CreateBatch(
        [FromBody] CreatePayoutBatchRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _settlements.CreateBatchAsync(request, cancellationToken);
        return Ok(ApiResult<PayoutBatchDto>.Ok(result, "Payout batch drafted."));
    }

    /// <summary>
    /// Approve the batch: the shop's net moves from pending to available, the platform
    /// recognises its commission, and (unless payouts are manual) the transfer is sent.
    /// </summary>
    [HttpPost("batches/{payoutBatchId:guid}/approve")]
    public async Task<ActionResult<ApiResult<PayoutBatchDto>>> ApproveBatch(
        Guid payoutBatchId,
        CancellationToken cancellationToken)
    {
        var result = await _settlements.ApproveBatchAsync(
            payoutBatchId,
            User.GetUserId(),
            cancellationToken);

        return Ok(ApiResult<PayoutBatchDto>.Ok(result, "Payout batch approved."));
    }

    /// <summary>Send (or re-send) an approved or failed batch through payOS.</summary>
    [HttpPost("batches/{payoutBatchId:guid}/execute")]
    public async Task<ActionResult<ApiResult<PayoutBatchDto>>> ExecuteBatch(
        Guid payoutBatchId,
        CancellationToken cancellationToken)
    {
        var result = await _settlements.ExecuteBatchAsync(payoutBatchId, cancellationToken);
        return Ok(ApiResult<PayoutBatchDto>.Ok(result, "Payout submitted to payOS."));
    }

    /// <summary>Record a transfer made outside payOS (Settlement:PayoutMode = Manual).</summary>
    [HttpPost("batches/{payoutBatchId:guid}/mark-paid")]
    public async Task<ActionResult<ApiResult<PayoutBatchDto>>> MarkPaid(
        Guid payoutBatchId,
        [FromBody] MarkPayoutPaidRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _settlements.MarkBatchPaidAsync(
            payoutBatchId,
            User.GetUserId(),
            request,
            cancellationToken);

        return Ok(ApiResult<PayoutBatchDto>.Ok(result, "Payout marked as paid."));
    }

    /// <summary>Cancel a batch and return its settlements to the eligible pool.</summary>
    [HttpPost("batches/{payoutBatchId:guid}/cancel")]
    public async Task<ActionResult<ApiResult<PayoutBatchDto>>> CancelBatch(
        Guid payoutBatchId,
        CancellationToken cancellationToken)
    {
        var result = await _settlements.CancelBatchAsync(
            payoutBatchId,
            User.GetUserId(),
            cancellationToken);

        return Ok(ApiResult<PayoutBatchDto>.Ok(result, "Payout batch cancelled."));
    }

    /// <summary>Approve or reject a shop's payout bank account.</summary>
    [HttpPost("shops/{shopId:guid}/bank-account/verify")]
    public async Task<ActionResult<ApiResult<ShopBankAccountDto>>> VerifyBankAccount(
        Guid shopId,
        [FromBody] VerifyShopBankAccountRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _settlements.VerifyBankAccountAsync(
            shopId,
            User.GetUserId(),
            request,
            cancellationToken);

        return Ok(ApiResult<ShopBankAccountDto>.Ok(result));
    }

    /// <summary>Available balance of the payOS payout account funding the transfers.</summary>
    [HttpGet("payout-balance")]
    public async Task<ActionResult<ApiResult<decimal>>> GetPayoutBalance(
        CancellationToken cancellationToken)
    {
        var result = await _settlements.GetPayoutBalanceAsync(cancellationToken);
        return Ok(ApiResult<decimal>.Ok(result));
    }

    /// <summary>Run the settlement sweep now instead of waiting for the timer.</summary>
    [HttpPost("sweep")]
    public async Task<ActionResult<ApiResult<SettlementSweepResult>>> RunSweep(
        CancellationToken cancellationToken)
    {
        var result = await _settlements.RunSweepAsync(cancellationToken);
        return Ok(ApiResult<SettlementSweepResult>.Ok(result));
    }

    /// <summary>Platform commission (3%) recognised over a period, with GMV and payouts.</summary>
    [HttpGet("/api/admin/finance/commission")]
    public async Task<ActionResult<ApiResult<PlatformCommissionReportDto>>> GetCommissionReport(
        [FromQuery] PlatformCommissionQueryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _settlements.GetCommissionReportAsync(request, cancellationToken);
        return Ok(ApiResult<PlatformCommissionReportDto>.Ok(result));
    }
}
