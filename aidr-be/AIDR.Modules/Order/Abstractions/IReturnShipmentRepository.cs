using AIDR.Modules.Shipping.Abstractions;

namespace AIDR.Modules.Order.Abstractions;

public sealed class ReturnDispatchContext
{
    public Guid ReturnRequestId { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public Guid BuyerUserId { get; init; }
    public decimal OrderTotalAmount { get; init; }

    // Buyer's address (snapshot at order time) — sender for the return shipment
    public string BuyerReceiverName { get; init; } = null!;
    public string BuyerPhone { get; init; } = null!;
    public string BuyerProvince { get; init; } = null!;
    public string BuyerDistrict { get; init; } = null!;
    public string BuyerWard { get; init; } = null!;
    public string BuyerStreetAddress { get; init; } = null!;

    // Shop address — receiver for the return shipment
    public string ShopName { get; init; } = null!;
    public string? ShopPhone { get; init; }
    public string? ShopProvince { get; init; }
    public string? ShopDistrict { get; init; }
    public string? ShopWard { get; init; }
    public string? ShopStreetAddress { get; init; }

    public IReadOnlyList<ShipmentDispatchItem> Items { get; init; } = Array.Empty<ShipmentDispatchItem>();
}

public interface IReturnShipmentRepository
{
    Task<ReturnDispatchContext?> LoadDispatchContextAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken = default);

    Task<ReturnShipmentDto> SaveDispatchAsync(
        Guid returnRequestId,
        string provider,
        ShipmentDispatchResult result,
        CancellationToken cancellationToken = default);

    Task MarkPickupFailedAsync(
        Guid returnRequestId,
        string error,
        CancellationToken cancellationToken = default);

    /// <summary>Applies a GHN webhook event, advances ReturnRequest.Status, returns result.</summary>
    Task<ReturnShipmentWebhookResult> ApplyWebhookEventAsync(
        string providerShipmentId,
        string clientOrderCode,
        string providerStatus,
        string mappedShipmentStatus,
        string newReturnStatus,
        string externalEventId,
        string? description,
        DateTime occurredAt,
        string rawJson,
        CancellationToken cancellationToken = default);

    /// <summary>Cancels any active GHN order record and resets for a fresh dispatch attempt.</summary>
    Task ResetForRetryAsync(Guid returnRequestId, CancellationToken cancellationToken = default);

    Task MarkReceivingManuallyAsync(
        Guid returnRequestId,
        Guid adminUserId,
        string? note,
        CancellationToken cancellationToken = default);

    Task<ReturnShipmentDto?> GetByReturnRequestAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> ListAdminUserIdsAsync(CancellationToken cancellationToken = default);

    /// <summary>Deducts return shipping fee from seller wallet when goods are accepted.</summary>
    Task DeductReturnShippingFeeAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken = default);
}
