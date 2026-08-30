using System.Text.Json.Serialization;

namespace AIDR.Shared.Dtos.Payment;

public sealed class CreatePayOsPaymentRequest
{
    public Guid OrderId { get; set; }
}

public sealed class CreatePayOsPaymentResponse
{
    public Guid PaymentId { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public string CheckoutUrl { get; init; } = null!;
    public string? ProviderPaymentId { get; init; }
    public long PayOsOrderCode { get; init; }
    public string PaymentStatus { get; init; } = null!;
    public string OrderStatus { get; init; } = null!;
    public decimal Amount { get; init; }
    public string Currency { get; init; } = "VND";
}

public sealed class SyncPayOsPaymentRequest
{
    public Guid OrderId { get; set; }
}

/// <summary>
/// What payOS says about an order right now, after the API has reconciled it.
/// </summary>
public sealed class SyncPayOsPaymentResponse
{
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public string PaymentStatus { get; init; } = null!;
    public string OrderStatus { get; init; } = null!;

    /// <summary>Raw payOS payment-link state (PENDING / PAID / CANCELLED / EXPIRED ...).</summary>
    public string ProviderStatus { get; init; } = null!;

    /// <summary>True when this call is what moved the order to Paid.</summary>
    public bool Reconciled { get; init; }

    public string Message { get; init; } = null!;
}

public sealed class PayOsWebhookRequest
{
    public string? Code { get; set; }
    public string? Description { get; set; }
    public bool Success { get; set; }
    public PayOsWebhookData? Data { get; set; }
    public string? Signature { get; set; }
}

public sealed class PayOsWebhookData
{
    public long OrderCode { get; set; }
    public int Amount { get; set; }
    public string? Description { get; set; }
    public string? AccountNumber { get; set; }
    public string? Reference { get; set; }
    public string? TransactionDateTime { get; set; }
    public string? Currency { get; set; }
    public string? PaymentLinkId { get; set; }
    public string? Code { get; set; }

    [JsonPropertyName("desc")]
    public string? Desc { get; set; }

    public string? CounterAccountBankId { get; set; }
    public string? CounterAccountBankName { get; set; }
    public string? CounterAccountName { get; set; }
    public string? CounterAccountNumber { get; set; }
    public string? VirtualAccountName { get; set; }
    public string? VirtualAccountNumber { get; set; }
}

public sealed class PayOsWebhookResult
{
    public bool Processed { get; init; }
    public bool IdempotentReplay { get; init; }
    public string Message { get; init; } = null!;
    public Guid? PaymentId { get; init; }
    public Guid? OrderId { get; init; }
    public string? OrderCode { get; init; }
    public Guid? BuyerUserId { get; init; }
    public Guid? ShopOwnerUserId { get; init; }
    public string? PaymentStatus { get; init; }
    public string? OrderStatus { get; init; }
}

public sealed class ConfirmPayOsWebhookRequest
{
    /// <summary>
    /// Public HTTPS URL of this API webhook, e.g. https://xxxx.ngrok-free.app/api/payments/payos/webhook
    /// </summary>
    public string WebhookUrl { get; set; } = null!;
}

public sealed class ConfirmPayOsWebhookResponse
{
    public string WebhookUrl { get; init; } = null!;
    public string? AccountNumber { get; init; }
    public string? AccountName { get; init; }
    public string Message { get; init; } = null!;
}
