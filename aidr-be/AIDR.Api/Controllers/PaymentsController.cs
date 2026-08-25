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
}
