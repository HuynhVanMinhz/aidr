using AIDR.Modules.Engagement.Abstractions;
using AIDR.Modules.Shipping.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Dtos.Shipping;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AIDR.Modules.Shipping.Services;

/// <summary>
/// Drives an order through Confirmed → Shipping → Delivered without anyone
/// clicking: books a real GHN shipment once payment settles, then lets the
/// carrier's own events (webhook first, polling as a backstop) move the order.
///
/// The seller can still push the status by hand at any point — automation and
/// the manual path share the same forward-only transition rules, so whichever
/// happens first wins and the other becomes a no-op.
///
/// Delivered → Completed is not here — <c>SettlementBackgroundService</c> already
/// owns that step.
/// </summary>
public sealed class ShippingService : IShippingService
{
    private readonly IShipmentRepository _shipments;
    private readonly IEnumerable<IShippingProvider> _providers;
    private readonly INotificationService _notifications;
    private readonly ShippingOptions _options;
    private readonly ILogger<ShippingService> _logger;

    public ShippingService(
        IShipmentRepository shipments,
        IEnumerable<IShippingProvider> providers,
        INotificationService notifications,
        IOptions<ShippingOptions> options,
        ILogger<ShippingService> logger)
    {
        _shipments = shipments;
        _providers = providers;
        _notifications = notifications;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<ShippingSweepResult> RunSweepAsync(CancellationToken ct = default)
    {
        if (!_options.EnableAutoFulfillment)
        {
            return new ShippingSweepResult();
        }

        var errors = new List<string>();
        var created = 0;
        var applied = 0;
        var advanced = 0;
        var failures = 0;

        try
        {
            var dispatch = await DispatchPaidOrdersAsync(ct);
            created = dispatch.Created;
            advanced += dispatch.OrdersAdvanced;
            failures = dispatch.Failures;
            errors.AddRange(dispatch.Errors);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Shipment dispatch step failed");
            errors.Add($"dispatch: {ex.Message}");
        }

        try
        {
            var progress = await PollActiveShipmentsAsync(ct);
            applied = progress.Applied;
            advanced += progress.OrdersAdvanced;
            errors.AddRange(progress.Errors);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Shipment polling step failed");
            errors.Add($"poll: {ex.Message}");
        }

        return new ShippingSweepResult
        {
            ShipmentsCreated = created,
            EventsApplied = applied,
            OrdersAdvanced = advanced,
            DispatchFailures = failures,
            Errors = errors
        };
    }

    public async Task<ShippingWebhookResult> HandleWebhookAsync(
        string provider,
        string rawPayload,
        string? token,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(rawPayload))
            throw new AppException("Webhook payload is empty.");

        var adapter = ResolveProviderByName(provider);

        if (!adapter.IsWebhookAuthentic(token))
            throw new ForbiddenAppException("Webhook token is invalid.");

        var parsed = adapter.ParseWebhook(rawPayload);

        var shipment = await _shipments.FindShipmentAsync(
            adapter.Name,
            parsed.ProviderShipmentId,
            parsed.OrderCode,
            ct);

        if (shipment is null)
        {
            // A 404 here would make the carrier retry forever for an order we
            // never booked; log it and accept.
            _logger.LogWarning(
                "Shipping webhook for unknown shipment {ProviderShipmentId} ({Provider})",
                parsed.ProviderShipmentId,
                adapter.Name);

            return new ShippingWebhookResult
            {
                Processed = false,
                Message = "Shipment not found for this webhook."
            };
        }

        var mapped = adapter.MapStatus(parsed.ProviderStatus);
        var occurredAt = parsed.OccurredAt ?? DateTime.UtcNow;

        var result = await _shipments.ApplyEventAsync(
            shipment.ShipmentId,
            new ShipmentEventInput
            {
                ProviderStatus = parsed.ProviderStatus,
                MappedStatus = mapped,
                ExternalEventId = parsed.ExternalEventId
                    ?? BuildEventKey(parsed.ProviderStatus, occurredAt),
                Source = ShippingConstants.SourceWebhook,
                Description = parsed.Description,
                OccurredAt = occurredAt,
                RawJson = rawPayload
            },
            ct);

        await NotifyAsync(result, ct);

        return ToWebhookResult(result);
    }

