namespace AIDR.Shared.Constants;

/// <summary>
/// Carrier-driven fulfillment. The order status is a projection of the shipment
/// status, so the mapping lives here rather than in each provider adapter.
/// </summary>
public static class ShippingConstants
{
    public const string ProviderGhn = "GHN";

    public const string ShipmentPending = "Pending";
    public const string ShipmentCreated = "Created";
    public const string ShipmentPickedUp = "PickedUp";
    public const string ShipmentInTransit = "InTransit";
    public const string ShipmentDelivered = "Delivered";
    public const string ShipmentFailed = "Failed";
    public const string ShipmentReturned = "Returned";
    public const string ShipmentCancelled = "Cancelled";

    public const string SourceWebhook = "Webhook";
    public const string SourcePoll = "Poll";
    public const string SourceDispatch = "Dispatch";
    public const string SourceManual = "Manual";

    public const int MaxProviderShipmentIdLength = 60;
    public const int MaxExternalEventIdLength = 120;
    public const int MaxProviderStatusLength = 60;
    public const int MaxEventDescriptionLength = 300;
    public const int MaxErrorLength = 500;

    /// <summary>Shipments the poller still cares about.</summary>
    public static readonly HashSet<string> ActiveShipmentStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        ShipmentCreated,
        ShipmentPickedUp,
        ShipmentInTransit
    };

    /// <summary>
    /// Shipment status → order status. Statuses absent from this map (Failed,
    /// Returned, Cancelled) deliberately leave the order where it is: they need
    /// a human, not an automatic transition.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> ShipmentToOrderStatus =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [ShipmentCreated] = OrderConstants.StatusConfirmed,
            [ShipmentPickedUp] = OrderConstants.StatusShipping,
            [ShipmentInTransit] = OrderConstants.StatusShipping,
            [ShipmentDelivered] = OrderConstants.StatusDelivered
        };

    /// <summary>GHN's `status` field → our shipment status.</summary>
    public static readonly IReadOnlyDictionary<string, string> GhnStatusMap =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["ready_to_pick"] = ShipmentCreated,
            ["picking"] = ShipmentCreated,
            ["money_collect_picking"] = ShipmentCreated,
            ["picked"] = ShipmentPickedUp,
            ["storing"] = ShipmentPickedUp,
            ["transporting"] = ShipmentPickedUp,
            ["sorting"] = ShipmentPickedUp,
            ["delivering"] = ShipmentInTransit,
            ["money_collect_delivering"] = ShipmentInTransit,
            ["delivered"] = ShipmentDelivered,
            ["delivery_fail"] = ShipmentFailed,
            ["waiting_to_return"] = ShipmentFailed,
            ["return"] = ShipmentReturned,
            ["returning"] = ShipmentReturned,
            ["return_transporting"] = ShipmentReturned,
            ["return_sorting"] = ShipmentReturned,
            ["returning_fail"] = ShipmentReturned,
            ["returned"] = ShipmentReturned,
            ["return_fail"] = ShipmentReturned,
            ["cancel"] = ShipmentCancelled,
            ["exception"] = ShipmentFailed,
            ["damage"] = ShipmentFailed,
            ["lost"] = ShipmentFailed
        };

    /// <summary>How far along the pipeline a shipment status sits; used to reject stale events.</summary>
    public static int ProgressRank(string shipmentStatus) => shipmentStatus switch
    {
        ShipmentPending => 0,
        ShipmentCreated => 1,
        ShipmentPickedUp => 2,
        ShipmentInTransit => 3,
        ShipmentDelivered => 4,
        _ => -1 // Failed / Returned / Cancelled are off the happy path, not further along it.
    };

    public static bool IsTerminal(string shipmentStatus) =>
        shipmentStatus is ShipmentDelivered or ShipmentReturned or ShipmentCancelled;
}
