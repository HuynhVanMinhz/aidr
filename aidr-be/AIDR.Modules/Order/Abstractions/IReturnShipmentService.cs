using AIDR.Shared.Dtos.Order;

namespace AIDR.Modules.Order.Abstractions;

public sealed class ReturnShipmentDto
{
    public Guid ReturnShipmentId { get; init; }
    public Guid ReturnRequestId { get; init; }
    public string Provider { get; init; } = null!;
    public string? TrackingCode { get; init; }
    public string Status { get; init; } = null!;
    public decimal? ShippingFeeQuoted { get; init; }
    public DateTime? ExpectedDeliveryAt { get; init; }
    public int AttemptCount { get; init; }
    public string? LastError { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class ReturnShipmentWebhookResult
{
    public bool Applied { get; init; }
    public bool IdempotentReplay { get; init; }
    public Guid ReturnRequestId { get; init; }
    public Guid BuyerUserId { get; init; }
    public string ReturnStatus { get; init; } = null!;
    public string ShipmentStatus { get; init; } = null!;
    public string Message { get; init; } = null!;
}

public interface IReturnShipmentService
{
    /// <summary>
    /// Creates a GHN reverse-shipment for the return request (buyer → seller).
    /// Called automatically after the seller confirms. Updates ReturnRequest.Status
    /// to AwaitingPickup on success, or PickupFailed on GHN error.
    /// </summary>
    Task<ReturnShipmentDto> DispatchAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken = default);

    /// <summary>Processes a GHN webhook callback for a return shipment.</summary>
    Task<ReturnShipmentWebhookResult> HandleWebhookAsync(
        string provider,
        string rawPayload,
        string? token,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Cancels the current GHN order (if any) and creates a new one.
    /// Used by admin when the previous pickup failed.
    /// </summary>
    Task<ReturnShipmentDto> RetryDispatchAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Skips GHN logistics entirely: admin marks the return as Receiving.
    /// Used when buyer ships manually or logistics is permanently stuck.
    /// </summary>
    Task MarkReceivingManuallyAsync(
        Guid returnRequestId,
        Guid adminUserId,
        string? note,
        CancellationToken cancellationToken = default);

    Task<ReturnShipmentDto?> GetByReturnRequestAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken = default);
}
