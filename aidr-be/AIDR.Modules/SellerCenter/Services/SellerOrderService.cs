using AIDR.Modules.Engagement.Abstractions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;

namespace AIDR.Modules.SellerCenter.Services;

public sealed class SellerOrderService : ISellerOrderService
{
    private readonly ISellerProductRepository _products;
    private readonly ISellerOrderRepository _orders;
    private readonly INotificationService _notifications;
    private readonly ILogger<SellerOrderService> _logger;

    public SellerOrderService(
        ISellerProductRepository products,
        ISellerOrderRepository orders,
        INotificationService notifications,
        ILogger<SellerOrderService> logger)
    {
        _products = products;
        _orders = orders;
        _notifications = notifications;
        _logger = logger;
    }

    public async Task<SellerOrderListResultDto> ListAsync(
        Guid ownerUserId,
        SellerOrderQueryRequest request,
        CancellationToken cancellationToken = default)
    {
        var shop = await RequireActiveShopAsync(ownerUserId, cancellationToken);
        var normalizedStatus = NormalizeStatusFilter(request.Status);
        var (page, pageSize) = OrderConstants.NormalizePaging(request.Page, request.PageSize);

        var (items, totalCount, effectivePage) = await _orders.ListByShopAsync(
            shop.ShopId,
            normalizedStatus,
            page,
            pageSize,
            cancellationToken);

        return new SellerOrderListResultDto
        {
            Items = items,
            Page = effectivePage,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<SellerOrderDetailDto> GetByIdAsync(
        Guid ownerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default)
    {
        EnsureOrderId(orderId);
        var shop = await RequireActiveShopAsync(ownerUserId, cancellationToken);

        return await _orders.GetByIdForShopAsync(shop.ShopId, orderId, cancellationToken)
            ?? throw new NotFoundException("Order not found.");
    }

    public async Task<SellerOrderDetailDto> UpdateStatusAsync(
        Guid ownerUserId,
        Guid orderId,
        UpdateSellerOrderRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureOrderId(orderId);
        var shop = await RequireActiveShopAsync(ownerUserId, cancellationToken);

        var toStatus = NormalizeTargetStatus(request.Status);
        var trackingCode = NormalizeOptional(
            request.TrackingCode,
            "Tracking code",
            OrderConstants.MaxTrackingCodeLength);
        var sellerNote = NormalizeOptional(
            request.SellerNote,
            "Seller note",
            OrderConstants.MaxSellerNoteLength);
        var historyNote = NormalizeOptional(
            request.Note,
            "Status note",
            OrderConstants.MaxStatusNoteLength);

        var updated = await _orders.UpdateStatusAsync(
            shop.ShopId,
            orderId,
            ownerUserId,
            toStatus,
            trackingCode,
            sellerNote,
            historyNote,
            cancellationToken);

        await NotifyBuyerOrderStatusAsync(updated, cancellationToken);
        return updated;
    }

    private async Task NotifyBuyerOrderStatusAsync(
        SellerOrderDetailDto order,
        CancellationToken cancellationToken)
    {
        if (order.BuyerUserId == Guid.Empty)
            return;

        var tracking = string.IsNullOrWhiteSpace(order.TrackingCode)
            ? string.Empty
            : $" Tracking: {order.TrackingCode}.";

        try
        {
            await _notifications.CreateAsync(
                new CreateNotificationRequest
                {
                    UserId = order.BuyerUserId,
                    Title = "Order status updated",
                    Body = $"Order {order.OrderCode} is now {order.Status}.{tracking}",
                    Type = NotificationConstants.TypeOrder,
                    ReferenceType = NotificationConstants.RefOrder,
                    ReferenceId = order.OrderId
                },
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to notify buyer {BuyerId} about order status {OrderId}",
                order.BuyerUserId,
                order.OrderId);
        }
    }

    private async Task<SellerShopRecord> RequireActiveShopAsync(
        Guid ownerUserId,
        CancellationToken cancellationToken)
    {
        if (ownerUserId == Guid.Empty)
            throw new AppException("User id is required.");

        return await _products.GetActiveShopByOwnerAsync(ownerUserId, cancellationToken)
            ?? throw new ForbiddenAppException("Active shop not found for the current seller.");
    }

    private static string? NormalizeStatusFilter(string? status)
    {
        if (string.IsNullOrWhiteSpace(status) ||
            string.Equals(status.Trim(), "all", StringComparison.OrdinalIgnoreCase))
            return null;

        var normalized = status.Trim();
        if (!OrderConstants.SellerListStatuses.Contains(normalized))
            throw new AppException("Order status filter is invalid.");

        return OrderConstants.SellerListStatuses
            .First(s => string.Equals(s, normalized, StringComparison.OrdinalIgnoreCase));
    }

    private static string NormalizeTargetStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
            throw new AppException("Order status is required.");

        var normalized = status.Trim();
        var allowedTargets = OrderConstants.SellerStatusTransitions.Values
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (!allowedTargets.Contains(normalized))
            throw new AppException(
                "Seller can only update status to Confirmed, Shipping, or Delivered.");

        return OrderConstants.SellerStatusTransitions.Values
            .First(v => string.Equals(v, normalized, StringComparison.OrdinalIgnoreCase));
    }

    private static string? NormalizeOptional(string? value, string fieldName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new AppException($"{fieldName} must not exceed {maxLength} characters.");

        return trimmed;
    }

    private static void EnsureOrderId(Guid orderId)
    {
        if (orderId == Guid.Empty)
            throw new AppException("Order id is required.");
    }
}
