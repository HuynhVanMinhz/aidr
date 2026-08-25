using AIDR.Shared.Dtos.Payment;

namespace AIDR.Modules.Payment.Abstractions;

public sealed class PayOsCreateLinkCommand
{
    public required long OrderCode { get; init; }
    public required int AmountVnd { get; init; }
    public required string Description { get; init; }
    public required string ReturnUrl { get; init; }
    public required string CancelUrl { get; init; }
}

public sealed class PayOsCreateLinkResult
{
    public required string PaymentLinkId { get; init; }
    public required string CheckoutUrl { get; init; }
    public string? QrCode { get; init; }
    public string? Status { get; init; }
    public string? RawJson { get; init; }
}

public sealed class PayOsVerifiedWebhook
{
    public required long OrderCode { get; init; }
    public required long Amount { get; init; }
    public required string PaymentLinkId { get; init; }
    public required string Code { get; init; }
    public string? Description { get; init; }
    public string? Reference { get; init; }
    public string? Currency { get; init; }
    public bool IsWebhookConfirmationProbe { get; init; }
}

public sealed class PayOsRefundCommand
{
    /// <summary>Idempotency / merchant reference for the payout (e.g. refund_{returnRequestId}).</summary>
    public required string ReferenceId { get; init; }
    public required int AmountVnd { get; init; }
    public required string Description { get; init; }
    /// <summary>Bank BIN (Napas) of the buyer account to receive the refund.</summary>
    public required string ToBin { get; init; }
    public required string ToAccountNumber { get; init; }
}

public sealed class PayOsRefundResult
{
    public required string PayoutId { get; init; }
    public required string ReferenceId { get; init; }
    public string? ApprovalState { get; init; }
    public string? RawJson { get; init; }
    public bool IsMock { get; init; }
}

public interface IPayOsClient
{
    bool IsConfigured { get; }
    bool UseMock { get; }

    Task<PayOsCreateLinkResult> CreatePaymentLinkAsync(
        PayOsCreateLinkCommand command,
        CancellationToken cancellationToken = default);

    Task<PayOsVerifiedWebhook> VerifyWebhookAsync(
        PayOsWebhookRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Register/update the merchant webhook URL with payOS (payOS probes the endpoint first).
    /// </summary>
    Task<PayOsConfirmWebhookResult> ConfirmWebhookAsync(
        string webhookUrl,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Refund a paid order by creating a payOS payout (chi hộ) back to the buyer bank account.
    /// payOS Merchant API has no dedicated /refund endpoint for VietQR payments.
    /// </summary>
    Task<PayOsRefundResult> RefundAsync(
        PayOsRefundCommand command,
        CancellationToken cancellationToken = default);
}

public sealed class PayOsConfirmWebhookResult
{
    public required string WebhookUrl { get; init; }
    public string? AccountNumber { get; init; }
    public string? AccountName { get; init; }
    public string? RawJson { get; init; }
}
