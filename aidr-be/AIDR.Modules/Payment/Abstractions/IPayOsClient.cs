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
}
