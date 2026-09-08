using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Order.Services;

public sealed class OrderService : IOrderService
{
    private readonly IOrderRepository _orders;
    private readonly ICartRepository _carts;

    public OrderService(IOrderRepository orders, ICartRepository carts)
    {
        _orders = orders;
        _carts = carts;
    }

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

    public async Task<ReorderOrderResponse> ReorderAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default)
    {
        EnsureOrderId(orderId);

        var order = await _orders.GetBuyerOrderAsync(buyerUserId, orderId, cancellationToken)
            ?? throw new NotFoundException("Order not found.");

        if (string.Equals(order.Status, OrderConstants.StatusCancelled, StringComparison.OrdinalIgnoreCase))
            throw new AppException("Cancelled orders cannot be reordered.");

        var skipped = new List<ReorderSkippedItemDto>();
        var added = 0;

        foreach (var item in order.Items)
        {
            var result = await TryAddReorderItemAsync(buyerUserId, item, cancellationToken);
            if (result.Added)
                added++;

            if (result.SkipReason is not null)
            {
                skipped.Add(new ReorderSkippedItemDto
                {
                    ProductId = item.ProductId,
                    VariantId = item.VariantId,
                    ProductName = item.ProductName,
                    Reason = result.SkipReason
                });
            }
        }

        return new ReorderOrderResponse
        {
            AddedCount = added,
            SkippedItems = skipped
        };
    }

    private async Task<(bool Added, string? SkipReason)> TryAddReorderItemAsync(
        Guid buyerUserId,
        BuyerOrderItemDto item,
        CancellationToken cancellationToken)
    {
        var product = await _carts.GetPurchasableProductAsync(item.ProductId, cancellationToken);
        if (product is null)
            return (false, "Product is no longer available.");

        if (!string.Equals(product.Status, CartConstants.ApprovedStatus, StringComparison.OrdinalIgnoreCase))
            return (false, "Product is not approved for sale.");

        if (!product.CategoryIsActive)
            return (false, "Product category is not active.");

        if (!string.Equals(product.ShopStatus, CartConstants.ActiveShopStatus, StringComparison.OrdinalIgnoreCase))
            return (false, "Shop is not available.");

        CartVariantSnapshot? variant;
        try
        {
            variant = ResolveReorderVariant(product, item.VariantId);
        }
        catch (AppException ex)
        {
            return (false, ex.Message);
        }

        var unitPrice = variant?.EffectivePrice ?? product.EffectivePrice;
        var available = variant?.AvailableQuantity ?? product.AvailableQuantity;

        if (available < 1)
        {
            return (false, variant is null
                ? "Product is out of stock."
                : "Selected variant is out of stock.");
        }

        var quantity = Math.Min(item.Quantity, available);
        if (quantity < 1)
            return (false, "Insufficient stock.");

        if (quantity > CartConstants.MaxQuantityPerItem)
            quantity = CartConstants.MaxQuantityPerItem;

        await _carts.AddOrMergeItemAsync(
            buyerUserId,
            product.ProductId,
            variant?.VariantId,
            quantity,
            unitPrice,
            available,
            cancellationToken);

        if (quantity < item.Quantity)
        {
            return (true,
                $"Only {quantity} of {item.Quantity} unit(s) added due to limited stock.");
        }

        return (true, null);
    }

    private static CartVariantSnapshot? ResolveReorderVariant(CartProductSnapshot product, Guid? variantId)
    {
        if (!product.HasVariants)
        {
            if (variantId is not null && variantId != Guid.Empty)
                throw new AppException("This product is no longer sold in variants.");

            return null;
        }

        if (variantId is null || variantId == Guid.Empty)
            throw new AppException("Variant from the original order is no longer available.");

        var variant = product.Variants.FirstOrDefault(v => v.VariantId == variantId.Value)
            ?? throw new NotFoundException("Variant is not available.");

        if (!variant.IsActive)
            throw new AppException("Selected variant is no longer for sale.");

        return variant;
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
