using AIDR.Shared.Dtos.Payment;

namespace AIDR.Modules.Payment.Abstractions;

public sealed class PendingPaymentForCheckout
{
    public Guid PaymentId { get; init; }
    public Guid OrderId { get; init; }
    public Guid BuyerUserId { get; init; }
    public string OrderCode { get; init; } = null!;
    public string OrderStatus { get; init; } = null!;
    public decimal Amount { get; init; }
    public string Currency { get; init; } = "VND";
    public string PaymentStatus { get; init; } = null!;
    public string? ProviderPaymentId { get; init; }
    public string? CheckoutUrl { get; init; }
    public string? RawResponseJson { get; init; }
}

public interface IPaymentRepository
{
    Task<PendingPaymentForCheckout?> GetPendingPaymentForBuyerOrderAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default);

    Task SaveCheckoutLinkAsync(
        Guid paymentId,
        string paymentLinkId,
        string checkoutUrl,
        string? rawResponseJson,
        CancellationToken cancellationToken = default);

    Task<PayOsWebhookResult> MarkPaidFromWebhookAsync(
        string paymentLinkId,
        long payOsOrderCode,
        long amountVnd,
        string? rawResponseJson,
        CancellationToken cancellationToken = default);
}
