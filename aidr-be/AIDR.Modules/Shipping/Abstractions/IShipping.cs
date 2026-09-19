using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Shipping;

namespace AIDR.Modules.Shipping.Abstractions;

public sealed class ShippingOptions
{
    public const string SectionName = "Shipping";

    /// <summary>Carrier that books shipments. GHN is the only adapter today.</summary>
    public string Provider { get; set; } = ShippingConstants.ProviderGhn;

    /// <summary>Off = nobody books shipments; the seller drives the status by hand.</summary>
    public bool EnableAutoFulfillment { get; set; } = true;

    public bool EnableBackgroundJob { get; set; } = true;

    public int JobIntervalMinutes { get; set; } = 5;

    /// <summary>Grace period between payment and booking, so a mistaken order can be sorted out first.</summary>
    public int ConfirmDelayMinutes { get; set; } = 5;

    /// <summary>After this many failed bookings the sweep stops retrying that order.</summary>
    public int MaxDispatchAttempts { get; set; } = 3;

    /// <summary>Poll cadence; the carrier webhook is the primary path and this is the backstop.</summary>
    public int PollIntervalMinutes { get; set; } = 15;

    /// <summary>Orders / shipments touched per sweep step.</summary>
    public int BatchSize { get; set; } = 50;

    public GhnOptions Ghn { get; set; } = new();

    public string NormalizedProvider =>
        string.IsNullOrWhiteSpace(Provider) ? ShippingConstants.ProviderGhn : Provider.Trim();

    /// <summary>
    /// Automation needs credentials, not just the switch. Without them the sweep
    /// is idle, and the seller screen must say so instead of promising a booking
    /// that will never happen. An unknown provider name counts as unconfigured.
    /// </summary>
    public bool IsProviderConfigured =>
        string.Equals(NormalizedProvider, ShippingConstants.ProviderGhn, StringComparison.OrdinalIgnoreCase)
        && Ghn.IsConfigured;
}

public sealed class GhnOptions
{
    /// <summary>Sandbox: https://dev-online-gateway.ghn.vn - production: https://online-gateway.ghn.vn</summary>
    public string BaseUrl { get; set; } = "https://dev-online-gateway.ghn.vn";
    public string Token { get; set; } = string.Empty;
    public int ShopId { get; set; }

    /// <summary>Shared secret GHN echoes back on the webhook; blank disables the check.</summary>
    public string WebhookToken { get; set; } = string.Empty;

    /// <summary>2 = standard delivery.</summary>
    public int ServiceTypeId { get; set; } = 2;

    /// <summary>1 = shop pays the shipping fee.</summary>
    public int PaymentTypeId { get; set; } = 1;

    public int DefaultWeightGram { get; set; } = 500;
    public string RequiredNote { get; set; } = "KHONGCHOXEMHANG";
    public int TimeoutSeconds { get; set; } = 30;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Token) && ShopId > 0;
}

/* ------------------------------- provider ------------------------------- */

public sealed class ShipmentDispatchItem
{
    public string Name { get; init; } = null!;
    public int Quantity { get; init; }
    public decimal Price { get; init; }
    public int WeightGram { get; init; }
}

public sealed class ShipmentDispatchRequest
{
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;

    /// <summary>
    /// Where the carrier picks the parcel up. GHN can only fall back to the shop
    /// registered on the account, which has no address in the sandbox, so the
    /// seller's own shop address travels with every booking.
    /// </summary>
    public string SenderName { get; init; } = null!;
    public string SenderPhone { get; init; } = null!;
    public string SenderProvince { get; init; } = null!;
    public string SenderDistrict { get; init; } = null!;
    public string SenderWard { get; init; } = null!;
    public string SenderStreetAddress { get; init; } = null!;

    public string ReceiverName { get; init; } = null!;
    public string ReceiverPhone { get; init; } = null!;
    public string Province { get; init; } = null!;
    public string District { get; init; } = null!;
    public string Ward { get; init; } = null!;
    public string StreetAddress { get; init; } = null!;
    public string? Note { get; init; }

    /// <summary>Buyer already paid through payOS, so COD is 0 - kept explicit for future COD orders.</summary>
    public decimal CodAmount { get; init; }
    public decimal InsuranceValue { get; init; }
    public int TotalWeightGram { get; init; }
    public IReadOnlyList<ShipmentDispatchItem> Items { get; init; } = Array.Empty<ShipmentDispatchItem>();
}

public sealed class ShipmentDispatchResult
{
    public string ProviderShipmentId { get; init; } = null!;
    public string? TrackingCode { get; init; }
    public string ProviderStatus { get; init; } = null!;
    public string MappedStatus { get; init; } = ShippingConstants.ShipmentCreated;
    public decimal? Fee { get; init; }
    public DateTime? ExpectedDeliveryAt { get; init; }
    public string? RawJson { get; init; }
}

public sealed class ShipmentTrackingSnapshot
{
    public string ProviderStatus { get; init; } = null!;
    public string MappedStatus { get; init; } = null!;
    public string? Description { get; init; }
    public DateTime OccurredAt { get; init; }
    public string? ExternalEventId { get; init; }
    public string? RawJson { get; init; }
}

/// <summary>One carrier adapter. Adding GHTK or Viettel Post means adding one of these.</summary>
public interface IShippingProvider
{
    string Name { get; }

    bool IsConfigured { get; }

    Task<ShipmentDispatchResult> CreateShipmentAsync(
        ShipmentDispatchRequest request,
        CancellationToken ct = default);

