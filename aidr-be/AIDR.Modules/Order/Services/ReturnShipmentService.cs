using System.Text.Json;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Modules.Order.Abstractions;
using AIDR.Modules.Shipping.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Dtos.Shipping;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AIDR.Modules.Order.Services;

public sealed class ReturnShipmentService : IReturnShipmentService
{
    private readonly IReturnShipmentRepository _repo;
    private readonly IShippingProvider _provider;
    private readonly INotificationService _notifications;
    private readonly ShippingOptions _shippingOptions;
    private readonly ILogger<ReturnShipmentService> _logger;

    public ReturnShipmentService(
        IReturnShipmentRepository repo,
        IEnumerable<IShippingProvider> providers,
        INotificationService notifications,
        IOptions<ShippingOptions> shippingOptions,
        ILogger<ReturnShipmentService> logger)
    {
        _repo = repo;
        _provider = providers.FirstOrDefault(p =>
            string.Equals(p.Name, ShippingConstants.ProviderGhn, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("GHN provider not registered.");
        _notifications = notifications;
        _shippingOptions = shippingOptions.Value;
        _logger = logger;
    }

    public async Task<ReturnShipmentDto> DispatchAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken = default)
    {
        var ctx = await _repo.LoadDispatchContextAsync(returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        if (!_provider.IsConfigured || !_shippingOptions.EnableAutoFulfillment)
        {
            // Leave the return at SellerConfirmed — admin/seller can manually advance.
            // Marking PickupFailed here would confuse the flow when GHN is simply
            // not configured in a dev/staging environment.
            _logger.LogWarning(
                "GHN not configured or auto-fulfillment disabled; skipping return dispatch for {ReturnRequestId}",
                returnRequestId);
            throw new AppException("GHN shipping is not configured for automatic dispatch.");
        }

        var request = BuildDispatchRequest(ctx);

        ShipmentDispatchResult result;
        try
        {
            result = await _provider.CreateShipmentAsync(request, cancellationToken);
        }
        catch (Exception ex)
        {
            var error = ex.Message.Length > 500 ? ex.Message[..500] : ex.Message;
            _logger.LogWarning(ex,
                "GHN dispatch failed for return {ReturnRequestId}: {Error}",
                returnRequestId, error);

            await _repo.MarkPickupFailedAsync(returnRequestId, error, cancellationToken);
            await NotifyAdminsPickupFailedAsync(ctx.ReturnRequestId, ctx.OrderCode, cancellationToken);
            return await GetOrThrowAsync(returnRequestId, cancellationToken);
        }

        var dto = await _repo.SaveDispatchAsync(returnRequestId, ShippingConstants.ProviderGhn, result, cancellationToken);
        await NotifyBuyerPickupScheduledAsync(ctx, dto, cancellationToken);
        return dto;
    }

    public async Task<ReturnShipmentWebhookResult> HandleWebhookAsync(
        string provider,
        string rawPayload,
        string? token,
        CancellationToken cancellationToken = default)
    {
        if (!string.Equals(provider, ShippingConstants.ProviderGhn, StringComparison.OrdinalIgnoreCase))
            return new ReturnShipmentWebhookResult { Applied = false, Message = $"Provider '{provider}' not handled." };

        if (!_provider.IsWebhookAuthentic(token))
            return new ReturnShipmentWebhookResult { Applied = false, Message = "Invalid webhook token." };

        ShipmentWebhookEvent evt;
        try
        {
            evt = _provider.ParseWebhook(rawPayload);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse GHN return-shipment webhook");
            return new ReturnShipmentWebhookResult { Applied = false, Message = "Unparseable payload." };
        }

        // Only handle return shipments (prefixed RTN-)
        var clientCode = evt.OrderCode;
        if (clientCode is null || !clientCode.StartsWith(ReturnConstants.ReturnShipmentPrefix, StringComparison.OrdinalIgnoreCase))
            return new ReturnShipmentWebhookResult { Applied = false, Message = "Not a return shipment." };

        var mappedShipmentStatus = _provider.MapStatus(evt.ProviderStatus);
        if (!ReturnConstants.ReturnShipmentToReturnStatus.TryGetValue(mappedShipmentStatus, out var newReturnStatus))
            return new ReturnShipmentWebhookResult { Applied = false, Message = $"No return status mapping for {mappedShipmentStatus}." };

        var result = await _repo.ApplyWebhookEventAsync(
            evt.ProviderShipmentId,
            clientCode,
            evt.ProviderStatus,
            mappedShipmentStatus,
            newReturnStatus,
            $"{evt.ProviderStatus}:{(evt.OccurredAt ?? DateTime.UtcNow):yyyyMMddHHmmss}",
            evt.Description,
            evt.OccurredAt ?? DateTime.UtcNow,
            rawPayload,
            cancellationToken);

        if (result.Applied && !result.IdempotentReplay)
        {
            await NotifyBuyerShipmentProgressAsync(result, cancellationToken);
        }

        return result;
    }

    public async Task<ReturnShipmentDto> RetryDispatchAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken = default)
    {
        await _repo.ResetForRetryAsync(returnRequestId, cancellationToken);
        return await DispatchAsync(returnRequestId, cancellationToken);
    }

    public async Task MarkReceivingManuallyAsync(
        Guid returnRequestId,
        Guid adminUserId,
        string? note,
        CancellationToken cancellationToken = default)
    {
        await _repo.MarkReceivingManuallyAsync(returnRequestId, adminUserId, note, cancellationToken);
    }

    public Task<ReturnShipmentDto?> GetByReturnRequestAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken = default) =>
        _repo.GetByReturnRequestAsync(returnRequestId, cancellationToken);