    public async Task<OrderFulfillmentDto> GetFulfillmentAsync(Guid orderId, CancellationToken ct = default)
    {
        if (orderId == Guid.Empty)
            throw new AppException("Order id is required.");

        var shipment = await _shipments.GetByOrderAsync(orderId, ct);
        return BuildFulfillment(shipment, _options);
    }

    /* ------------------------------ sweep steps ------------------------------ */

    private async Task<(int Created, int OrdersAdvanced, int Failures, List<string> Errors)>
        DispatchPaidOrdersAsync(CancellationToken ct)
    {
        var errors = new List<string>();
        var provider = ResolveActiveProvider();

        var paidBefore = DateTime.UtcNow.AddMinutes(-Math.Max(0, _options.ConfirmDelayMinutes));
        var candidates = await _shipments.GetDispatchCandidatesAsync(
            paidBefore,
            Math.Max(1, _options.MaxDispatchAttempts),
            Math.Max(1, _options.BatchSize),
            ct);

        var created = 0;
        var advanced = 0;
        var failures = 0;

        foreach (var candidate in candidates)
        {
            ct.ThrowIfCancellationRequested();

            try
            {
                var dispatch = await provider.CreateShipmentAsync(ToDispatchRequest(candidate), ct);

                var result = await _shipments.SaveDispatchAsync(
                    candidate.OrderId,
                    provider.Name,
                    dispatch,
                    NextPollAt(DateTime.UtcNow),
                    ct);

                if (!result.Applied)
                    continue;

                created++;
                if (result.OrderAdvanced)
                {
                    advanced++;
                    await NotifyAsync(result, ct);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                failures++;
                errors.Add($"order {candidate.OrderCode}: {ex.Message}");
                _logger.LogWarning(
                    ex,
                    "Booking a shipment for order {OrderCode} failed (attempt {Attempt})",
                    candidate.OrderCode,
                    candidate.AttemptCount + 1);

                await _shipments.MarkDispatchFailedAsync(
                    candidate.OrderId,
                    provider.Name,
                    Truncate(ex.Message, ShippingConstants.MaxErrorLength),
                    ct);
            }
        }

        return (created, advanced, failures, errors);
    }

    private async Task<(int Applied, int OrdersAdvanced, List<string> Errors)>
        PollActiveShipmentsAsync(CancellationToken ct)
    {
        var errors = new List<string>();
        var due = await _shipments.GetShipmentsDueAsync(
            DateTime.UtcNow,
            Math.Max(1, _options.BatchSize),
            ct);

        var applied = 0;
        var advanced = 0;

        foreach (var shipment in due)
        {
            ct.ThrowIfCancellationRequested();

            try
            {
                var result = await PollCarrierAsync(shipment, ct);

                if (result is null || !result.Applied)
                    continue;

                applied++;
                if (result.OrderAdvanced)
                {
                    advanced++;
                    await NotifyAsync(result, ct);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                errors.Add($"shipment {shipment.ShipmentId}: {ex.Message}");
                _logger.LogWarning(ex, "Polling shipment {ShipmentId} failed", shipment.ShipmentId);
            }
        }

        return (applied, advanced, errors);
    }

    private async Task<ShipmentTransitionResult?> PollCarrierAsync(
        ShipmentDue shipment,
        CancellationToken ct)
    {
        var provider = ResolveProviderByName(shipment.Provider);
        var nextPoll = NextPollAt(DateTime.UtcNow);

        if (string.IsNullOrWhiteSpace(shipment.ProviderShipmentId))
        {
            await _shipments.TouchPolledAsync(shipment.ShipmentId, nextPoll, ct);
            return null;
        }

        var snapshot = await provider.GetTrackingAsync(shipment.ProviderShipmentId, ct);

        if (snapshot is null)
        {
            await _shipments.TouchPolledAsync(shipment.ShipmentId, nextPoll, ct);
            return null;
        }

        var occurredAt = snapshot.OccurredAt == default ? DateTime.UtcNow : snapshot.OccurredAt;

        return await _shipments.ApplyEventAsync(
            shipment.ShipmentId,
            new ShipmentEventInput
            {
                ProviderStatus = snapshot.ProviderStatus,
                MappedStatus = snapshot.MappedStatus,
                ExternalEventId = snapshot.ExternalEventId
                    ?? BuildEventKey(snapshot.ProviderStatus, occurredAt),
                Source = ShippingConstants.SourcePoll,
                Description = snapshot.Description,
                OccurredAt = occurredAt,
                RawJson = snapshot.RawJson,
                NextActionAt = nextPoll
            },
            ct);
    }

    /* -------------------------------- helpers -------------------------------- */

    /// <summary>
    /// What the seller UI shows next to the order. The seller keeps the manual
    /// controls either way; this only says who is expected to move it and flags
    /// a booking the carrier refused.
    /// </summary>
    public static OrderFulfillmentDto BuildFulfillment(
        ShipmentDto? shipment,
        ShippingOptions options,
        OrderRouteDto? route = null)
    {
        route ??= new OrderRouteDto();

        if (!options.EnableAutoFulfillment || !options.IsProviderConfigured)
        {
            return new OrderFulfillmentDto
            {
                AutoEnabled = false,
                Provider = options.NormalizedProvider,
                RequiresSellerAction = true,
                StalledReason = options.EnableAutoFulfillment
                    ? $"{options.NormalizedProvider} has no credentials configured, so no shipment can be booked — update this order manually."
                    : "Automatic fulfillment is turned off; update this order manually.",
                Shipment = shipment,
                Route = route
            };
        }

        if (shipment is null)
        {
            return new OrderFulfillmentDto
            {
                AutoEnabled = true,
                Provider = options.NormalizedProvider,
                RequiresSellerAction = false,
                Shipment = null,
                Route = route
            };
        }

        var exhausted =
            string.Equals(shipment.Status, ShippingConstants.ShipmentPending, StringComparison.OrdinalIgnoreCase) &&
            shipment.AttemptCount >= Math.Max(1, options.MaxDispatchAttempts);

        var failed = string.Equals(
            shipment.Status,
            ShippingConstants.ShipmentFailed,
            StringComparison.OrdinalIgnoreCase);

        var stalledReason = exhausted
            ? shipment.LastError ?? "The carrier refused this shipment."
            : failed
                ? "The carrier could not deliver this shipment."
                : null;

        return new OrderFulfillmentDto
        {
            AutoEnabled = true,
            Provider = shipment.Provider,
            RequiresSellerAction = exhausted || failed,
            StalledReason = stalledReason,
            Shipment = shipment,
            Route = route
        };
    }

    /// <summary>
    /// The two ends of a delivery. A missing coordinate is normal — a shop that
    /// never pinned its pickup point, or an order placed before the map existed —
    /// and the map is expected to cope with one end, or neither.
    /// </summary>
    public static OrderRouteDto BuildRoute(
        double? pickupLat,
        double? pickupLng,
        string pickupLabel,
        double? destinationLat,
        double? destinationLng,
        string destinationLabel) => new()
    {
        Pickup = ToPoint(pickupLat, pickupLng),
        PickupLabel = pickupLabel,
        Destination = ToPoint(destinationLat, destinationLng),
        DestinationLabel = destinationLabel
    };

    private static GeoPointDto? ToPoint(double? lat, double? lng)
    {
        if (lat is not { } latitude || lng is not { } longitude)
            return null;

        // 0,0 is the Atlantic; it is what a half-filled row looks like, not a pin.
        if (latitude == 0 && longitude == 0)
            return null;

        return double.IsNaN(latitude) || double.IsNaN(longitude)
            ? null
            : new GeoPointDto { Lat = latitude, Lng = longitude };
    }

    private IShippingProvider ResolveActiveProvider()
    {
        var name = _options.NormalizedProvider;
        var provider = _providers.FirstOrDefault(p =>
            string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase))
            ?? throw new AppException($"Shipping provider '{name}' is not registered.");

        if (!provider.IsConfigured)
        {
            throw new AppException(
                $"Shipping provider '{provider.Name}' is not configured: set Shipping:Ghn:Token and Shipping:Ghn:ShopId.");
        }

        return provider;
    }

    private IShippingProvider ResolveProviderByName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new AppException("Shipping provider is required.");

        return _providers.FirstOrDefault(p =>
            string.Equals(p.Name, name.Trim(), StringComparison.OrdinalIgnoreCase))
            ?? throw new NotFoundException($"Shipping provider '{name}' is not registered.");
    }

