using System.Text.Json;
using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Order.Abstractions;
using AIDR.Modules.Shipping.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AIDR.Infrastructure.Ordering;

public sealed class ReturnShipmentRepository : IReturnShipmentRepository
{
    private readonly AidrDbContext _db;
    private readonly ILogger<ReturnShipmentRepository> _logger;

    public ReturnShipmentRepository(AidrDbContext db, ILogger<ReturnShipmentRepository> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<ReturnDispatchContext?> LoadDispatchContextAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.ReturnRequests.AsNoTracking()
            .Include(r => r.Order).ThenInclude(o => o.Shop)
            .Include(r => r.Order).ThenInclude(o => o.Items)
            .FirstOrDefaultAsync(r => r.ReturnRequestId == returnRequestId, cancellationToken);

        if (row is null)
            return null;

        var address = ParseSnapshot(row.Order.ShippingSnapshotJson, row.Order.ShippingAddressId);

        return new ReturnDispatchContext
        {
            ReturnRequestId   = row.ReturnRequestId,
            OrderId           = row.OrderId,
            OrderCode         = row.Order.OrderCode,
            BuyerUserId       = row.BuyerUserId,
            OrderTotalAmount  = row.Order.TotalAmount,
            BuyerReceiverName = address.ReceiverName,
            BuyerPhone        = address.Phone,
            BuyerProvince     = address.Province,
            BuyerDistrict     = address.District,
            BuyerWard         = address.Ward,
            BuyerStreetAddress= address.StreetAddress,
            ShopName          = row.Order.Shop.ShopName,
            ShopPhone         = row.Order.Shop.Phone ?? row.Order.Shop.Hotline,
            ShopProvince      = row.Order.Shop.Province,
            ShopDistrict      = row.Order.Shop.District,
            ShopWard          = row.Order.Shop.Ward,
            ShopStreetAddress = row.Order.Shop.StreetAddress,
            Items = row.Order.Items.Select(i => new ShipmentDispatchItem
            {
                Name        = i.ProductNameSnapshot,
                Quantity    = i.Quantity,
                Price       = i.UnitPrice,
                WeightGram  = 0
            }).ToList()
        };
    }

    public async Task<ReturnShipmentDto> SaveDispatchAsync(
        Guid returnRequestId,
        string provider,
        ShipmentDispatchResult result,
        CancellationToken cancellationToken = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);

        var returnRequest = await _db.ReturnRequests
            .FirstOrDefaultAsync(r => r.ReturnRequestId == returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        var now = DateTime.UtcNow;

        var shipment = await _db.ReturnShipments
            .FirstOrDefaultAsync(s => s.ReturnRequestId == returnRequestId, cancellationToken);

        if (shipment is null)
        {
            shipment = new ReturnShipment
            {
                ReturnShipmentId = Guid.NewGuid(),
                ReturnRequestId  = returnRequestId,
                CreatedAt        = now
            };
            _db.ReturnShipments.Add(shipment);
        }

        shipment.Provider            = provider;
        shipment.ProviderShipmentId  = Truncate(result.ProviderShipmentId, 60);
        shipment.TrackingCode        = Truncate(result.TrackingCode ?? result.ProviderShipmentId, 60);
        shipment.Status              = ShippingConstants.ShipmentCreated;
        shipment.ProviderStatus      = Truncate(result.ProviderStatus, 60);
        shipment.ShippingFeeQuoted   = result.Fee;
        shipment.ExpectedDeliveryAt  = result.ExpectedDeliveryAt;
        shipment.LastError           = null;
        shipment.RawCreateJson       = result.RawJson;
        shipment.UpdatedAt           = now;

        _db.ReturnShipmentEvents.Add(new ReturnShipmentEvent
        {
            ReturnShipmentEventId = Guid.NewGuid(),
            ReturnShipmentId      = shipment.ReturnShipmentId,
            ExternalEventId       = $"{ShippingConstants.ShipmentCreated}:{now:yyyyMMddHHmmss}",
            ProviderStatus        = shipment.ProviderStatus!,
            MappedStatus          = ShippingConstants.ShipmentCreated,
            Description           = $"Return shipment booked with {provider}",
            Source                = ShippingConstants.SourceDispatch,
            AppliedToReturn       = true,
            OccurredAt            = now,
            ReceivedAt            = now
        });

        var from = returnRequest.Status;
        returnRequest.Status    = ReturnConstants.StatusAwaitingPickup;
        returnRequest.UpdatedAt = now;
        returnRequest.StatusHistories.Add(new ReturnStatusHistory
        {
            ReturnRequestId = returnRequestId,
            FromStatus      = from,
            ToStatus        = ReturnConstants.StatusAwaitingPickup,
            Note            = $"Return shipment created: {shipment.TrackingCode}",
            CreatedAt       = now
        });

        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return MapDto(shipment);
    }

