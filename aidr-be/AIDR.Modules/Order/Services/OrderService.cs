using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Order.Services;

public sealed class OrderService : IOrderService
{
    private readonly IOrderRepository _orders;

    public OrderService(IOrderRepository orders) => _orders = orders;

    public async Task<CreateOrderResponse> CreateOrderAsync(
        Guid buyerUserId,
        CreateOrderRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.ShippingAddressId == Guid.Empty)
            throw new AppException("Shipping address is required.");

        var buyerNote = request.BuyerNote?.Trim();
        if (buyerNote is { Length: > OrderConstants.MaxBuyerNoteLength })
            throw new AppException($"Buyer note must not exceed {OrderConstants.MaxBuyerNoteLength} characters.");

        IReadOnlyCollection<Guid>? cartItemIds = null;
        if (request.CartItemIds is { Count: > 0 })
        {
            cartItemIds = request.CartItemIds
                .Where(id => id != Guid.Empty)
                .Distinct()
                .ToList();

            if (cartItemIds.Count == 0)
                throw new AppException("Cart item ids are invalid.");
        }

        IReadOnlyDictionary<Guid, Guid>? vouchersByShopId = null;
        if (request.Vouchers is { Count: > 0 })
        {
            var map = new Dictionary<Guid, Guid>();
            foreach (var selection in request.Vouchers)
            {
                if (selection.ShopId == Guid.Empty || selection.VoucherId == Guid.Empty)
                    throw new AppException("Voucher selection requires shop id and voucher id.");

                if (!map.TryAdd(selection.ShopId, selection.VoucherId))
                    throw new AppException("Only one voucher can be applied per shop.");
            }

            vouchersByShopId = map;
        }

        return await _orders.CreateOrdersFromCartAsync(
            buyerUserId,
            request.ShippingAddressId,
            cartItemIds,
            string.IsNullOrWhiteSpace(buyerNote) ? null : buyerNote,
            vouchersByShopId,
            cancellationToken);
    }

    public async Task<BuyerOrderListResultDto> ListBuyerOrdersAsync(
        Guid buyerUserId,
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var normalizedStatus = NormalizeStatusFilter(status);
        var (normalizedPage, normalizedPageSize) = OrderConstants.NormalizePaging(page, pageSize);

        var (items, totalCount, effectivePage) = await _orders.ListBuyerOrdersAsync(
            buyerUserId,
            normalizedStatus,
            normalizedPage,
            normalizedPageSize,
            cancellationToken);

        return new BuyerOrderListResultDto
        {
            Items = items,
            Page = effectivePage,
            PageSize = normalizedPageSize,
            TotalCount = totalCount
        };
    }

    public async Task<BuyerOrderDetailDto> GetBuyerOrderAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default)
    {
        EnsureOrderId(orderId);

        return await _orders.GetBuyerOrderAsync(buyerUserId, orderId, cancellationToken)
            ?? throw new NotFoundException("Order not found.");
    }

    public async Task<BuyerOrderDetailDto> CancelBuyerOrderAsync(
        Guid buyerUserId,
        Guid orderId,
        CancelOrderRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureOrderId(orderId);

        var reason = request.Reason?.Trim();
        if (reason is { Length: > OrderConstants.MaxCancelReasonLength })
            throw new AppException(
                $"Cancel reason must not exceed {OrderConstants.MaxCancelReasonLength} characters.");

        return await _orders.CancelBuyerOrderAsync(
            buyerUserId,
            orderId,
            string.IsNullOrWhiteSpace(reason) ? null : reason,
            cancellationToken);
    }

    public async Task<BuyerOrderDetailDto> ConfirmReceivedAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default)
    {
        EnsureOrderId(orderId);
        return await _orders.ConfirmReceivedAsync(buyerUserId, orderId, cancellationToken);
    }

    private static string? NormalizeStatusFilter(string? status)
    {
        if (string.IsNullOrWhiteSpace(status) ||
            string.Equals(status.Trim(), "all", StringComparison.OrdinalIgnoreCase))
            return null;

        var normalized = status.Trim();
        if (!OrderConstants.BuyerListStatuses.Contains(normalized))
            throw new AppException("Order status filter is invalid.");

        return normalized;
    }

    private static void EnsureOrderId(Guid orderId)
    {
        if (orderId == Guid.Empty)
            throw new AppException("Order id is required.");
    }
}
