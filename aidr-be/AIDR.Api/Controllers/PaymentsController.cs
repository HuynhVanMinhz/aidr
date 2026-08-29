using AIDR.Api.Extensions;
using AIDR.Modules.Payment.Abstractions;
using AIDR.Shared.Dtos.Payment;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api/payments/payos")]
public sealed class PaymentsController : ControllerBase
{
    private readonly IPaymentService _payments;

    public PaymentsController(IPaymentService payments) => _payments = payments;

    /// <summary>
    /// Create a payOS checkout link for a buyer order that still has a pending payment.
    /// </summary>
    [HttpPost("create")]
    [Authorize(Policy = "Buyer")]
    public async Task<ActionResult<ApiResult<CreatePayOsPaymentResponse>>> Create(
        [FromBody] CreatePayOsPaymentRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _payments.CreatePayOsPaymentAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<CreatePayOsPaymentResponse>.Ok(result, "Payment link created."));
    }

    /// <summary>
    /// Reconcile one order with payOS after the buyer returns from the checkout page.
    /// The webhook stays the primary path; this covers the case where it has not
    /// arrived yet, or cannot reach this API at all (local dev without a tunnel).
    /// </summary>
    [HttpPost("sync")]
    [Authorize(Policy = "Buyer")]
    public async Task<ActionResult<ApiResult<SyncPayOsPaymentResponse>>> Sync(
        [FromBody] SyncPayOsPaymentRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _payments.SyncPayOsPaymentAsync(User.GetUserId(), request, cancellationToken);
        return Ok(ApiResult<SyncPayOsPaymentResponse>.Ok(result, result.Message));
    }

    /// <summary>
    /// payOS payment webhook. Verifies signature then marks payment Succeeded and order Paid.
    /// </summary>
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<PayOsWebhookResult>>> Webhook(
        [FromBody] PayOsWebhookRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _payments.HandlePayOsWebhookAsync(request, cancellationToken);
        return Ok(ApiResult<PayOsWebhookResult>.Ok(result, result.Message));
    }

    /// <summary>
    /// Register or update the merchant webhook URL with payOS.
    /// payOS probes the endpoint first — use a public HTTPS URL (e.g. ngrok) in local/dev.
    /// </summary>
    [HttpPost("confirm-webhook")]
    [Authorize(Policy = "Admin")]
    public async Task<ActionResult<ApiResult<ConfirmPayOsWebhookResponse>>> ConfirmWebhook(
        [FromBody] ConfirmPayOsWebhookRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _payments.ConfirmPayOsWebhookAsync(request, cancellationToken);
        return Ok(ApiResult<ConfirmPayOsWebhookResponse>.Ok(result, result.Message));
    }
}