    private ShipmentDispatchRequest ToDispatchRequest(ShipmentDispatchCandidate candidate) => new()
    {
        OrderId = candidate.OrderId,
        OrderCode = candidate.OrderCode,
        SenderName = candidate.ShopName,
        SenderPhone = RequireShopField(candidate, candidate.ShopPhone, "phone number"),
        SenderProvince = RequireShopField(candidate, candidate.ShopProvince, "province"),
        SenderDistrict = RequireShopField(candidate, candidate.ShopDistrict, "district"),
        SenderWard = RequireShopField(candidate, candidate.ShopWard, "ward"),
        SenderStreetAddress = RequireShopField(candidate, candidate.ShopStreetAddress, "street address"),
        ReceiverName = candidate.ReceiverName,
        ReceiverPhone = candidate.ReceiverPhone,
        Province = candidate.Province,
        District = candidate.District,
        Ward = candidate.Ward,
        StreetAddress = candidate.StreetAddress,
        Note = candidate.BuyerNote,
        // payOS already collected the money, so nothing is due on delivery.
        CodAmount = 0m,
        InsuranceValue = candidate.TotalAmount,
        TotalWeightGram = Math.Max(
            _options.Ghn.DefaultWeightGram,
            candidate.Items.Sum(i => i.WeightGram * Math.Max(1, i.Quantity))),
        Items = candidate.Items
    };

