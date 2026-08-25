using System.Text.Json;
using AIDR.Modules.Payment.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Payment;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AIDR.Modules.Payment.Services;

public sealed class PayOsOptions
{
    public const string SectionName = PaymentConstants.OptionsSectionName;

    public string ClientId { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string ChecksumKey { get; set; } = string.Empty;

    /// <summary>
    /// When true, skip live payOS API and issue a local mock checkout URL (local/dev).
    /// </summary>
    public bool UseMock { get; set; }

    public string ReturnUrl { get; set; } = "http://localhost:5173/order-received";
    public string CancelUrl { get; set; } = "http://localhost:5173/order-received?cancelled=1";
}

public sealed class PaymentService : IPaymentService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly IPaymentRepository _payments;
    private readonly IPayOsClient _payOs;
    private readonly PayOsOptions _options;
    private readonly ILogger<PaymentService> _logger;

    public PaymentService(
        IPaymentRepository payments,
        IPayOsClient payOs,
        IOptions<PayOsOptions> options,
        ILogger<PaymentService> logger)
    {
        _payments = payments;
        _payOs = payOs;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<CreatePayOsPaymentResponse> CreatePayOsPaymentAsync(
        Guid buyerUserId,
        CreatePayOsPaymentRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.OrderId == Guid.Empty)
            throw new AppException("Order id is required.");

        var payment = await _payments.GetPendingPaymentForBuyerOrderAsync(
            buyerUserId,
            request.OrderId,
            cancellationToken)
            ?? throw new NotFoundException("Pending payment for this order was not found.");

        if (!string.Equals(payment.OrderStatus, PaymentConstants.OrderStatusPendingPayment, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Order is not awaiting payment.");

        if (!string.Equals(payment.PaymentStatus, PaymentConstants.StatusPending, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Payment is not pending.");

        if (!string.IsNullOrWhiteSpace(payment.CheckoutUrl) && !string.IsNullOrWhiteSpace(payment.ProviderPaymentId))
        {
            var existingCode = TryReadPayOsOrderCode(payment.RawResponseJson) ?? ToPayOsOrderCode(payment.PaymentId);
            return MapResponse(payment, payment.CheckoutUrl!, existingCode);
        }

        if (!_payOs.IsConfigured && !_payOs.UseMock)
            throw new AppException("payOS is not configured. Set PayOS credentials or enable UseMock.", 503);

        var amountVnd = ToVndInteger(payment.Amount);
        if (amountVnd < 1)
            throw new AppException("Order amount must be at least 1 VND.");

        var payOsOrderCode = ToPayOsOrderCode(payment.PaymentId);
        var description = TruncateDescription(payment.OrderCode);
        var returnUrl = AppendOrderId(_options.ReturnUrl, payment.OrderId);
        var cancelUrl = AppendOrderId(_options.CancelUrl, payment.OrderId);

        var link = await _payOs.CreatePaymentLinkAsync(
            new PayOsCreateLinkCommand
            {
                OrderCode = payOsOrderCode,
                AmountVnd = amountVnd,
                Description = description,
                ReturnUrl = returnUrl,
                CancelUrl = cancelUrl
            },
            cancellationToken);

        var rawEnvelope = JsonSerializer.Serialize(
            new
            {
                payOsOrderCode,
                paymentLinkId = link.PaymentLinkId,
                checkoutUrl = link.CheckoutUrl,
                qrCode = link.QrCode,
                status = link.Status,
                providerRaw = link.RawJson
            },
            JsonOptions);

        await _payments.SaveCheckoutLinkAsync(
            payment.PaymentId,
            link.PaymentLinkId,
            link.CheckoutUrl,
            rawEnvelope,
            cancellationToken);

        _logger.LogInformation(
            "Created payOS checkout for order {OrderId} payment {PaymentId} link {PaymentLinkId}",
            payment.OrderId,
            payment.PaymentId,
            link.PaymentLinkId);

        return new CreatePayOsPaymentResponse
        {
            PaymentId = payment.PaymentId,
            OrderId = payment.OrderId,
            OrderCode = payment.OrderCode,
            CheckoutUrl = link.CheckoutUrl,
            ProviderPaymentId = link.PaymentLinkId,
            PayOsOrderCode = payOsOrderCode,
            PaymentStatus = PaymentConstants.StatusPending,
            OrderStatus = payment.OrderStatus,
            Amount = payment.Amount,
            Currency = payment.Currency
        };
    }

    public async Task<PayOsWebhookResult> HandlePayOsWebhookAsync(
        PayOsWebhookRequest request,
        CancellationToken cancellationToken = default)
    {
        var verified = await _payOs.VerifyWebhookAsync(request, cancellationToken);

        if (verified.IsWebhookConfirmationProbe)
        {
            return new PayOsWebhookResult
            {
                Processed = true,
                Message = "Webhook endpoint confirmed."
            };
        }

        if (!string.Equals(verified.Code, PaymentConstants.PayOsSuccessCode, StringComparison.Ordinal))
        {
            _logger.LogWarning(
                "Ignoring non-success payOS webhook code {Code} for link {PaymentLinkId}",
                verified.Code,
                verified.PaymentLinkId);

            return new PayOsWebhookResult
            {
                Processed = false,
                Message = $"Payment not succeeded (code {verified.Code})."
            };
        }

        if (string.IsNullOrWhiteSpace(verified.PaymentLinkId))
            throw new AppException("Webhook paymentLinkId is missing.");

        var raw = JsonSerializer.Serialize(request, JsonOptions);
        return await _payments.MarkPaidFromWebhookAsync(
            verified.PaymentLinkId,
            verified.OrderCode,
            verified.Amount,
            raw,
            cancellationToken);
    }

    public async Task<ConfirmPayOsWebhookResponse> ConfirmPayOsWebhookAsync(
        ConfirmPayOsWebhookRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request is null)
            throw new AppException("Confirm webhook body is required.");

        var webhookUrl = request.WebhookUrl?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(webhookUrl))
            throw new AppException("Webhook URL is required.");

        if (webhookUrl.Length > 512)
            throw new AppException("Webhook URL must not exceed 512 characters.");

        if (!Uri.TryCreate(webhookUrl, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new AppException("Webhook URL must be an absolute http or https URL.");
        }

        if (!uri.AbsolutePath.Contains("/api/payments/payos/webhook", StringComparison.OrdinalIgnoreCase))
        {
            throw new AppException(
                "Webhook URL path should end with /api/payments/payos/webhook so payOS can reach this API.");
        }

        var confirmed = await _payOs.ConfirmWebhookAsync(uri.ToString(), cancellationToken);

        _logger.LogInformation("Registered payOS webhook URL {WebhookUrl}", confirmed.WebhookUrl);

        return new ConfirmPayOsWebhookResponse
        {
            WebhookUrl = confirmed.WebhookUrl,
            AccountNumber = confirmed.AccountNumber,
            AccountName = confirmed.AccountName,
            Message = _payOs.UseMock
                ? "Mock webhook confirm completed (UseMock=true)."
                : "payOS webhook URL confirmed. Payment notifications will be sent to this endpoint."
        };
    }

    private static CreatePayOsPaymentResponse MapResponse(
        PendingPaymentForCheckout payment,
        string checkoutUrl,
        long payOsOrderCode) =>
        new()
        {
            PaymentId = payment.PaymentId,
            OrderId = payment.OrderId,
            OrderCode = payment.OrderCode,
            CheckoutUrl = checkoutUrl,
            ProviderPaymentId = payment.ProviderPaymentId,
            PayOsOrderCode = payOsOrderCode,
            PaymentStatus = payment.PaymentStatus,
            OrderStatus = payment.OrderStatus,
            Amount = payment.Amount,
            Currency = payment.Currency
        };

    public static long ToPayOsOrderCode(Guid paymentId)
    {
        var bytes = paymentId.ToByteArray();
        var value = BitConverter.ToInt64(bytes, 0);
        if (value == long.MinValue)
            return long.MaxValue;

        var abs = Math.Abs(value);
        return abs == 0 ? 1L : abs;
    }

    private static int ToVndInteger(decimal amount)
    {
        if (amount != Math.Floor(amount))
            throw new AppException("Order amount must be a whole VND amount for payOS.");

        if (amount > int.MaxValue)
            throw new AppException("Order amount exceeds payOS limit.");

        return (int)amount;
    }

    private static string TruncateDescription(string orderCode)
    {
        var text = string.IsNullOrWhiteSpace(orderCode) ? "AIDR order" : orderCode.Trim();
        return text.Length <= PaymentConstants.MaxDescriptionLength
            ? text
            : text[..PaymentConstants.MaxDescriptionLength];
    }

    private static string AppendOrderId(string baseUrl, Guid orderId)
    {
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new AppException("PayOS return/cancel URL is not configured.");

        var separator = baseUrl.Contains('?', StringComparison.Ordinal) ? '&' : '?';
        return $"{baseUrl.Trim()}{separator}orderId={orderId:D}";
    }

    private static long? TryReadPayOsOrderCode(string? rawJson)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(rawJson);
            if (doc.RootElement.TryGetProperty("payOsOrderCode", out var prop) &&
                prop.TryGetInt64(out var code))
                return code;
        }
        catch (JsonException)
        {
            // ignore malformed legacy payload
        }

        return null;
    }
}
