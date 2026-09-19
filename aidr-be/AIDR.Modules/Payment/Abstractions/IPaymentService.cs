using AIDR.Shared.Dtos.Payment;

namespace AIDR.Modules.Payment.Abstractions;

public interface IPaymentService
{
    Task<CreatePayOsPaymentResponse> CreatePayOsPaymentAsync(
        Guid buyerUserId,
        CreatePayOsPaymentRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Reconcile one order against payOS. Used when the buyer comes back from the
    /// checkout page - the webhook may not have arrived (or cannot reach this API
    /// at all in local dev), so the API asks payOS directly.
    /// </summary>
    Task<SyncPayOsPaymentResponse> SyncPayOsPaymentAsync(
        Guid buyerUserId,
        SyncPayOsPaymentRequest request,
        CancellationToken cancellationToken = default);

    Task<PayOsWebhookResult> HandlePayOsWebhookAsync(
        PayOsWebhookRequest request,
        CancellationToken cancellationToken = default);

    Task<ConfirmPayOsWebhookResponse> ConfirmPayOsWebhookAsync(
        ConfirmPayOsWebhookRequest request,
        CancellationToken cancellationToken = default);
}
