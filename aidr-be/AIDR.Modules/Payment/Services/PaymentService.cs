using System.Text.Json;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Modules.Payment.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Engagement;
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
    private readonly INotificationService _notifications;
    private readonly OrderInvoiceMailer _invoiceMailer;
    private readonly ILogger<PaymentService> _logger;

    public PaymentService(
        IPaymentRepository payments,
        IPayOsClient payOs,
        IOptions<PayOsOptions> options,
        INotificationService notifications,
        OrderInvoiceMailer invoiceMailer,
        ILogger<PaymentService> logger)
    {
        _payments = payments;
        _payOs = payOs;
        _options = options.Value;
        _notifications = notifications;
        _invoiceMailer = invoiceMailer;
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

        // Reuse a live payOS link; recreate after cancel/expire (same orderCode cannot be reused).
        if (!string.IsNullOrWhiteSpace(payment.CheckoutUrl) && !string.IsNullOrWhiteSpace(payment.ProviderPaymentId))
        {
            var existingCode = TryReadPayOsOrderCode(payment.RawResponseJson) ?? ToPayOsOrderCode(payment.PaymentId);
            var reuse = await TryReuseExistingCheckoutAsync(payment, existingCode, cancellationToken);
            if (reuse is not null)
                return reuse;
        }

        if (!_payOs.IsConfigured && !_payOs.UseMock)
            throw new AppException("payOS is not configured. Set PayOS credentials or enable UseMock.", 503);

        var amountVnd = ToVndInteger(payment.Amount);
        if (amountVnd < 1)
            throw new AppException("Order amount must be at least 1 VND.");

        var previousAttempt = TryReadLinkAttempt(payment.RawResponseJson);
        var linkAttempt = string.IsNullOrWhiteSpace(payment.CheckoutUrl) && previousAttempt == 0
            ? 1
            : previousAttempt + 1;
        var payOsOrderCode = ToPayOsOrderCode(payment.PaymentId, linkAttempt);
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
                linkAttempt,
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
            "Created payOS checkout for order {OrderId} payment {PaymentId} link {PaymentLinkId} attempt {Attempt}",
            payment.OrderId,
            payment.PaymentId,
            link.PaymentLinkId,
            linkAttempt);

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

    /// <summary>
    /// Returns the stored checkout when payOS still accepts it; otherwise null so the
    /// caller can mint a new link (cancelled/expired orderCodes cannot be recreated).
    /// </summary>
    private async Task<CreatePayOsPaymentResponse?> TryReuseExistingCheckoutAsync(
        PendingPaymentForCheckout payment,
        long existingCode,
        CancellationToken cancellationToken)
    {
        if (_payOs.UseMock)
            return MapResponse(payment, payment.CheckoutUrl!, existingCode);

        if (!_payOs.IsConfigured)
            return MapResponse(payment, payment.CheckoutUrl!, existingCode);

        PayOsPaymentLinkInfo link;
        try
        {
            link = await _payOs.GetPaymentLinkAsync(existingCode, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Unable to read payOS link {OrderCode} for order {OrderId} - will create a new checkout",
                existingCode,
                payment.OrderId);
            return null;
        }

        if (string.Equals(link.Status, PaymentConstants.PayOsLinkStatusPaid, StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException(
                "This order was already paid on payOS. Refresh the page to update payment status.");
        }

        if (IsReusablePayOsLinkStatus(link.Status))
            return MapResponse(payment, payment.CheckoutUrl!, existingCode);

        _logger.LogInformation(
            "payOS link {OrderCode} for order {OrderId} is {Status} - creating a new checkout",
            existingCode,
            payment.OrderId,
            link.Status);
        return null;
    }

    private static bool IsReusablePayOsLinkStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
            return false;

        return status.Equals(PaymentConstants.PayOsLinkStatusPending, StringComparison.OrdinalIgnoreCase)
            || status.Equals(PaymentConstants.PayOsLinkStatusProcessing, StringComparison.OrdinalIgnoreCase);
    }

    public async Task<SyncPayOsPaymentResponse> SyncPayOsPaymentAsync(
        Guid buyerUserId,
        SyncPayOsPaymentRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.OrderId == Guid.Empty)
            throw new AppException("Order id is required.");

        var payment = await _payments.GetPendingPaymentForBuyerOrderAsync(
            buyerUserId,
            request.OrderId,
            cancellationToken)
            ?? throw new NotFoundException("Payment for this order was not found.");

        // Already settled - the webhook won the race, nothing to ask payOS about.
        if (string.Equals(payment.PaymentStatus, PaymentConstants.StatusSucceeded, StringComparison.OrdinalIgnoreCase))
        {
            return new SyncPayOsPaymentResponse
            {
                OrderId = payment.OrderId,
                OrderCode = payment.OrderCode,
                PaymentStatus = payment.PaymentStatus,
                OrderStatus = payment.OrderStatus,
                ProviderStatus = "PAID",
                Reconciled = false,
                Message = "Payment already confirmed."
            };
        }

        if (!string.Equals(payment.PaymentStatus, PaymentConstants.StatusPending, StringComparison.OrdinalIgnoreCase))
        {
            return new SyncPayOsPaymentResponse
            {
                OrderId = payment.OrderId,
                OrderCode = payment.OrderCode,
                PaymentStatus = payment.PaymentStatus,
                OrderStatus = payment.OrderStatus,
                ProviderStatus = payment.PaymentStatus.ToUpperInvariant(),
                Reconciled = false,
                Message = $"Payment is {payment.PaymentStatus}."
            };
        }

        // No checkout link was ever created, so payOS has nothing under this code.
        if (string.IsNullOrWhiteSpace(payment.ProviderPaymentId) && string.IsNullOrWhiteSpace(payment.CheckoutUrl))
        {
            return new SyncPayOsPaymentResponse
            {
                OrderId = payment.OrderId,
                OrderCode = payment.OrderCode,
                PaymentStatus = payment.PaymentStatus,
                OrderStatus = payment.OrderStatus,
                ProviderStatus = "NOTFOUND",
                Reconciled = false,
                Message = "No payOS checkout link has been created for this order yet."
            };
        }

        var payOsOrderCode = TryReadPayOsOrderCode(payment.RawResponseJson) ?? ToPayOsOrderCode(payment.PaymentId);
        var link = await _payOs.GetPaymentLinkAsync(payOsOrderCode, cancellationToken);

        if (!string.Equals(link.Status, PaymentConstants.PayOsLinkStatusPaid, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogInformation(
                "payOS reports {Status} for order {OrderId} (code {OrderCode}) - leaving it pending",
                link.Status,
                payment.OrderId,
                payOsOrderCode);

            return new SyncPayOsPaymentResponse
            {
                OrderId = payment.OrderId,
                OrderCode = payment.OrderCode,
                PaymentStatus = payment.PaymentStatus,
                OrderStatus = payment.OrderStatus,
                ProviderStatus = link.Status,
                Reconciled = false,
                Message = $"payOS reports the payment as {link.Status}."
            };
        }

        var paidAmount = link.AmountPaid > 0 ? link.AmountPaid : link.Amount;
        var result = await _payments.MarkPaidFromWebhookAsync(
            string.IsNullOrWhiteSpace(link.PaymentLinkId) ? payment.ProviderPaymentId ?? string.Empty : link.PaymentLinkId,
            payOsOrderCode,
            paidAmount,
            link.RawJson,
            cancellationToken);

        // Same notification the webhook path fires, and the same replay guard -
        // whichever of the two gets here first is the only one that notifies.
        if (result.Processed && !result.IdempotentReplay)
        {
            await NotifySellerNewPaidOrderAsync(result, cancellationToken);
            await _invoiceMailer.TrySendAfterPaidAsync(result, cancellationToken);
        }

        _logger.LogInformation(
            "Reconciled order {OrderId} against payOS: payment {PaymentStatus}, order {OrderStatus}",
            payment.OrderId,
            result.PaymentStatus,
            result.OrderStatus);

        return new SyncPayOsPaymentResponse
        {
            OrderId = payment.OrderId,
            OrderCode = payment.OrderCode,
            PaymentStatus = result.PaymentStatus ?? PaymentConstants.StatusSucceeded,
            OrderStatus = result.OrderStatus ?? PaymentConstants.OrderStatusPaid,
            ProviderStatus = link.Status,
            Reconciled = result.Processed && !result.IdempotentReplay,
            Message = "Payment confirmed with payOS."
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
        var result = await _payments.MarkPaidFromWebhookAsync(
            verified.PaymentLinkId,
            verified.OrderCode,
            verified.Amount,
            raw,
            cancellationToken);

        if (result.Processed && !result.IdempotentReplay)
        {
            await NotifySellerNewPaidOrderAsync(result, cancellationToken);
            await _invoiceMailer.TrySendAfterPaidAsync(result, cancellationToken);
        }

        return result;
    }

    private async Task NotifySellerNewPaidOrderAsync(
        PayOsWebhookResult result,
        CancellationToken cancellationToken)
    {
        if (result.ShopOwnerUserId is not { } sellerId || sellerId == Guid.Empty)
            return;

        var orderCode = string.IsNullOrWhiteSpace(result.OrderCode) ? "order" : result.OrderCode;
        try
        {
            await _notifications.CreateAsync(
                new CreateNotificationRequest
                {
                    UserId = sellerId,
                    Title = "New paid order",
                    Body = $"Order {orderCode} has been paid and is ready to fulfill.",
                    Type = NotificationConstants.TypePayment,
                    ReferenceType = NotificationConstants.RefOrder,
                    ReferenceId = result.OrderId
                },
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to notify seller {SellerId} about paid order {OrderId}",
                sellerId,
                result.OrderId);
        }
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

    /// <summary>
    /// payOS accepts orderCode as a JSON number, so it must stay within the
    /// IEEE-754 safe integer range (max 9007199254740991) or the create-link
    /// call is rejected. Fold the payment id into that range.
    /// <paramref name="attempt"/> &gt; 1 produces a different code so a cancelled
    /// payOS link can be replaced without colliding on the previous orderCode.
    /// </summary>
    private const long MaxPayOsOrderCode = 9_007_199_254_740_991L;

    public static long ToPayOsOrderCode(Guid paymentId, int attempt = 1)
    {
        var bytes = paymentId.ToByteArray();
        var value = BitConverter.ToInt64(bytes, 0);
        var abs = value == long.MinValue ? long.MaxValue : Math.Abs(value);

        var baseCode = abs % MaxPayOsOrderCode;
        if (baseCode == 0)
            baseCode = 1L;

        if (attempt <= 1)
            return baseCode;

        var mixed = (baseCode + (long)(attempt - 1) * 1_000_003L) % MaxPayOsOrderCode;
        return mixed == 0 ? 1L : mixed;
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

    private static int TryReadLinkAttempt(string? rawJson)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
            return 0;

        try
        {
            using var doc = JsonDocument.Parse(rawJson);
            if (doc.RootElement.TryGetProperty("linkAttempt", out var prop) &&
                prop.TryGetInt32(out var attempt) &&
                attempt > 0)
                return attempt;
        }
        catch (JsonException)
        {
            // ignore malformed legacy payload
        }

        // Legacy rows stored a checkout without linkAttempt - treat as attempt 1.
        return TryReadPayOsOrderCode(rawJson).HasValue ? 1 : 0;
    }
}