    /// <summary>
    /// The carrier needs a real pickup point. Failing here rather than at the
    /// carrier turns a cryptic GHN rejection into something the seller can act
    /// on — the message lands in the shipment's LastError and on their screen.
    /// </summary>
    private static string RequireShopField(ShipmentDispatchCandidate candidate, string? value, string field) =>
        string.IsNullOrWhiteSpace(value)
            ? throw new AppException(
                $"Shop '{candidate.ShopName}' has no pickup {field}; complete the shop address in Shop settings before a shipment can be booked.")
            : value.Trim();

    private DateTime NextPollAt(DateTime now) =>
        now.AddMinutes(Math.Max(1, _options.PollIntervalMinutes));

    private static string BuildEventKey(string status, DateTime occurredAt) =>
        $"{status}:{occurredAt:yyyyMMddHHmmss}";

    private static ShippingWebhookResult ToWebhookResult(ShipmentTransitionResult result) => new()
    {
        Processed = result.Applied,
        IdempotentReplay = result.IdempotentReplay,
        Message = result.Message,
        OrderId = result.OrderId == Guid.Empty ? null : result.OrderId,
        OrderStatus = result.OrderStatus,
        ShipmentStatus = result.ShipmentStatus
    };

    private async Task NotifyAsync(ShipmentTransitionResult result, CancellationToken ct)
    {
        if (!result.OrderAdvanced || result.BuyerUserId == Guid.Empty)
            return;

        var tracking = string.IsNullOrWhiteSpace(result.TrackingCode)
            ? string.Empty
            : $" Tracking: {result.TrackingCode}.";

        try
        {
            await _notifications.CreateAsync(
                new CreateNotificationRequest
                {
                    UserId = result.BuyerUserId,
                    Title = "Order status updated",
                    Body = $"Order {result.OrderCode} is now {result.OrderStatus}.{tracking}",
                    Type = NotificationConstants.TypeOrder,
                    ReferenceType = NotificationConstants.RefOrder,
                    ReferenceId = result.OrderId
                },
                ct);
        }
        catch (Exception ex)
        {
            // A missed notification must not roll back a shipment event.
            _logger.LogWarning(
                ex,
                "Failed to notify buyer {BuyerId} about order {OrderId}",
                result.BuyerUserId,
                result.OrderId);
        }
    }

    private static string Truncate(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];
}
