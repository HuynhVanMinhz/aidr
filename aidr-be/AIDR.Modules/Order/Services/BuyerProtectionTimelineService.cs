using AIDR.Modules.Engagement.Abstractions;
using AIDR.Modules.Engagement.Services;
using AIDR.Modules.Order.Abstractions;
using AIDR.Modules.Settlement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Options;

namespace AIDR.Modules.Order.Services;

public sealed class BuyerProtectionTimelineService : IBuyerProtectionTimelineService
{
    private readonly IOrderRepository _orders;
    private readonly IReturnRepository _returns;
    private readonly SettlementOptions _settlementOptions;
    private readonly BuyerProtectionOptions _protectionOptions;

    public BuyerProtectionTimelineService(
        IOrderRepository orders,
        IReturnRepository returns,
        IOptions<SettlementOptions> settlementOptions,
        IOptions<BuyerProtectionOptions> protectionOptions)
    {
        _orders = orders;
        _returns = returns;
        _settlementOptions = settlementOptions.Value;
        _protectionOptions = protectionOptions.Value;
    }

    public async Task<BuyerProtectionTimelineDto> GetTimelineAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default)
    {
        if (orderId == Guid.Empty)
            throw new AppException("Order id is required.");

        var order = await _orders.GetBuyerOrderAsync(buyerUserId, orderId, cancellationToken)
            ?? throw new NotFoundException("Order not found.");

        var returnRequest = await _returns.GetByOrderForBuyerAsync(buyerUserId, orderId, cancellationToken);
        var now = DateTime.UtcNow;

        var paidAt = order.Payment?.PaidAt
            ?? order.PaidAt
            ?? (string.Equals(order.Payment?.Status, OrderConstants.PaymentStatusSucceeded, StringComparison.OrdinalIgnoreCase)
                ? order.Payment?.CreatedAt
                : null);

        var deliveredAt = order.DeliveredAt
            ?? FindStatusAt(order, OrderConstants.StatusDelivered)
            ?? order.UpdatedAt;
        var completedAt = order.CompletedAt ?? FindStatusAt(order, OrderConstants.StatusCompleted);
        var autoCompleteDue = deliveredAt.AddDays(_settlementOptions.AutoCompleteDays);
        var returnDeadline = completedAt?.AddDays(_protectionOptions.ReturnWindowDaysAfterCompleted);

        var steps = new List<BuyerProtectionTimelineStepDto>();
        var status = order.Status;

        steps.Add(BuildStep(
            "payment",
            "Payment confirmed",
            ResolveState(status, OrderConstants.StatusPendingPayment, paidAt.HasValue),
            paidAt,
            null,
            paidAt.HasValue ? "Paid via payOS." : null));

        steps.Add(BuildStep(
            "confirmed",
            "Order confirmed",
            ResolveState(status, OrderConstants.StatusPaid, HasReached(status, OrderConstants.StatusConfirmed)),
            FindStatusAt(order, OrderConstants.StatusConfirmed),
            null,
            null));

        steps.Add(BuildStep(
            "shipped",
            "Shipped",
            ResolveState(status, OrderConstants.StatusConfirmed, HasReached(status, OrderConstants.StatusShipping)),
            FindStatusAt(order, OrderConstants.StatusShipping),
            null,
            string.IsNullOrWhiteSpace(order.Tracking?.TrackingCode)
                ? null
                : $"Tracking: {order.Tracking.TrackingCode}."));

        steps.Add(BuildStep(
            "delivered",
            "Delivered",
            ResolveState(status, OrderConstants.StatusShipping, HasReached(status, OrderConstants.StatusDelivered)),
            FindStatusAt(order, OrderConstants.StatusDelivered),
            null,
            null));

        if (HasReached(status, OrderConstants.StatusDelivered) && !HasReached(status, OrderConstants.StatusCompleted))
        {
            steps.Add(BuildStep(
                "confirm_or_auto",
                "Confirm receipt",
                "current",
                null,
                autoCompleteDue,
                $"Auto-confirms on {autoCompleteDue:MMM d, yyyy} if you do not confirm or request a return."));
        }

        if (HasReached(status, OrderConstants.StatusCompleted))
        {
            steps.Add(BuildStep(
                "completed",
                "Order completed",
                "done",
                completedAt,
                null,
                null));

            var returnState = returnRequest is not null
                ? "warning"
                : returnDeadline.HasValue && now <= returnDeadline.Value
                    ? "current"
                    : "done";

            steps.Add(BuildStep(
                "return_window",
                "Return window",
                returnState,
                completedAt,
                returnDeadline,
                returnDeadline.HasValue
                    ? $"You can request a return with video evidence until {returnDeadline.Value:MMM d, yyyy}."
                    : null));
        }

        if (_protectionOptions.ShowEscrowNote && HasReached(status, OrderConstants.StatusPaid))
        {
            steps.Add(BuildStep(
                "protection",
                "Buyer protection",
                "info",
                null,
                null,
                "Funds are held until you confirm delivery or the return period ends."));
        }

        if (returnRequest is not null)
        {
            steps.Add(BuildStep(
                "return_progress",
                "Return in progress",
                "warning",
                returnRequest.CreatedAt,
                null,
                $"Status: {returnRequest.Status}."));
        }

        var trackingUrl = BuildTrackingUrl(order.Tracking?.TrackingCode);

        var canOpen = returnRequest is null
            && HasReached(status, OrderConstants.StatusCompleted)
            && returnDeadline.HasValue
            && now <= returnDeadline.Value;

        return new BuyerProtectionTimelineDto
        {
            OrderId = order.OrderId,
            OrderStatus = order.Status,
            Currency = order.Currency,
            Steps = steps,
            ReturnRequest = new BuyerProtectionReturnSummaryDto
            {
                Status = returnRequest?.Status,
                CanOpen = canOpen,
                ReturnDeadline = returnDeadline
            },
            ShipmentTrackingUrl = trackingUrl
        };
    }

    private string? BuildTrackingUrl(string? trackingCode)
    {
        if (string.IsNullOrWhiteSpace(trackingCode))
            return null;

        return $"https://donhang.ghn.vn/?order_code={Uri.EscapeDataString(trackingCode)}";
    }

    private static DateTime? FindStatusAt(BuyerOrderDetailDto order, string toStatus)
    {
        return order.StatusHistory
            .Where(h => string.Equals(h.ToStatus, toStatus, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(h => h.CreatedAt)
            .Select(h => (DateTime?)h.CreatedAt)
            .FirstOrDefault();
    }

    private static bool HasReached(string currentStatus, string targetStatus)
    {
        var order = new[]
        {
            OrderConstants.StatusPendingPayment,
            OrderConstants.StatusPaid,
            OrderConstants.StatusConfirmed,
            OrderConstants.StatusShipping,
            OrderConstants.StatusDelivered,
            OrderConstants.StatusCompleted
        };

        var currentIdx = Array.FindIndex(order, s =>
            string.Equals(s, currentStatus, StringComparison.OrdinalIgnoreCase));
        var targetIdx = Array.FindIndex(order, s =>
            string.Equals(s, targetStatus, StringComparison.OrdinalIgnoreCase));

        if (currentIdx < 0 || targetIdx < 0)
            return false;

        return currentIdx >= targetIdx;
    }

    private static string ResolveState(string currentStatus, string beforeStatus, bool reached)
    {
        if (string.Equals(currentStatus, OrderConstants.StatusCancelled, StringComparison.OrdinalIgnoreCase))
            return "cancelled";

        if (reached)
            return "done";

        if (string.Equals(currentStatus, beforeStatus, StringComparison.OrdinalIgnoreCase))
            return "current";

        return "upcoming";
    }

    private static BuyerProtectionTimelineStepDto BuildStep(
        string key,
        string label,
        string state,
        DateTime? at,
        DateTime? dueAt,
        string? detail) =>
        new()
        {
            Key = key,
            Label = label,
            State = state,
            At = at,
            DueAt = dueAt,
            Detail = detail
        };
}