    public async Task MarkPickupFailedAsync(
        Guid returnRequestId,
        string error,
        CancellationToken cancellationToken = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);

        var returnRequest = await _db.ReturnRequests
            .FirstOrDefaultAsync(r => r.ReturnRequestId == returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        var now = DateTime.UtcNow;

        var shipment = await _db.ReturnShipments
            .FirstOrDefaultAsync(s => s.ReturnRequestId == returnRequestId, cancellationToken);

        if (shipment is null)
        {
            shipment = new ReturnShipment
            {
                ReturnShipmentId = Guid.NewGuid(),
                ReturnRequestId  = returnRequestId,
                Provider         = ShippingConstants.ProviderGhn,
                Status           = ShippingConstants.ShipmentFailed,
                CreatedAt        = now
            };
            _db.ReturnShipments.Add(shipment);
        }
        else
        {
            shipment.AttemptCount++;
        }

        shipment.Status    = ShippingConstants.ShipmentFailed;
        shipment.LastError = Truncate(error, 500);
        shipment.UpdatedAt = now;

        var from = returnRequest.Status;
        returnRequest.Status    = ReturnConstants.StatusPickupFailed;
        returnRequest.UpdatedAt = now;
        returnRequest.StatusHistories.Add(new ReturnStatusHistory
        {
            ReturnRequestId = returnRequestId,
            FromStatus      = from,
            ToStatus        = ReturnConstants.StatusPickupFailed,
            Note            = $"GHN pickup failed: {Truncate(error, 200)}",
            CreatedAt       = now
        });

        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
    }

    public async Task<ReturnShipmentWebhookResult> ApplyWebhookEventAsync(
        string providerShipmentId,
        string clientOrderCode,
        string providerStatus,
        string mappedShipmentStatus,
        string newReturnStatus,
        string externalEventId,
        string? description,
        DateTime occurredAt,
        string rawJson,
        CancellationToken cancellationToken = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);

        var shipment = await _db.ReturnShipments
            .FirstOrDefaultAsync(s => s.ProviderShipmentId == providerShipmentId, cancellationToken);

        if (shipment is null && !string.IsNullOrWhiteSpace(clientOrderCode))
        {
            // Fallback: match via RTN- prefix + ReturnRequestId
            var idStr = clientOrderCode[ReturnConstants.ReturnShipmentPrefix.Length..];
            if (Guid.TryParseExact(idStr, "N", out var returnId))
            {
                shipment = await _db.ReturnShipments
                    .FirstOrDefaultAsync(s => s.ReturnRequestId == returnId, cancellationToken);
            }
        }

        if (shipment is null)
            return new ReturnShipmentWebhookResult { Applied = false, Message = "Return shipment not found." };

        // Idempotency check
        var alreadyApplied = await _db.ReturnShipmentEvents.AnyAsync(
            e => e.ReturnShipmentId == shipment.ReturnShipmentId
                 && e.ExternalEventId == externalEventId,
            cancellationToken);

        if (alreadyApplied)
        {
            await tx.CommitAsync(cancellationToken);
            return new ReturnShipmentWebhookResult
            {
                Applied         = true,
                IdempotentReplay= true,
                ReturnRequestId = shipment.ReturnRequestId,
                ShipmentStatus  = shipment.Status,
                Message         = "Already applied."
            };
        }

        var now = DateTime.UtcNow;
        var prevShipmentStatus = shipment.Status;

        shipment.Status         = mappedShipmentStatus;
        shipment.ProviderStatus = Truncate(providerStatus, 60);
        shipment.UpdatedAt      = now;

        // AppliedToReturn is set after the forward-only guard below
        var eventEntry = new ReturnShipmentEvent
        {
            ReturnShipmentEventId = Guid.NewGuid(),
            ReturnShipmentId      = shipment.ReturnShipmentId,
            ExternalEventId       = externalEventId,
            ProviderStatus        = Truncate(providerStatus, 60),
            MappedStatus          = mappedShipmentStatus,
            Description           = Truncate(description, 300),
            Source                = ShippingConstants.SourceWebhook,
            AppliedToReturn       = false, // updated below after guard
            OccurredAt            = occurredAt,
            ReceivedAt            = now,
            RawJson               = rawJson
        };
        _db.ReturnShipmentEvents.Add(eventEntry);

