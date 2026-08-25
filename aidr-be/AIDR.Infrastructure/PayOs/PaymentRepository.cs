using System.Text.Json;
using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Payment.Abstractions;
using AIDR.Modules.Payment.Services;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Payment;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;
using PaymentEntity = AIDR.Infrastructure.Persistence.Entities.Payment;

namespace AIDR.Infrastructure.PayOs;

public sealed class PaymentRepository : IPaymentRepository
{
    private readonly AidrDbContext _db;

    public PaymentRepository(AidrDbContext db) => _db = db;

    public async Task<PendingPaymentForCheckout?> GetPendingPaymentForBuyerOrderAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.Payments
            .AsNoTracking()
            .Where(p => p.OrderId == orderId)
            .Where(p => p.Order.BuyerUserId == buyerUserId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PendingPaymentForCheckout
            {
                PaymentId = p.PaymentId,
                OrderId = p.OrderId,
                BuyerUserId = p.Order.BuyerUserId,
                OrderCode = p.Order.OrderCode,
                OrderStatus = p.Order.Status,
                Amount = p.Amount,
                Currency = p.Currency,
                PaymentStatus = p.Status,
                ProviderPaymentId = p.ProviderPaymentId,
                CheckoutUrl = p.CheckoutUrl,
                RawResponseJson = p.RawResponseJson
            })
            .FirstOrDefaultAsync(cancellationToken);

        return row;
    }

    public async Task SaveCheckoutLinkAsync(
        Guid paymentId,
        string paymentLinkId,
        string checkoutUrl,
        string? rawResponseJson,
        CancellationToken cancellationToken = default)
    {
        var payment = await _db.Payments
            .FirstOrDefaultAsync(p => p.PaymentId == paymentId, cancellationToken)
            ?? throw new NotFoundException("Payment not found.");

        if (!string.Equals(payment.Status, PaymentConstants.StatusPending, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Only pending payments can receive a checkout link.");

        payment.ProviderPaymentId = paymentLinkId;
        payment.CheckoutUrl = checkoutUrl;
        payment.RawResponseJson = rawResponseJson;
        payment.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<PayOsWebhookResult> MarkPaidFromWebhookAsync(
        string paymentLinkId,
        long payOsOrderCode,
        long amountVnd,
        string? rawResponseJson,
        CancellationToken cancellationToken = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);

        var payment = await _db.Payments
            .Include(p => p.Order)
            .FirstOrDefaultAsync(
                p => p.ProviderPaymentId == paymentLinkId,
                cancellationToken);

        if (payment is null)
            payment = await FindByPayOsOrderCodeAsync(payOsOrderCode, cancellationToken);

        if (payment is null)
            throw new NotFoundException("Payment for webhook was not found.");

        if (string.Equals(payment.Status, PaymentConstants.StatusSucceeded, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(payment.Order.Status, PaymentConstants.OrderStatusPaid, StringComparison.OrdinalIgnoreCase))
        {
            await tx.CommitAsync(cancellationToken);
            return new PayOsWebhookResult
            {
                Processed = true,
                IdempotentReplay = true,
                Message = "Payment already marked as succeeded.",
                PaymentId = payment.PaymentId,
                OrderId = payment.OrderId,
                PaymentStatus = payment.Status,
                OrderStatus = payment.Order.Status
            };
        }

        if (!string.Equals(payment.Status, PaymentConstants.StatusPending, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException($"Payment status '{payment.Status}' cannot be marked paid.");

        if (!string.Equals(payment.Order.Status, PaymentConstants.OrderStatusPendingPayment, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException($"Order status '{payment.Order.Status}' cannot be marked paid.");

        var expectedAmount = decimal.Round(payment.Amount, 0, MidpointRounding.AwayFromZero);
        if (expectedAmount != amountVnd)
            throw new AppException("Webhook amount does not match payment amount.");

        var now = DateTime.UtcNow;
        var fromStatus = payment.Order.Status;

        payment.Status = PaymentConstants.StatusSucceeded;
        payment.PaidAt = now;
        payment.UpdatedAt = now;
        payment.ProviderPaymentId ??= paymentLinkId;
        if (!string.IsNullOrWhiteSpace(rawResponseJson))
            payment.RawResponseJson = rawResponseJson;

        payment.Order.Status = PaymentConstants.OrderStatusPaid;
        payment.Order.PaidAt = now;
        payment.Order.UpdatedAt = now;

        _db.OrderStatusHistories.Add(new OrderStatusHistory
        {
            OrderId = payment.OrderId,
            FromStatus = fromStatus,
            ToStatus = PaymentConstants.OrderStatusPaid,
            ChangedBy = null,
            Note = "Payment succeeded via payOS webhook",
            CreatedAt = now
        });

        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return new PayOsWebhookResult
        {
            Processed = true,
            IdempotentReplay = false,
            Message = "Payment marked as succeeded.",
            PaymentId = payment.PaymentId,
            OrderId = payment.OrderId,
            PaymentStatus = payment.Status,
            OrderStatus = payment.Order.Status
        };
    }

    private async Task<PaymentEntity?> FindByPayOsOrderCodeAsync(
        long payOsOrderCode,
        CancellationToken cancellationToken)
    {
        var needle = $"\"payOsOrderCode\":{payOsOrderCode}";
        var candidates = await _db.Payments
            .Include(p => p.Order)
            .Where(p => p.RawResponseJson != null && p.RawResponseJson.Contains(needle))
            .OrderByDescending(p => p.CreatedAt)
            .Take(5)
            .ToListAsync(cancellationToken);

        foreach (var candidate in candidates)
        {
            if (TryReadPayOsOrderCode(candidate.RawResponseJson) == payOsOrderCode)
                return candidate;
        }

        var allPending = await _db.Payments
            .Include(p => p.Order)
            .Where(p => p.Status == PaymentConstants.StatusPending)
            .OrderByDescending(p => p.CreatedAt)
            .Take(200)
            .ToListAsync(cancellationToken);

        return allPending.FirstOrDefault(p =>
            PaymentService.ToPayOsOrderCode(p.PaymentId) == payOsOrderCode);
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
            // ignore
        }

        return null;
    }
}
