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

public sealed class PayOsPaymentLinkInfo
{
    public required long OrderCode { get; init; }
    /// <summary>Raw payOS state: PENDING | PAID | CANCELLED | EXPIRED | UNDERPAID | PROCESSING | FAILED.</summary>
    public required string Status { get; init; }
    public string? PaymentLinkId { get; init; }
    public long Amount { get; init; }
    public long AmountPaid { get; init; }
    public string? RawJson { get; init; }
    public bool IsMock { get; init; }
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

public sealed class PayOsPayoutCommand
{
    /// <summary>Merchant reference; also used as the payOS idempotency key.</summary>
    public required string ReferenceId { get; init; }
    public required int AmountVnd { get; init; }
    public required string Description { get; init; }
    public required string ToBin { get; init; }
    public required string ToAccountNumber { get; init; }
    /// <summary>payOS payout category, e.g. "settlement" or "refund".</summary>
    public string Category { get; init; } = "settlement";
}

public sealed class PayOsPayoutResult
{
    public required string PayoutId { get; init; }
    public required string ReferenceId { get; init; }
    /// <summary>Raw provider state, e.g. RECEIVED / PROCESSING / SUCCEEDED / FAILED.</summary>
    public string? ApprovalState { get; init; }
    public string? RawJson { get; init; }
    public bool IsMock { get; init; }
}

public sealed class PayOsPayoutBalance
{
    public required decimal Balance { get; init; }
    public string Currency { get; init; } = "VND";
    public bool IsMock { get; init; }
    public string? RawJson { get; init; }
}

public interface IPayOsClient
{
    bool IsConfigured { get; }
    bool UseMock { get; }

    Task<PayOsCreateLinkResult> CreatePaymentLinkAsync(
        PayOsCreateLinkCommand command,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Ask payOS what actually happened to a payment link. The webhook is the
    /// primary path, but it cannot reach a machine that is not publicly
    /// addressable - this is how a buyer returning from the checkout page still
    /// gets their order confirmed.
    /// </summary>
    Task<PayOsPaymentLinkInfo> GetPaymentLinkAsync(
        long payOsOrderCode,
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

    /// <summary>
    /// Available balance of the merchant payout (chi hộ) account. Checked before a
    /// settlement batch runs - an underfunded payout account is the most common
    /// operational failure and deserves a clear message, not a raw payOS error.
    /// </summary>
    Task<PayOsPayoutBalance> GetPayoutBalanceAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Transfer a settled amount to a seller bank account. Safe to retry with the
    /// same <see cref="PayOsPayoutCommand.ReferenceId"/> - payOS returns the
    /// existing payout instead of creating a second one.
    /// </summary>
    Task<PayOsPayoutResult> CreatePayoutAsync(
        PayOsPayoutCommand command,
        CancellationToken cancellationToken = default);

    /// <summary>Poll a payout that payOS has not finalised yet.</summary>
    Task<PayOsPayoutResult> GetPayoutAsync(
        string payoutId,
        CancellationToken cancellationToken = default);
}

public sealed class PayOsConfirmWebhookResult
{
    public required string WebhookUrl { get; init; }
    public string? AccountNumber { get; init; }
    public string? AccountName { get; init; }
    public string? RawJson { get; init; }
}
