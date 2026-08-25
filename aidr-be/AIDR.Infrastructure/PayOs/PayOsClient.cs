using System.Text.Json;
using AIDR.Modules.Payment.Abstractions;
using AIDR.Modules.Payment.Services;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Payment;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PayOS;
using PayOS.Exceptions;
using PayOS.Models.V2.PaymentRequests;
using PayOS.Models.Webhooks;

namespace AIDR.Infrastructure.PayOs;

public sealed class PayOsClient : IPayOsClient
{
    private readonly PayOsOptions _options;
    private readonly ILogger<PayOsClient> _logger;
    private readonly Lazy<PayOSClient?> _client;

    public PayOsClient(IOptions<PayOsOptions> options, ILogger<PayOsClient> logger)
    {
        _options = options.Value;
        _logger = logger;
        _client = new Lazy<PayOSClient?>(CreateClient);
    }

    public bool UseMock => _options.UseMock;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.ClientId) &&
        !string.IsNullOrWhiteSpace(_options.ApiKey) &&
        !string.IsNullOrWhiteSpace(_options.ChecksumKey);

    public async Task<PayOsCreateLinkResult> CreatePaymentLinkAsync(
        PayOsCreateLinkCommand command,
        CancellationToken cancellationToken = default)
    {
        if (UseMock)
            return CreateMockLink(command);

        var client = _client.Value
            ?? throw new AppException("payOS credentials are missing.", 503);

        try
        {
            var request = new CreatePaymentLinkRequest
            {
                OrderCode = command.OrderCode,
                Amount = command.AmountVnd,
                Description = command.Description,
                ReturnUrl = command.ReturnUrl,
                CancelUrl = command.CancelUrl
            };

            var response = await client.PaymentRequests.CreateAsync(request);
            cancellationToken.ThrowIfCancellationRequested();

            if (string.IsNullOrWhiteSpace(response.CheckoutUrl) || string.IsNullOrWhiteSpace(response.PaymentLinkId))
                throw new AppException("payOS did not return a checkout URL.", 502);

            return new PayOsCreateLinkResult
            {
                PaymentLinkId = response.PaymentLinkId,
                CheckoutUrl = response.CheckoutUrl,
                QrCode = response.QrCode,
                Status = response.Status.ToString(),
                RawJson = JsonSerializer.Serialize(response)
            };
        }
        catch (AppException)
        {
            throw;
        }
        catch (PayOSException ex)
        {
            _logger.LogWarning(ex, "payOS create payment link failed");
            throw new AppException($"Unable to create payOS payment link: {ex.Message}", 502);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected payOS create payment link error");
            throw new AppException("Unable to create payOS payment link.", 502);
        }
    }

    public async Task<PayOsVerifiedWebhook> VerifyWebhookAsync(
        PayOsWebhookRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.Data is null)
            throw new AppException("Webhook data is required.");

        if (IsWebhookConfirmationProbe(request))
        {
            return new PayOsVerifiedWebhook
            {
                OrderCode = request.Data.OrderCode,
                Amount = request.Data.Amount,
                PaymentLinkId = request.Data.PaymentLinkId ?? string.Empty,
                Code = request.Data.Code ?? request.Code ?? PaymentConstants.PayOsSuccessCode,
                Description = request.Data.Description,
                Reference = request.Data.Reference,
                Currency = request.Data.Currency,
                IsWebhookConfirmationProbe = true
            };
        }

        if (UseMock)
        {
            if (string.IsNullOrWhiteSpace(request.Data.PaymentLinkId))
                throw new AppException("Webhook paymentLinkId is required.");

            return new PayOsVerifiedWebhook
            {
                OrderCode = request.Data.OrderCode,
                Amount = request.Data.Amount,
                PaymentLinkId = request.Data.PaymentLinkId,
                Code = request.Data.Code ?? request.Code ?? PaymentConstants.PayOsSuccessCode,
                Description = request.Data.Description,
                Reference = request.Data.Reference,
                Currency = request.Data.Currency,
                IsWebhookConfirmationProbe = false
            };
        }

        var client = _client.Value
            ?? throw new AppException("payOS credentials are missing.", 503);

        try
        {
            var webhook = new Webhook
            {
                Code = request.Code ?? string.Empty,
                Description = request.Description ?? string.Empty,
                Success = request.Success,
                Signature = request.Signature ?? string.Empty,
                Data = new WebhookData
                {
                    OrderCode = request.Data.OrderCode,
                    Amount = request.Data.Amount,
                    Description = request.Data.Description ?? string.Empty,
                    AccountNumber = request.Data.AccountNumber ?? string.Empty,
                    Reference = request.Data.Reference ?? string.Empty,
                    TransactionDateTime = request.Data.TransactionDateTime ?? string.Empty,
                    Currency = request.Data.Currency ?? "VND",
                    PaymentLinkId = request.Data.PaymentLinkId ?? string.Empty,
                    Code = request.Data.Code ?? string.Empty,
                    Description2 = request.Data.Desc ?? string.Empty,
                    CounterAccountBankId = request.Data.CounterAccountBankId ?? string.Empty,
                    CounterAccountBankName = request.Data.CounterAccountBankName ?? string.Empty,
                    CounterAccountName = request.Data.CounterAccountName ?? string.Empty,
                    CounterAccountNumber = request.Data.CounterAccountNumber ?? string.Empty,
                    VirtualAccountName = request.Data.VirtualAccountName ?? string.Empty,
                    VirtualAccountNumber = request.Data.VirtualAccountNumber ?? string.Empty
                }
            };

            var verified = await client.Webhooks.VerifyAsync(webhook);
            cancellationToken.ThrowIfCancellationRequested();

            return new PayOsVerifiedWebhook
            {
                OrderCode = verified.OrderCode,
                Amount = verified.Amount,
                PaymentLinkId = verified.PaymentLinkId ?? string.Empty,
                Code = verified.Code ?? request.Data.Code ?? PaymentConstants.PayOsSuccessCode,
                Description = verified.Description,
                Reference = verified.Reference,
                Currency = verified.Currency,
                IsWebhookConfirmationProbe = false
            };
        }
        catch (AppException)
        {
            throw;
        }
        catch (WebhookException ex)
        {
            _logger.LogWarning(ex, "payOS webhook verification failed");
            throw new AppException("Invalid payOS webhook signature.", 401);
        }
        catch (InvalidSignatureException ex)
        {
            _logger.LogWarning(ex, "payOS webhook signature invalid");
            throw new AppException("Invalid payOS webhook signature.", 401);
        }
        catch (PayOSException ex)
        {
            _logger.LogWarning(ex, "payOS webhook processing failed");
            throw new AppException($"Unable to verify payOS webhook: {ex.Message}", 400);
        }
    }

    private PayOSClient? CreateClient()
    {
        if (!IsConfigured)
            return null;

        return new PayOSClient(new PayOSOptions
        {
            ClientId = _options.ClientId.Trim(),
            ApiKey = _options.ApiKey.Trim(),
            ChecksumKey = _options.ChecksumKey.Trim()
        });
    }

    private static PayOsCreateLinkResult CreateMockLink(PayOsCreateLinkCommand command)
    {
        var paymentLinkId = $"mock_{command.OrderCode}";
        var checkoutUrl =
            $"{command.ReturnUrl}{(command.ReturnUrl.Contains('?', StringComparison.Ordinal) ? '&' : '?')}" +
            $"mockPayOs=1&paymentLinkId={Uri.EscapeDataString(paymentLinkId)}";

        return new PayOsCreateLinkResult
        {
            PaymentLinkId = paymentLinkId,
            CheckoutUrl = checkoutUrl,
            QrCode = null,
            Status = "PENDING",
            RawJson = JsonSerializer.Serialize(new
            {
                mock = true,
                orderCode = command.OrderCode,
                amount = command.AmountVnd,
                paymentLinkId,
                checkoutUrl
            })
        };
    }

    private static bool IsWebhookConfirmationProbe(PayOsWebhookRequest request)
    {
        var data = request.Data;
        if (data is null)
            return false;

        return data.OrderCode == 123
               && string.Equals(data.Description, "VQRIO123", StringComparison.Ordinal)
               && string.Equals(data.AccountNumber, "12345678", StringComparison.Ordinal);
    }
}
