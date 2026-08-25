using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Order.Services;

public sealed class VoucherService : IVoucherService
{
    private readonly IVoucherRepository _vouchers;

    public VoucherService(IVoucherRepository vouchers) => _vouchers = vouchers;

    public async Task<VoucherListResultDto> ListAvailableAsync(
        Guid buyerUserId,
        IReadOnlyCollection<Guid>? cartItemIds,
        string? scope,
        Guid? shopId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var normalizedScope = NormalizeScopeFilter(scope);
        var (normalizedPage, normalizedPageSize) = VoucherConstants.NormalizePaging(page, pageSize);
        var cart = await _vouchers.GetCartPricingContextAsync(buyerUserId, cartItemIds, cancellationToken);
        var cartShopIds = cart.ShopSubtotals.Select(s => s.ShopId).ToList();
        var now = DateTime.UtcNow;

        var (records, totalCount) = await _vouchers.ListCandidateVouchersAsync(
            cartShopIds,
            normalizedScope,
            shopId,
            now,
            normalizedPage,
            normalizedPageSize,
            cancellationToken);

        var redemptionCounts = await _vouchers.CountUserRedemptionsAsync(
            records.Select(r => r.VoucherId).ToList(),
            buyerUserId,
            cancellationToken);

        var items = records.Select(voucher =>
        {
            var applicable = TryResolveApplicableSubtotal(voucher, cart, preferredShopId: null);
            var userUsed = redemptionCounts.GetValueOrDefault(voucher.VoucherId);
            var (eligible, reason) = EvaluateEligibility(
                voucher,
                applicable.Subtotal,
                applicable.HasApplicableShop,
                userUsed,
                now);
            var estimated = eligible
                ? VoucherConstants.CalculateDiscountAmount(
                    voucher.DiscountType,
                    voucher.DiscountValue,
                    voucher.MaxDiscountAmount,
                    applicable.Subtotal)
                : 0m;

            return new VoucherListItemDto
            {
                VoucherId = voucher.VoucherId,
                Code = voucher.Code,
                Name = voucher.Name,
                Description = voucher.Description,
                Scope = voucher.Scope,
                ShopId = voucher.ShopId,
                ShopName = voucher.ShopName,
                DiscountType = voucher.DiscountType,
                DiscountValue = voucher.DiscountValue,
                MaxDiscountAmount = voucher.MaxDiscountAmount,
                MinOrderAmount = voucher.MinOrderAmount,
                StartsAt = voucher.StartsAt,
                EndsAt = voucher.EndsAt,
                ApplicableSubtotal = applicable.Subtotal,
                EstimatedDiscountAmount = estimated,
                IsEligible = eligible,
                IneligibilityReason = reason
            };
        }).ToList();

        return new VoucherListResultDto
        {
            Items = items,
            Page = normalizedPage,
            PageSize = normalizedPageSize,
            TotalCount = totalCount,
            CartSubtotal = cart.GrandSubtotal,
            Currency = cart.Currency
        };
    }

    public async Task<ApplyVoucherPreviewResponse> PreviewAsync(
        Guid buyerUserId,
        ApplyVoucherPreviewRequest request,
        CancellationToken cancellationToken = default)
    {
        var hasId = request.VoucherId is Guid voucherId && voucherId != Guid.Empty;
        var hasCode = !string.IsNullOrWhiteSpace(request.Code);
        if (!hasId && !hasCode)
            throw new AppException("Voucher id or code is required.");

        IReadOnlyCollection<Guid>? cartItemIds = null;
        if (request.CartItemIds is { Count: > 0 })
        {
            cartItemIds = request.CartItemIds.Where(x => x != Guid.Empty).Distinct().ToList();
            if (cartItemIds.Count == 0)
                throw new AppException("Cart item ids are invalid.");
        }

        var voucher = await _vouchers.FindVoucherAsync(request.VoucherId, request.Code, cancellationToken)
            ?? throw new NotFoundException("Voucher not found.");

        var cart = await _vouchers.GetCartPricingContextAsync(buyerUserId, cartItemIds, cancellationToken);
        if (cart.ShopSubtotals.Count == 0)
            throw new AppException("Your cart is empty.");

        var applicable = ResolveApplicableSubtotal(voucher, cart, request.ShopId);
        var now = DateTime.UtcNow;
        var userUsed = await _vouchers.CountUserRedemptionsAsync(voucher.VoucherId, buyerUserId, cancellationToken);
        var (eligible, reason) = EvaluateEligibility(
            voucher,
            applicable.Subtotal,
            hasApplicableShop: true,
            userUsed,
            now);
        var discount = eligible
            ? VoucherConstants.CalculateDiscountAmount(
                voucher.DiscountType,
                voucher.DiscountValue,
                voucher.MaxDiscountAmount,
                applicable.Subtotal)
            : 0m;
        var shippingFee = OrderConstants.DefaultShippingFee;
        var total = decimal.Round(applicable.Subtotal - discount + shippingFee, 2, MidpointRounding.AwayFromZero);
        if (total < 0)
            total = 0m;

        return new ApplyVoucherPreviewResponse
        {
            VoucherId = voucher.VoucherId,
            Code = voucher.Code,
            Name = voucher.Name,
            Scope = voucher.Scope,
            ShopId = voucher.ShopId,
            ApplicableShopId = applicable.ShopId,
            ShopName = applicable.ShopName,
            DiscountType = voucher.DiscountType,
            DiscountValue = voucher.DiscountValue,
            SubtotalAmount = applicable.Subtotal,
            DiscountAmount = discount,
            ShippingFee = shippingFee,
            TotalAmount = total,
            Currency = applicable.Currency,
            IsValid = eligible,
            Message = eligible ? "Voucher can be applied." : reason
        };
    }

