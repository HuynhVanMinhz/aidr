using System.Text.Json;
using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Shipping.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Shipping;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AIDR.Infrastructure.Shipping;

/// <summary>
/// The only place an order status moves without a person behind it. Every write
/// here is idempotent: a replayed webhook, a doubled job tick or a retried poll
/// must all end with one shipment, one event and one status history row.
/// </summary>
public sealed class ShipmentRepository : IShipmentRepository
{
    private readonly AidrDbContext _db;
    private readonly ILogger<ShipmentRepository> _logger;

    public ShipmentRepository(AidrDbContext db, ILogger<ShipmentRepository> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ShipmentDispatchCandidate>> GetDispatchCandidatesAsync(
        DateTime paidBeforeUtc,
        int maxAttempts,
        int take,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        // Confirmed counts too: a seller who pressed "Mark as Confirmed" before the
        // sweep got there would otherwise lose automation for good, and be left
        // typing a tracking code the carrier is supposed to issue.
        var rows = await _db.Orders.AsNoTracking()
            .Where(o => (o.Status == OrderConstants.StatusPaid || o.Status == OrderConstants.StatusConfirmed)
                && o.PaidAt != null
                && o.PaidAt <= paidBeforeUtc)
            .Select(o => new
            {
                o.OrderId,
                o.OrderCode,
                o.ShopId,
                o.Shop.ShopName,
                ShopPhone = o.Shop.Phone ?? o.Shop.Hotline,
                o.Shop.Province,
                o.Shop.District,
                o.Shop.Ward,
                o.Shop.StreetAddress,
                o.BuyerUserId,
                o.TotalAmount,
                o.BuyerNote,
                o.ShippingSnapshotJson,
                o.ShippingAddressId,
                Items = o.Items.Select(i => new
                {
                    i.ProductNameSnapshot,
                    i.Quantity,
                    i.UnitPrice
                }).ToList(),
                Shipment = _db.Shipments
                    .Where(s => s.OrderId == o.OrderId)
                    .Select(s => new { s.Status, s.AttemptCount, s.NextActionAt })
                    .FirstOrDefault()
            })
            .OrderBy(o => o.OrderId)
            .Take(Math.Max(1, take) * 2)
            .ToListAsync(ct);

        var candidates = new List<ShipmentDispatchCandidate>();

        foreach (var row in rows)
        {
            if (row.Shipment is not null)
            {
                // Anything past Pending is already booked; a Pending row is a
                // failed attempt waiting for its next try.
                var retryable =
                    string.Equals(row.Shipment.Status, ShippingConstants.ShipmentPending, StringComparison.OrdinalIgnoreCase)
                    && row.Shipment.AttemptCount < maxAttempts
                    && (row.Shipment.NextActionAt is null || row.Shipment.NextActionAt <= now);

                if (!retryable)
                    continue;
            }

            var address = ParseSnapshot(row.ShippingSnapshotJson, row.ShippingAddressId);

            candidates.Add(new ShipmentDispatchCandidate
            {
                OrderId = row.OrderId,
                OrderCode = row.OrderCode,
                ShopId = row.ShopId,
                ShopName = row.ShopName,
                ShopPhone = row.ShopPhone,
                ShopProvince = row.Province,
                ShopDistrict = row.District,
                ShopWard = row.Ward,
                ShopStreetAddress = row.StreetAddress,
                BuyerUserId = row.BuyerUserId,
                TotalAmount = row.TotalAmount,
                BuyerNote = row.BuyerNote,
                ReceiverName = address.ReceiverName,
                ReceiverPhone = address.Phone,
                Province = address.Province,
                District = address.District,
                Ward = address.Ward,
                StreetAddress = address.StreetAddress,
                AttemptCount = row.Shipment?.AttemptCount ?? 0,
                Items = row.Items.Select(i => new ShipmentDispatchItem
                {
                    Name = i.ProductNameSnapshot,
                    Quantity = i.Quantity,
                    Price = i.UnitPrice,
                    WeightGram = 0
                }).ToList()
            });

            if (candidates.Count >= take)
                break;
        }

        return candidates;
    }

    public async Task<ShipmentTransitionResult> SaveDispatchAsync(
        Guid orderId,
        string provider,
        ShipmentDispatchResult result,
        DateTime? nextActionAt,
        CancellationToken ct = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var order = await _db.Orders
            .Include(o => o.Shop)
            .FirstOrDefaultAsync(o => o.OrderId == orderId, ct);

        if (order is null)
        {
            await tx.CommitAsync(ct);
            return NotApplied("Order not found.");
        }

        // The buyer may have cancelled while the carrier call was in flight.
        var wasPaid = string.Equals(order.Status, OrderConstants.StatusPaid, StringComparison.OrdinalIgnoreCase);
        var wasConfirmed = string.Equals(order.Status, OrderConstants.StatusConfirmed, StringComparison.OrdinalIgnoreCase);

        if (!wasPaid && !wasConfirmed)
        {
            await tx.CommitAsync(ct);
            return NotApplied($"Order is {order.Status}; the booking was discarded.");
        }

        var now = DateTime.UtcNow;
        var shipment = await _db.Shipments.FirstOrDefaultAsync(s => s.OrderId == orderId, ct);

        if (shipment is null)
        {
            shipment = new Shipment
            {
                ShipmentId = Guid.NewGuid(),
                OrderId = orderId,
                Provider = provider,
                CreatedAt = now
            };
            _db.Shipments.Add(shipment);
        }

        shipment.Provider = provider;
        shipment.ProviderShipmentId = Truncate(result.ProviderShipmentId, ShippingConstants.MaxProviderShipmentIdLength);
        shipment.TrackingCode = Truncate(
            result.TrackingCode ?? result.ProviderShipmentId,
            OrderConstants.MaxTrackingCodeLength);
        shipment.Status = ShippingConstants.ShipmentCreated;
        shipment.ProviderStatus = Truncate(result.ProviderStatus, ShippingConstants.MaxProviderStatusLength);
        shipment.ShippingFeeQuoted = result.Fee;
        shipment.ExpectedDeliveryAt = result.ExpectedDeliveryAt;
        shipment.NextActionAt = nextActionAt;
        shipment.LastSyncedAt = now;
        shipment.LastError = null;
        shipment.RawCreateJson = result.RawJson;
        shipment.UpdatedAt = now;

        _db.ShipmentEvents.Add(new ShipmentEvent
        {
            ShipmentEventId = Guid.NewGuid(),
            ShipmentId = shipment.ShipmentId,
            ExternalEventId = $"{ShippingConstants.ShipmentCreated}:{now:yyyyMMddHHmmss}",
            ProviderStatus = shipment.ProviderStatus!,
            MappedStatus = ShippingConstants.ShipmentCreated,
            Description = $"Shipment booked with {provider}",
            Source = ShippingConstants.SourceDispatch,
            AppliedToOrder = true,
            OccurredAt = now,
            ReceivedAt = now
        });

        var fromStatus = order.Status;
        order.Status = OrderConstants.StatusConfirmed;
        order.TrackingCode = shipment.TrackingCode;
        order.UpdatedAt = now;

        // An order the seller already confirmed only gains its tracking code —
        // the status does not move, so history records the booking, not a step.
        _db.OrderStatusHistories.Add(new OrderStatusHistory
        {
            OrderId = order.OrderId,
            FromStatus = fromStatus,
            ToStatus = OrderConstants.StatusConfirmed,
            ChangedBy = null,
            Note = $"Shipment {shipment.TrackingCode} booked automatically with {provider}",
            CreatedAt = now
        });

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        _logger.LogInformation(
            "Booked shipment {TrackingCode} for order {OrderCode} via {Provider}",
            shipment.TrackingCode,
            order.OrderCode,
            provider);

        return new ShipmentTransitionResult
        {
            Applied = true,
            OrderAdvanced = wasPaid,
            OrderId = order.OrderId,
            OrderCode = order.OrderCode,
            BuyerUserId = order.BuyerUserId,
            ShopOwnerUserId = order.Shop.OwnerUserId,
            OrderStatus = order.Status,
            ShipmentStatus = shipment.Status,
            TrackingCode = shipment.TrackingCode,
            Message = "Shipment booked and order confirmed."
        };
    }

    public async Task MarkDispatchFailedAsync(
        Guid orderId,
        string provider,
        string error,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var shipment = await _db.Shipments.FirstOrDefaultAsync(s => s.OrderId == orderId, ct);

        if (shipment is null)
        {
            shipment = new Shipment
            {
                ShipmentId = Guid.NewGuid(),
                OrderId = orderId,
                Provider = provider,
                Status = ShippingConstants.ShipmentPending,
                CreatedAt = now
            };
            _db.Shipments.Add(shipment);
        }
        else if (!string.Equals(shipment.Status, ShippingConstants.ShipmentPending, StringComparison.OrdinalIgnoreCase))
        {
            // Already booked by another tick — nothing to record.
            return;
        }

        shipment.AttemptCount += 1;
        shipment.LastError = Truncate(error, ShippingConstants.MaxErrorLength);
        // Back off a little longer with each failure instead of hammering the carrier.
        shipment.NextActionAt = now.AddMinutes(Math.Min(60, 5 * shipment.AttemptCount));
        shipment.UpdatedAt = now;

        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<ShipmentDue>> GetShipmentsDueAsync(
        DateTime nowUtc,
        int take,
        CancellationToken ct = default)
    {
        var active = ShippingConstants.ActiveShipmentStatuses.ToArray();

        return await _db.Shipments.AsNoTracking()
            .Where(s => active.Contains(s.Status)
                && s.NextActionAt != null
                && s.NextActionAt <= nowUtc)
            .OrderBy(s => s.NextActionAt)
            .Take(Math.Max(1, take))
            .Select(s => new ShipmentDue
            {
                ShipmentId = s.ShipmentId,
                OrderId = s.OrderId,
                Provider = s.Provider,
                ProviderShipmentId = s.ProviderShipmentId,
                Status = s.Status,
                CreatedAt = s.CreatedAt
            })
            .ToListAsync(ct);
    }

    public async Task<ShipmentTransitionResult> ApplyEventAsync(
        Guid shipmentId,
        ShipmentEventInput input,
        CancellationToken ct = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var shipment = await _db.Shipments
            .Include(s => s.Order)
                .ThenInclude(o => o.Shop)
            .FirstOrDefaultAsync(s => s.ShipmentId == shipmentId, ct);

        if (shipment is null)
        {
            await tx.CommitAsync(ct);
            return NotApplied("Shipment not found.");
        }

        var externalEventId = Truncate(input.ExternalEventId, ShippingConstants.MaxExternalEventIdLength)!;

        var duplicate = await _db.ShipmentEvents
            .AnyAsync(e => e.ShipmentId == shipmentId && e.ExternalEventId == externalEventId, ct);

        if (duplicate)
        {
            await tx.CommitAsync(ct);
            return new ShipmentTransitionResult
            {
                Applied = false,
                IdempotentReplay = true,
                OrderId = shipment.OrderId,
                OrderCode = shipment.Order.OrderCode,
                BuyerUserId = shipment.Order.BuyerUserId,
                OrderStatus = shipment.Order.Status,
                ShipmentStatus = shipment.Status,
                TrackingCode = shipment.TrackingCode,
                Message = "Event already processed."
            };
        }

        var now = DateTime.UtcNow;
        var order = shipment.Order;

        // A late or out-of-order event is still worth recording, it just must not
        // drag the shipment backwards.
        var isForward = ShippingConstants.ProgressRank(input.MappedStatus)
            > ShippingConstants.ProgressRank(shipment.Status);

        var isOffHappyPath = ShippingConstants.ProgressRank(input.MappedStatus) < 0;

        var targetOrderStatus = ShippingConstants.ShipmentToOrderStatus
            .TryGetValue(input.MappedStatus, out var mappedOrderStatus)
            ? mappedOrderStatus
            : null;

        var orderAdvanced = false;

        if ((isForward || isOffHappyPath) && !string.Equals(shipment.Status, input.MappedStatus, StringComparison.OrdinalIgnoreCase))
        {
            shipment.Status = input.MappedStatus;
        }

        shipment.ProviderStatus = Truncate(input.ProviderStatus, ShippingConstants.MaxProviderStatusLength);
        shipment.LastSyncedAt = now;
        // An event without its own schedule (a webhook) must not clear the poll
        // slot — otherwise a carrier that goes quiet is never checked again.
        shipment.NextActionAt = ShippingConstants.IsTerminal(shipment.Status) || isOffHappyPath
            ? null
            : input.NextActionAt ?? shipment.NextActionAt;
        shipment.UpdatedAt = now;

        if (isForward && targetOrderStatus is not null)
            orderAdvanced = TryAdvanceOrder(order, targetOrderStatus, shipment, now);

        _db.ShipmentEvents.Add(new ShipmentEvent
        {
            ShipmentEventId = Guid.NewGuid(),
            ShipmentId = shipment.ShipmentId,
            ExternalEventId = externalEventId,
            ProviderStatus = Truncate(input.ProviderStatus, ShippingConstants.MaxProviderStatusLength)!,
            MappedStatus = input.MappedStatus,
            Description = Truncate(input.Description, ShippingConstants.MaxEventDescriptionLength),
            Source = input.Source,
            AppliedToOrder = orderAdvanced,
            OccurredAt = input.OccurredAt == default ? now : input.OccurredAt,
            ReceivedAt = now,
            RawJson = input.RawJson
        });

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new ShipmentTransitionResult
        {
            Applied = true,
            OrderAdvanced = orderAdvanced,
            OrderId = order.OrderId,
            OrderCode = order.OrderCode,
            BuyerUserId = order.BuyerUserId,
            ShopOwnerUserId = order.Shop.OwnerUserId,
            OrderStatus = order.Status,
            ShipmentStatus = shipment.Status,
            TrackingCode = shipment.TrackingCode,
            Message = orderAdvanced
                ? $"Order moved to {order.Status}."
                : "Event recorded; order status unchanged."
        };
    }

    public async Task<ShipmentDue?> FindShipmentAsync(
        string provider,
        string? providerShipmentId,
        string? orderCode,
        CancellationToken ct = default)
    {
        var query = _db.Shipments.AsNoTracking().Where(s => s.Provider == provider);

        if (!string.IsNullOrWhiteSpace(providerShipmentId))
        {
            var byProviderId = await Project(query.Where(s => s.ProviderShipmentId == providerShipmentId))
                .FirstOrDefaultAsync(ct);

            if (byProviderId is not null)
                return byProviderId;
        }

        if (string.IsNullOrWhiteSpace(orderCode))
            return null;

        // GHN echoes our client_order_code back, which is the last way home when
        // the carrier's own id changed.
        return await Project(query.Where(s => s.Order.OrderCode == orderCode)).FirstOrDefaultAsync(ct);
    }

    public async Task<ShipmentDto?> GetByOrderAsync(Guid orderId, CancellationToken ct = default)
    {
        var shipment = await _db.Shipments.AsNoTracking()
            .Where(s => s.OrderId == orderId)
            .Select(s => new ShipmentDto
            {
                ShipmentId = s.ShipmentId,
                OrderId = s.OrderId,
                Provider = s.Provider,
                ProviderShipmentId = s.ProviderShipmentId,
                TrackingCode = s.TrackingCode,
                Status = s.Status,
                ProviderStatus = s.ProviderStatus,
                ShippingFeeQuoted = s.ShippingFeeQuoted,
                ExpectedDeliveryAt = s.ExpectedDeliveryAt,
                LastSyncedAt = s.LastSyncedAt,
                AttemptCount = s.AttemptCount,
                LastError = s.LastError,
                CreatedAt = s.CreatedAt,
                UpdatedAt = s.UpdatedAt,
                Events = s.Events
                    .OrderByDescending(e => e.OccurredAt)
                    .Select(e => new ShipmentEventDto
                    {
                        ShipmentEventId = e.ShipmentEventId,
                        ProviderStatus = e.ProviderStatus,
                        MappedStatus = e.MappedStatus,
                        Description = e.Description,
                        Source = e.Source,
                        OccurredAt = e.OccurredAt
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync(ct);

        return shipment;
    }

    public async Task TouchPolledAsync(Guid shipmentId, DateTime nextActionAt, CancellationToken ct = default)
    {
        var shipment = await _db.Shipments.FirstOrDefaultAsync(s => s.ShipmentId == shipmentId, ct);
        if (shipment is null)
            return;

        var now = DateTime.UtcNow;
        shipment.LastSyncedAt = now;
        shipment.NextActionAt = nextActionAt;
        shipment.UpdatedAt = now;

        await _db.SaveChangesAsync(ct);
    }

    /* -------------------------------- helpers -------------------------------- */

    /// <summary>
    /// Only ever steps along Paid → Confirmed → Shipping → Delivered. A cancelled,
    /// returned or already completed order is left exactly where it is.
    /// </summary>
    private bool TryAdvanceOrder(Order order, string targetStatus, Shipment shipment, DateTime now)
    {
        if (string.Equals(order.Status, targetStatus, StringComparison.OrdinalIgnoreCase))
            return false;

        var current = order.Status;
        var steps = 0;

        // Carrier events can skip a step (picked up straight to delivered on a
        // same-day route); walk the chain so history stays complete.
        while (OrderConstants.SellerStatusTransitions.TryGetValue(current, out var next) && steps < 4)
        {
            var fromStatus = current;
            current = next;
            steps++;

            _db.OrderStatusHistories.Add(new OrderStatusHistory
            {
                OrderId = order.OrderId,
                FromStatus = fromStatus,
                ToStatus = next,
                ChangedBy = null,
                Note = $"Carrier reported {shipment.Status} ({shipment.Provider})",
                CreatedAt = now
            });

            if (string.Equals(next, targetStatus, StringComparison.OrdinalIgnoreCase))
                break;
        }

        if (!string.Equals(current, targetStatus, StringComparison.OrdinalIgnoreCase))
        {
            // The order is off the automatic chain (Cancelled, Returned, Completed…).
            _logger.LogInformation(
                "Order {OrderId} is {Status}; carrier event {ShipmentStatus} was not applied",
                order.OrderId,
                order.Status,
                shipment.Status);
            return false;
        }

        order.Status = targetStatus;
        order.UpdatedAt = now;

        if (!string.IsNullOrWhiteSpace(shipment.TrackingCode))
            order.TrackingCode = shipment.TrackingCode;

        if (string.Equals(targetStatus, OrderConstants.StatusDelivered, StringComparison.OrdinalIgnoreCase))
            order.DeliveredAt = now;

        return true;
    }

    private static IQueryable<ShipmentDue> Project(IQueryable<Shipment> query) =>
        query.Select(s => new ShipmentDue
        {
            ShipmentId = s.ShipmentId,
            OrderId = s.OrderId,
            Provider = s.Provider,
            ProviderShipmentId = s.ProviderShipmentId,
            Status = s.Status,
            CreatedAt = s.CreatedAt
        });

    private static ShipmentTransitionResult NotApplied(string message) => new()
    {
        Applied = false,
        Message = message
    };

    private static ShippingAddressSnapshot ParseSnapshot(string snapshotJson, Guid? addressId)
    {
        try
        {
            using var doc = JsonDocument.Parse(snapshotJson);
            var root = doc.RootElement;
            return new ShippingAddressSnapshot
            {
                AddressId = addressId,
                ReceiverName = TryGetString(root, "receiverName") ?? string.Empty,
                Phone = TryGetString(root, "phone") ?? string.Empty,
                Province = TryGetString(root, "province") ?? string.Empty,
                District = TryGetString(root, "district") ?? string.Empty,
                Ward = TryGetString(root, "ward") ?? string.Empty,
                StreetAddress = TryGetString(root, "streetAddress") ?? string.Empty
            };
        }
        catch (JsonException)
        {
            return new ShippingAddressSnapshot { AddressId = addressId };
        }
    }

    private static string? TryGetString(JsonElement root, string propertyName) =>
        root.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static string? Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrEmpty(value))
            return value;

        return value.Length <= maxLength ? value : value[..maxLength];
    }

    private sealed class ShippingAddressSnapshot
    {
        public Guid? AddressId { get; init; }
        public string ReceiverName { get; init; } = string.Empty;
        public string Phone { get; init; } = string.Empty;
        public string Province { get; init; } = string.Empty;
        public string District { get; init; } = string.Empty;
        public string Ward { get; init; } = string.Empty;
        public string StreetAddress { get; init; } = string.Empty;
    }
}