        var returnRequest = await _db.ReturnRequests
            .Include(r => r.Order)
            .FirstOrDefaultAsync(r => r.ReturnRequestId == shipment.ReturnRequestId, cancellationToken);

        Guid buyerUserId = Guid.Empty;
        string orderCode = string.Empty;
        bool appliedToReturn = false;
        if (returnRequest is not null)
        {
            buyerUserId = returnRequest.BuyerUserId;
            orderCode   = returnRequest.Order?.OrderCode ?? string.Empty;

            // Forward-only guard: GHN may send events out of order or retry late.
            // Only advance when the new status is strictly further ahead.
            var currentOrder = ReturnConstants.StatusOrder.GetValueOrDefault(returnRequest.Status, -1);
            var newOrder     = ReturnConstants.StatusOrder.GetValueOrDefault(newReturnStatus, -1);

            if (newOrder > currentOrder)
            {
                var from = returnRequest.Status;
                returnRequest.Status    = newReturnStatus;
                returnRequest.UpdatedAt = now;
                returnRequest.StatusHistories.Add(new ReturnStatusHistory
                {
                    ReturnRequestId = shipment.ReturnRequestId,
                    FromStatus      = from,
                    ToStatus        = newReturnStatus,
                    Note            = $"GHN: {providerStatus}",
                    CreatedAt       = now
                });
                appliedToReturn = true;
                eventEntry.AppliedToReturn = true;
            }
            else
            {
                _logger.LogInformation(
                    "Skipping backward/equal return status transition {Current} → {New} for return {ReturnRequestId}",
                    returnRequest.Status, newReturnStatus, shipment.ReturnRequestId);
            }
        }

        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        var message = appliedToReturn
            ? $"Return advanced to {newReturnStatus}."
            : $"Return status unchanged (already at or beyond {newReturnStatus}).";