    /// <summary>Null when the carrier has nothing new to report.</summary>
    Task<ShipmentTrackingSnapshot?> GetTrackingAsync(
        string providerShipmentId,
        CancellationToken ct = default);

    Task CancelShipmentAsync(string providerShipmentId, CancellationToken ct = default);

    /// <summary>Carrier status string → <see cref="ShippingConstants"/> shipment status.</summary>
    string MapStatus(string providerStatus);

    /// <summary>Parse the carrier's own webhook body. Throws when the payload is not usable.</summary>
    ShipmentWebhookEvent ParseWebhook(string rawPayload);

    /// <summary>False rejects the webhook before it touches any data.</summary>
    bool IsWebhookAuthentic(string? token);
}

/* ------------------------------ persistence ------------------------------ */

public sealed class ShipmentDispatchCandidate
{
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public Guid ShopId { get; init; }

    /// <summary>Pickup point - the seller's shop address, straight from Shop settings.</summary>
    public string ShopName { get; init; } = null!;
    public string? ShopPhone { get; init; }
    public string? ShopProvince { get; init; }
    public string? ShopDistrict { get; init; }
    public string? ShopWard { get; init; }
    public string? ShopStreetAddress { get; init; }

    public Guid BuyerUserId { get; init; }
    public decimal TotalAmount { get; init; }
    public string? BuyerNote { get; init; }
    public string ReceiverName { get; init; } = null!;
    public string ReceiverPhone { get; init; } = null!;
    public string Province { get; init; } = null!;
    public string District { get; init; } = null!;
    public string Ward { get; init; } = null!;
    public string StreetAddress { get; init; } = null!;
    public IReadOnlyList<ShipmentDispatchItem> Items { get; init; } = Array.Empty<ShipmentDispatchItem>();
    public int AttemptCount { get; init; }
}

public sealed class ShipmentDue
{
    public Guid ShipmentId { get; init; }
    public Guid OrderId { get; init; }
    public string Provider { get; init; } = null!;
    public string? ProviderShipmentId { get; init; }
    public string Status { get; init; } = null!;
    public DateTime CreatedAt { get; init; }
}

public sealed class ShipmentEventInput
{
    public string ProviderStatus { get; init; } = null!;
    public string MappedStatus { get; init; } = null!;
    public string ExternalEventId { get; init; } = null!;
    public string Source { get; init; } = ShippingConstants.SourceWebhook;
    public string? Description { get; init; }
    public DateTime OccurredAt { get; init; }
    public string? RawJson { get; init; }

    /// <summary>When the poller should look at this shipment again.</summary>
    public DateTime? NextActionAt { get; init; }
}

/// <summary>What happened to one shipment event - enough to log it and notify the buyer.</summary>
public sealed class ShipmentTransitionResult
{
    public bool Applied { get; init; }
    public bool IdempotentReplay { get; init; }
    public bool OrderAdvanced { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = string.Empty;
    public Guid BuyerUserId { get; init; }
    public Guid ShopOwnerUserId { get; init; }
    public string OrderStatus { get; init; } = string.Empty;
    public string ShipmentStatus { get; init; } = string.Empty;
    public string? TrackingCode { get; init; }
    public string Message { get; init; } = string.Empty;
}

public interface IShipmentRepository
{
    /// <summary>Paid orders old enough to book, that no shipment has claimed yet.</summary>
    Task<IReadOnlyList<ShipmentDispatchCandidate>> GetDispatchCandidatesAsync(
        DateTime paidBeforeUtc,
        int maxAttempts,
        int take,
        CancellationToken ct = default);

    /// <summary>Write the booked shipment and move the order to Confirmed, in one transaction.</summary>
    Task<ShipmentTransitionResult> SaveDispatchAsync(
        Guid orderId,
        string provider,
        ShipmentDispatchResult result,
        DateTime? nextActionAt,
        CancellationToken ct = default);

    /// <summary>Record a failed booking so the sweep can back off and the seller can be told.</summary>
    Task MarkDispatchFailedAsync(
        Guid orderId,
        string provider,
        string error,
        CancellationToken ct = default);

    /// <summary>Shipments whose poll slot has come round.</summary>
    Task<IReadOnlyList<ShipmentDue>> GetShipmentsDueAsync(
        DateTime nowUtc,
        int take,
        CancellationToken ct = default);

    /// <summary>Append one carrier event and, if it is a step forward, move the order with it.</summary>
    Task<ShipmentTransitionResult> ApplyEventAsync(
        Guid shipmentId,
        ShipmentEventInput input,
        CancellationToken ct = default);

    Task<ShipmentDue?> FindShipmentAsync(
        string provider,
        string? providerShipmentId,
        string? orderCode,
        CancellationToken ct = default);

    Task<ShipmentDto?> GetByOrderAsync(Guid orderId, CancellationToken ct = default);

    /// <summary>Mark that a poll happened even when nothing changed, so the poller backs off.</summary>
    Task TouchPolledAsync(Guid shipmentId, DateTime nextActionAt, CancellationToken ct = default);
}

/* -------------------------------- service -------------------------------- */

public interface IShippingService
{
    Task<ShippingSweepResult> RunSweepAsync(CancellationToken ct = default);

    Task<ShippingWebhookResult> HandleWebhookAsync(
        string provider,
        string rawPayload,
        string? token,
        CancellationToken ct = default);

    Task<OrderFulfillmentDto> GetFulfillmentAsync(Guid orderId, CancellationToken ct = default);
}