    internal static (Guid ShopId, string ShopName, decimal Subtotal, string Currency) ResolveApplicableSubtotal(
        VoucherRecord voucher,
        CartPricingContext cart,
        Guid? shopId)
    {
        if (string.Equals(voucher.Scope, VoucherConstants.ScopeShop, StringComparison.OrdinalIgnoreCase))
        {
            if (voucher.ShopId is null)
                throw new AppException("Shop voucher is misconfigured.");

            var targetShopId = shopId ?? voucher.ShopId.Value;
            if (targetShopId != voucher.ShopId.Value)
                throw new AppException("Shop voucher does not apply to the selected shop.");

            var shop = cart.ShopSubtotals.FirstOrDefault(s => s.ShopId == targetShopId)
                ?? throw new AppException("Cart has no items from this shop.");

            return (shop.ShopId, shop.ShopName, shop.Subtotal, shop.Currency);
        }

        if (shopId is Guid selectedShopId && selectedShopId != Guid.Empty)
        {
            var shop = cart.ShopSubtotals.FirstOrDefault(s => s.ShopId == selectedShopId)
                ?? throw new AppException("Cart has no items from this shop.");
            return (shop.ShopId, shop.ShopName, shop.Subtotal, shop.Currency);
        }

        if (cart.ShopSubtotals.Count > 1)
            throw new AppException("Shop id is required when applying a system voucher to a multi-shop cart.");

        var fallback = cart.ShopSubtotals.OrderByDescending(s => s.Subtotal).First();
        return (fallback.ShopId, fallback.ShopName, fallback.Subtotal, fallback.Currency);
    }

    internal static (
        Guid ShopId,
        string? ShopName,
        decimal Subtotal,
        string Currency,
        bool HasApplicableShop) TryResolveApplicableSubtotal(
        VoucherRecord voucher,
        CartPricingContext cart,
        Guid? preferredShopId)
    {
        if (string.Equals(voucher.Scope, VoucherConstants.ScopeShop, StringComparison.OrdinalIgnoreCase))
        {
            if (voucher.ShopId is null)
                return (Guid.Empty, voucher.ShopName, 0m, cart.Currency, false);

            var shop = cart.ShopSubtotals.FirstOrDefault(s => s.ShopId == voucher.ShopId.Value);
            if (shop is null)
                return (voucher.ShopId.Value, voucher.ShopName, 0m, cart.Currency, false);

            return (shop.ShopId, shop.ShopName, shop.Subtotal, shop.Currency, true);
        }

        if (preferredShopId is Guid selected && selected != Guid.Empty)
        {
            var shop = cart.ShopSubtotals.FirstOrDefault(s => s.ShopId == selected);
            if (shop is null)
                return (selected, null, 0m, cart.Currency, false);

            return (shop.ShopId, shop.ShopName, shop.Subtotal, shop.Currency, true);
        }

        if (cart.ShopSubtotals.Count == 0)
            return (Guid.Empty, null, 0m, cart.Currency, false);

        var fallback = cart.ShopSubtotals.OrderByDescending(s => s.Subtotal).First();
        return (fallback.ShopId, fallback.ShopName, fallback.Subtotal, fallback.Currency, true);
    }

    internal static (bool Eligible, string? Reason) EvaluateEligibility(
        VoucherRecord voucher,
        decimal applicableSubtotal,
        bool hasApplicableShop,
        int userRedemptionCount,
        DateTime utcNow)
    {
        if (!voucher.IsActive)
            return (false, "Voucher is not active.");

        if (utcNow < voucher.StartsAt)
            return (false, "Voucher has not started yet.");

        if (utcNow > voucher.EndsAt)
            return (false, "Voucher has expired.");

        if (!hasApplicableShop)
        {
            return string.Equals(voucher.Scope, VoucherConstants.ScopeShop, StringComparison.OrdinalIgnoreCase)
                ? (false, "Cart has no items from this shop.")
                : (false, "Your cart is empty.");
        }

        if (voucher.UsageLimit is int usageLimit && voucher.UsedCount >= usageLimit)
            return (false, "Voucher usage limit has been reached.");

        if (userRedemptionCount >= voucher.PerUserLimit)
            return (false, "You have already used this voucher the maximum number of times.");

        if (applicableSubtotal < voucher.MinOrderAmount)
            return (false, $"Minimum order amount is {voucher.MinOrderAmount:0.##}.");

        return (true, null);
    }

    private static string? NormalizeScopeFilter(string? scope)
    {
        if (string.IsNullOrWhiteSpace(scope) ||
            string.Equals(scope.Trim(), "all", StringComparison.OrdinalIgnoreCase))
            return null;

        var normalized = scope.Trim();
        if (!VoucherConstants.Scopes.Contains(normalized))
            throw new AppException("Voucher scope filter is invalid.");

        return string.Equals(normalized, VoucherConstants.ScopeSystem, StringComparison.OrdinalIgnoreCase)
            ? VoucherConstants.ScopeSystem
            : VoucherConstants.ScopeShop;
    }
}