    // -----------------------------------------------------------------------

    private static ShipmentDispatchRequest BuildDispatchRequest(ReturnDispatchContext ctx)
    {
        var returnCode = $"{ReturnConstants.ReturnShipmentPrefix}{ctx.ReturnRequestId:N}";
        return new ShipmentDispatchRequest
        {
            OrderId    = ctx.OrderId,
            OrderCode  = returnCode,
            // Buyer is the sender for the reverse shipment
            SenderName          = ctx.BuyerReceiverName,
            SenderPhone         = ctx.BuyerPhone,
            SenderProvince      = ctx.BuyerProvince,
            SenderDistrict      = ctx.BuyerDistrict,
            SenderWard          = ctx.BuyerWard,
            SenderStreetAddress = ctx.BuyerStreetAddress,
            // Seller shop is the receiver
            ReceiverName  = ctx.ShopName,
            ReceiverPhone = ctx.ShopPhone ?? string.Empty,
            Province      = ctx.ShopProvince ?? string.Empty,
            District      = ctx.ShopDistrict ?? string.Empty,
            Ward          = ctx.ShopWard ?? string.Empty,
            StreetAddress = ctx.ShopStreetAddress ?? string.Empty,
            CodAmount      = 0,
            InsuranceValue = ctx.OrderTotalAmount,
            TotalWeightGram = 500,
            Note = $"Hàng hoàn trả đơn {ctx.OrderCode}",
            Items = ctx.Items
        };
    }

    private async Task<ReturnShipmentDto> GetOrThrowAsync(Guid returnRequestId, CancellationToken ct)
    {
        return await _repo.GetByReturnRequestAsync(returnRequestId, ct)
            ?? throw new InvalidOperationException($"ReturnShipment not found after dispatch for {returnRequestId}.");
    }

    private async Task NotifyBuyerPickupScheduledAsync(
        ReturnDispatchContext ctx,
        ReturnShipmentDto shipment,
        CancellationToken ct)
    {
        try
        {
            await _notifications.CreateAsync(new CreateNotificationRequest
            {
                UserId        = ctx.BuyerUserId,
                Title         = "Shipper sẽ đến lấy hàng hoàn trả",
                Body          = $"Đơn vị vận chuyển sẽ đến địa chỉ giao hàng của bạn để lấy hàng hoàn trả cho đơn {ctx.OrderCode}. Mã vận đơn: {shipment.TrackingCode}.",
                Type          = NotificationConstants.TypeReturn,
                ReferenceType = NotificationConstants.RefReturnRequest,
                ReferenceId   = ctx.ReturnRequestId
            }, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Failed to notify buyer {BuyerId} about return pickup for {ReturnRequestId}",
                ctx.BuyerUserId, ctx.ReturnRequestId);
        }
    }

    private async Task NotifyAdminsPickupFailedAsync(Guid returnRequestId, string orderCode, CancellationToken ct)
    {
        IReadOnlyList<Guid> adminIds;
        try { adminIds = await _repo.ListAdminUserIdsAsync(ct); }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load admin ids for pickup-failed notification");
            return;
        }

        foreach (var adminId in adminIds)
        {
            try
            {
                await _notifications.CreateAsync(new CreateNotificationRequest
                {
                    UserId        = adminId,
                    Title         = "Không thể tạo đơn vận chuyển hoàn trả",
                    Body          = $"GHN không thể tạo đơn lấy hàng hoàn trả cho đơn {orderCode}. Cần can thiệp thủ công.",
                    Type          = NotificationConstants.TypeReturn,
                    ReferenceType = NotificationConstants.RefReturnRequest,
                    ReferenceId   = returnRequestId
                }, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Failed to notify admin {AdminId} about return pickup failure {ReturnRequestId}",
                    adminId, returnRequestId);
            }
        }
    }

    private async Task NotifyBuyerShipmentProgressAsync(
        ReturnShipmentWebhookResult result,
        CancellationToken ct)
    {
        if (result.BuyerUserId == Guid.Empty)
            return;

        var (title, body) = result.ReturnStatus switch
        {
            ReturnConstants.StatusPickedUp  => (
                "Shipper đã lấy hàng hoàn trả",
                $"Đơn vị vận chuyển đã lấy hàng hoàn trả của bạn và đang vận chuyển về phía người bán."),
            ReturnConstants.StatusInTransit => (
                "Hàng hoàn trả đang trên đường",
                $"Hàng hoàn trả của bạn đang được vận chuyển đến người bán."),
            ReturnConstants.StatusReceiving => (
                "Hàng hoàn trả đã đến nơi",
                $"Hàng hoàn trả của bạn đã đến kho người bán. Chờ người bán kiểm tra."),
            ReturnConstants.StatusPickupFailed => (
                "Lấy hàng hoàn trả thất bại",
                $"Đơn vị vận chuyển không thể lấy hàng hoàn trả của bạn. Chúng tôi sẽ xử lý và liên hệ lại."),
            _ => (string.Empty, string.Empty)
        };

        if (string.IsNullOrEmpty(title))
            return;

        try
        {
            await _notifications.CreateAsync(new CreateNotificationRequest
            {
                UserId        = result.BuyerUserId,
                Title         = title,
                Body          = body,
                Type          = NotificationConstants.TypeReturn,
                ReferenceType = NotificationConstants.RefReturnRequest,
                ReferenceId   = result.ReturnRequestId
            }, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Failed to notify buyer {BuyerId} about return shipment progress {ReturnRequestId}",
                result.BuyerUserId, result.ReturnRequestId);
        }
    }
}