        return new ReturnShipmentWebhookResult
        {
            Applied         = true,
            IdempotentReplay= false,
            ReturnRequestId = shipment.ReturnRequestId,
            ReturnStatus    = appliedToReturn ? newReturnStatus : (returnRequest?.Status ?? newReturnStatus),
            ShipmentStatus  = mappedShipmentStatus,
            BuyerUserId     = buyerUserId,
            Message         = message
        };
    }

    public async Task ResetForRetryAsync(Guid returnRequestId, CancellationToken cancellationToken = default)
    {
        var shipment = await _db.ReturnShipments
            .FirstOrDefaultAsync(s => s.ReturnRequestId == returnRequestId, cancellationToken);

        if (shipment is null)
            return;

        var now = DateTime.UtcNow;
        shipment.Status         = ShippingConstants.ShipmentPending;
        shipment.ProviderShipmentId = null;
        shipment.TrackingCode   = null;
        shipment.LastError      = null;
        shipment.AttemptCount++;
        shipment.UpdatedAt      = now;

        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task MarkReceivingManuallyAsync(
        Guid returnRequestId,
        Guid adminUserId,
        string? note,
        CancellationToken cancellationToken = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);

        var returnRequest = await _db.ReturnRequests
            .FirstOrDefaultAsync(r => r.ReturnRequestId == returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        var allowed = new[]
        {
            ReturnConstants.StatusPickupFailed,
            ReturnConstants.StatusAwaitingPickup,
            ReturnConstants.StatusPickedUp,
            ReturnConstants.StatusInTransit,
            ReturnConstants.StatusSellerConfirmed
        };

        if (!allowed.Contains(returnRequest.Status, StringComparer.OrdinalIgnoreCase))
            throw new ConflictException($"Cannot manually mark receiving from status {returnRequest.Status}.");

        var now = DateTime.UtcNow;
        var from = returnRequest.Status;
        returnRequest.Status    = ReturnConstants.StatusReceiving;
        returnRequest.UpdatedAt = now;
        returnRequest.StatusHistories.Add(new ReturnStatusHistory
        {
            ReturnRequestId = returnRequestId,
            FromStatus      = from,
            ToStatus        = ReturnConstants.StatusReceiving,
            ChangedBy       = adminUserId,
            Note            = note ?? "Admin manually marked as receiving (logistics bypassed)",
            CreatedAt       = now
        });

        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
    }

    public async Task<ReturnShipmentDto?> GetByReturnRequestAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken = default)
    {
        var shipment = await _db.ReturnShipments.AsNoTracking()
            .FirstOrDefaultAsync(s => s.ReturnRequestId == returnRequestId, cancellationToken);

        return shipment is null ? null : MapDto(shipment);
    }

    public async Task<IReadOnlyList<Guid>> ListAdminUserIdsAsync(CancellationToken cancellationToken = default)
    {
        return await _db.UserRoles.AsNoTracking()
            .Where(ur => ur.Role.RoleCode == RoleCodes.Admin)
            .Select(ur => ur.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);
    }

    public async Task DeductReturnShippingFeeAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken = default)
    {
        var shipment = await _db.ReturnShipments.AsNoTracking()
            .FirstOrDefaultAsync(s => s.ReturnRequestId == returnRequestId, cancellationToken);

        if (shipment?.ShippingFeeQuoted is null or <= 0)
            return;

        // Idempotency: skip if already deducted
        var alreadyDeducted = await _db.WalletTransactions.AnyAsync(
            t => t.ReferenceType == ReturnConstants.WalletReferenceTypeReturnRequest
                 && t.ReferenceId == returnRequestId
                 && t.TxType == ReturnConstants.WalletTxTypeReturnShippingFee,
            cancellationToken);

        if (alreadyDeducted)
            return;

        var returnRequest = await _db.ReturnRequests
            .Include(r => r.Order)
            .FirstOrDefaultAsync(r => r.ReturnRequestId == returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        var wallet = await _db.Wallets
            .FirstOrDefaultAsync(w => w.ShopId == returnRequest.Order.ShopId, cancellationToken)
            ?? throw new AppException("Seller wallet not found.");

        var fee = decimal.Round(shipment.ShippingFeeQuoted.Value, 2, MidpointRounding.AwayFromZero);

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);

        var now = DateTime.UtcNow;
        wallet.AvailableBalance = decimal.Round(
            wallet.AvailableBalance - fee,
            2, MidpointRounding.AwayFromZero);
        wallet.UpdatedAt = now;

        _db.WalletTransactions.Add(new WalletTransaction
        {
            WalletId      = wallet.WalletId,
            TxType        = ReturnConstants.WalletTxTypeReturnShippingFee,
            Amount        = -fee,
            BalanceAfter  = wallet.AvailableBalance,
            PendingAfter  = wallet.PendingBalance,
            ReferenceType = ReturnConstants.WalletReferenceTypeReturnRequest,
            ReferenceId   = returnRequestId,
            Note          = $"Return shipping fee for order {returnRequest.Order.OrderCode}",
            CreatedAt     = now
        });

        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
    }

    // -----------------------------------------------------------------------

    private static ReturnShipmentDto MapDto(ReturnShipment s) => new()
    {
        ReturnShipmentId  = s.ReturnShipmentId,
        ReturnRequestId   = s.ReturnRequestId,
        Provider          = s.Provider,
        TrackingCode      = s.TrackingCode,
        Status            = s.Status,
        ShippingFeeQuoted = s.ShippingFeeQuoted,
        ExpectedDeliveryAt= s.ExpectedDeliveryAt,
        AttemptCount      = s.AttemptCount,
        LastError         = s.LastError,
        CreatedAt         = s.CreatedAt
    };

    private static ShippingAddressSnapshot ParseSnapshot(string? snapshotJson, Guid? addressId)
    {
        if (string.IsNullOrWhiteSpace(snapshotJson))
            return new ShippingAddressSnapshot();
        try
        {
            using var doc = JsonDocument.Parse(snapshotJson);
            var root = doc.RootElement;
            return new ShippingAddressSnapshot
            {
                AddressId     = addressId,
                ReceiverName  = TryGetString(root, "receiverName") ?? string.Empty,
                Phone         = TryGetString(root, "phone") ?? string.Empty,
                Province      = TryGetString(root, "province") ?? string.Empty,
                District      = TryGetString(root, "district") ?? string.Empty,
                Ward          = TryGetString(root, "ward") ?? string.Empty,
                StreetAddress = TryGetString(root, "streetAddress") ?? string.Empty
            };
        }
        catch (JsonException ex)
        {
            throw new AppException($"Failed to parse shipping snapshot: {ex.Message}");
        }
    }

    private static string? TryGetString(JsonElement root, string key) =>
        root.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static string? Truncate(string? s, int max) =>
        s is null ? null : s.Length <= max ? s : s[..max];

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
