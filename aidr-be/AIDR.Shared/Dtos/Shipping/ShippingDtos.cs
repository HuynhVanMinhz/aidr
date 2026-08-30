namespace AIDR.Shared.Dtos.Shipping;

/// <summary>Shipment as shown on the seller order screen.</summary>
public sealed class ShipmentDto
{
    public Guid ShipmentId { get; init; }
    public Guid OrderId { get; init; }
    public string Provider { get; init; } = null!;
    public string? ProviderShipmentId { get; init; }
    public string? TrackingCode { get; init; }
    public string Status { get; init; } = null!;
    public string? ProviderStatus { get; init; }
    public decimal? ShippingFeeQuoted { get; init; }
    public DateTime? ExpectedDeliveryAt { get; init; }
    public DateTime? LastSyncedAt { get; init; }
    public int AttemptCount { get; init; }
    public string? LastError { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public IReadOnlyList<ShipmentEventDto> Events { get; init; } = Array.Empty<ShipmentEventDto>();
}

public sealed class ShipmentEventDto
{
    public Guid ShipmentEventId { get; init; }
    public string ProviderStatus { get; init; } = null!;
    public string MappedStatus { get; init; } = null!;
    public string? Description { get; init; }
    public string Source { get; init; } = null!;
    public DateTime OccurredAt { get; init; }
}

/// <summary>
/// What the seller UI needs to decide between "watch the carrier" and "let me
/// push the status myself".
/// </summary>
public sealed class OrderFulfillmentDto
{
    /// <summary>Auto fulfillment is switched on for the platform.</summary>
    public bool AutoEnabled { get; init; }

    /// <summary>Provider that will handle (or is handling) this order.</summary>
    public string Provider { get; init; } = null!;

    /// <summary>Automation cannot move this order any further — the seller has to.</summary>
    public bool RequiresSellerAction { get; init; }

    /// <summary>Why automation stalled, if it did.</summary>
    public string? StalledReason { get; init; }

    public ShipmentDto? Shipment { get; init; }

    /// <summary>The two ends of the delivery, for the tracking map.</summary>
    public OrderRouteDto Route { get; init; } = new();
}

/// <summary>One point on a map.</summary>
public sealed class GeoPointDto
{
    public double Lat { get; init; }
    public double Lng { get; init; }
}

/// <summary>
/// Where a parcel starts and where it is going.
///
/// The carrier reports a status, never a position — there is no courier GPS feed
/// behind any of this — so the map draws the parcel along this line at the point
/// its status implies. Either end is null when nobody has pinned it yet, and the
/// map then falls back to showing only the end it has.
/// </summary>
public sealed class OrderRouteDto
{
    public GeoPointDto? Pickup { get; init; }
    public string PickupLabel { get; init; } = string.Empty;
    public GeoPointDto? Destination { get; init; }
    public string DestinationLabel { get; init; } = string.Empty;

    public bool HasAnyPoint => Pickup is not null || Destination is not null;
}

/// <summary>
/// What the buyer may see about the parcel. Retry counts and raw carrier errors
/// stay on the seller side — they are the seller's problem to fix, not the
/// buyer's to read.
/// </summary>
public sealed class BuyerOrderTrackingDto
{
    public string Carrier { get; init; } = null!;
    public string? TrackingCode { get; init; }

    /// <summary>Internal shipment status, or null when no shipment has been booked yet.</summary>
    public string? ShipmentStatus { get; init; }

    public DateTime? ExpectedDeliveryAt { get; init; }
    public DateTime? LastUpdateAt { get; init; }
    public OrderRouteDto Route { get; init; } = new();
    public IReadOnlyList<ShipmentEventDto> Events { get; init; } = Array.Empty<ShipmentEventDto>();
}

/// <summary>Normalised carrier webhook payload; each adapter parses its own shape into this.</summary>
public sealed class ShipmentWebhookEvent
{
    public string ProviderShipmentId { get; init; } = null!;
    public string ProviderStatus { get; init; } = null!;
    public string? ExternalEventId { get; init; }
    public string? Description { get; init; }
    public DateTime? OccurredAt { get; init; }
    public string? OrderCode { get; init; }
}

public sealed class ShippingWebhookResult
{
    public bool Processed { get; init; }
    public bool IdempotentReplay { get; init; }
    public string Message { get; init; } = string.Empty;
    public Guid? OrderId { get; init; }
    public string? OrderStatus { get; init; }
    public string? ShipmentStatus { get; init; }
}

/// <summary>Result of one background sweep, surfaced for logging.</summary>
public sealed class ShippingSweepResult
{
    public int ShipmentsCreated { get; init; }
    public int EventsApplied { get; init; }
    public int OrdersAdvanced { get; init; }
    public int DispatchFailures { get; init; }
    public IReadOnlyList<string> Errors { get; init; } = Array.Empty<string>();

    public bool HasWork =>
        ShipmentsCreated > 0 || EventsApplied > 0 || OrdersAdvanced > 0 || DispatchFailures > 0;
}
