using AIDR.Modules.Engagement.Abstractions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Caching;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.SellerCenter.Services;

public sealed class SellerInventoryService : ISellerInventoryService
{
    private readonly ISellerProductRepository _products;
    private readonly ISellerInventoryRepository _inventory;
    private readonly ILowStockNotifier _lowStockNotifier;
    private readonly ICacheService _cache;

    public SellerInventoryService(
        ISellerProductRepository products,
        ISellerInventoryRepository inventory,
        ILowStockNotifier lowStockNotifier,
        ICacheService cache)
    {
        _products = products;
        _inventory = inventory;
        _lowStockNotifier = lowStockNotifier;
        _cache = cache;
    }

    public async Task<SellerInventoryListResult> ListAsync(
        Guid ownerUserId,
        SellerInventoryQueryRequest request,
        CancellationToken cancellationToken = default)
    {
        var shop = await RequireActiveShopAsync(ownerUserId, cancellationToken);
        var page = request.Page <= 0 ? SellerInventoryConstants.DefaultPage : request.Page;
        var pageSize = request.PageSize <= 0
            ? SellerInventoryConstants.DefaultPageSize
            : Math.Min(request.PageSize, SellerInventoryConstants.MaxPageSize);

        var keyword = string.IsNullOrWhiteSpace(request.Q) ? null : request.Q.Trim();
        if (keyword is not null && keyword.Length > DiscoveryConstants.MaxSearchQueryLength)
            throw new AppException($"Search query must not exceed {DiscoveryConstants.MaxSearchQueryLength} characters.");

        var (items, total, summary) = await _inventory.ListByShopAsync(
            shop.ShopId,
            keyword,
            request.LowStock,
            page,
            pageSize,
            cancellationToken);

        return new SellerInventoryListResult
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = total,
            Summary = summary
        };
    }

    public async Task<SellerInventoryDetailDto> GetByProductIdAsync(
        Guid ownerUserId,
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        var shop = await RequireOwnedProductAsync(ownerUserId, productId, cancellationToken);
        return await _inventory.GetDetailAsync(
                   shop.ShopId,
                   productId,
                   SellerInventoryConstants.DefaultTransactionLimit,
                   cancellationToken)
               ?? throw new NotFoundException("Product not found.");
    }

    public async Task<SellerInventoryDetailDto> UpdateLowStockThresholdAsync(
        Guid ownerUserId,
        Guid productId,
        UpdateSellerInventoryRequest request,
        CancellationToken cancellationToken = default)
    {
        var shop = await RequireOwnedProductAsync(ownerUserId, productId, cancellationToken, rejectDeleted: true);
        if (request.LowStockThreshold < 0 || request.LowStockThreshold > SellerInventoryConstants.MaxLowStockThreshold)
            throw new AppException($"Low stock threshold must be between 0 and {SellerInventoryConstants.MaxLowStockThreshold}.");

        var before = await _inventory.GetDetailAsync(
            shop.ShopId,
            productId,
            SellerInventoryConstants.DefaultTransactionLimit,
            cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        var result = await _inventory.UpdateLowStockThresholdAsync(
            shop.ShopId,
            productId,
            request.LowStockThreshold,
            cancellationToken);

        await InvalidateProductCacheAsync(productId, cancellationToken);
        await _lowStockNotifier.TryNotifyIfBecameLowAsync(productId, before.IsLowStock, cancellationToken);
        return result;
    }

    public async Task<SellerInventoryDetailDto> AdjustAsync(
        Guid ownerUserId,
        Guid productId,
        AdjustSellerInventoryRequest request,
        CancellationToken cancellationToken = default)
    {
        var shop = await RequireOwnedProductAsync(ownerUserId, productId, cancellationToken, rejectDeleted: true);
        if (request.ChangeQty == 0)
            throw new AppException("Change quantity must not be zero.");

        if (Math.Abs(request.ChangeQty) > SellerInventoryConstants.MaxQuantity)
            throw new AppException($"Change quantity must not exceed {SellerInventoryConstants.MaxQuantity}.");

        var note = OptionalBounded(request.Note, "Note", SellerInventoryConstants.MaxTransactionNoteLength);

        var before = await _inventory.GetDetailAsync(
            shop.ShopId,
            productId,
            SellerInventoryConstants.DefaultTransactionLimit,
            cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        var result = await _inventory.AdjustAsync(
            shop.ShopId,
            productId,
            new AdjustInventoryWriteModel
            {
                VariantId = request.VariantId,
                ChangeQty = request.ChangeQty,
                LotId = request.LotId,
                Note = note,
                CreatedBy = ownerUserId
            },
            cancellationToken);

        await InvalidateProductCacheAsync(productId, cancellationToken);
        await _lowStockNotifier.TryNotifyIfBecameLowAsync(productId, before.IsLowStock, cancellationToken);
        return result;
    }

    public async Task<SellerInventoryDetailDto> ImportLotAsync(
        Guid ownerUserId,
        Guid productId,
        ImportStockLotRequest request,
        CancellationToken cancellationToken = default)
    {
        var shop = await RequireOwnedProductAsync(ownerUserId, productId, cancellationToken, rejectDeleted: true);

        if (request.Quantity <= 0 || request.Quantity > SellerInventoryConstants.MaxQuantity)
            throw new AppException($"Quantity must be between 1 and {SellerInventoryConstants.MaxQuantity}.");

        ValidateMoney(request.UnitCost, "Unit cost");

        var lotCode = OptionalBounded(request.LotCode, "Lot code", SellerInventoryConstants.MaxLotCodeLength);
        if (lotCode is not null && lotCode.Any(ch => !(char.IsLetterOrDigit(ch) || ch is '-' or '_')))
            throw new AppException("Lot code may contain only letters, numbers, hyphen, and underscore.");

        var supplier = OptionalBounded(request.SupplierName, "Supplier name", SellerInventoryConstants.MaxSupplierNameLength);
        var invoice = OptionalBounded(request.InvoiceNumber, "Invoice number", SellerInventoryConstants.MaxInvoiceNumberLength);
        var note = OptionalBounded(request.Note, "Note", SellerInventoryConstants.MaxLotNoteLength);

        var receivedAt = NormalizeUtc(request.ReceivedAt) ?? DateTime.UtcNow;
        var expiresAt = NormalizeUtc(request.ExpiresAt);
        if (expiresAt is { } exp && exp <= receivedAt)
            throw new AppException("Expiry date must be after the received date.");

        var result = await _inventory.ImportLotAsync(
            shop.ShopId,
            productId,
            new ImportLotWriteModel
            {
                VariantId = request.VariantId,
                LotCode = lotCode,
                Quantity = request.Quantity,
                UnitCost = decimal.Round(request.UnitCost, 2, MidpointRounding.AwayFromZero),
                SupplierName = supplier,
                InvoiceNumber = invoice,
                ReceivedAt = receivedAt,
                ExpiresAt = expiresAt,
                Note = note,
                CreatedBy = ownerUserId
            },
            cancellationToken);

        await InvalidateProductCacheAsync(productId, cancellationToken);
        return result;
    }

    public async Task<SellerPriceUpdateDto> UpdateSellingPriceAsync(
        Guid ownerUserId,
        Guid productId,
        UpdateSellingPriceRequest request,
        CancellationToken cancellationToken = default)
    {
        var shop = await RequireOwnedProductAsync(ownerUserId, productId, cancellationToken, rejectDeleted: true);
        ValidateMoney(request.BasePrice, "Base price");
        if (request.SalePrice is { } sale)
            ValidateMoney(sale, "Sale price");

        var reason = OptionalBounded(request.Reason, "Reason", SellerInventoryConstants.MaxPriceReasonLength);

        var result = await _inventory.UpdateSellingPriceAsync(
            shop.ShopId,
            productId,
            new UpdateSellingPriceWriteModel
            {
                BasePrice = decimal.Round(request.BasePrice, 2, MidpointRounding.AwayFromZero),
                SalePrice = request.SalePrice is null
                    ? null
                    : decimal.Round(request.SalePrice.Value, 2, MidpointRounding.AwayFromZero),
                Reason = reason,
                ChangedBy = ownerUserId
            },
            cancellationToken);

        await InvalidateProductCacheAsync(productId, cancellationToken);
        return result;
    }

    private async Task<SellerShopRecord> RequireOwnedProductAsync(
        Guid ownerUserId,
        Guid productId,
        CancellationToken cancellationToken,
        bool rejectDeleted = false)
    {
        if (productId == Guid.Empty)
            throw new AppException("Product id is required.");

        var shop = await RequireActiveShopAsync(ownerUserId, cancellationToken);
        var status = await _inventory.GetProductStatusAsync(shop.ShopId, productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        if (rejectDeleted && status == SellerProductConstants.StatusDeleted)
            throw new ConflictException("Cannot manage inventory for a deleted product.");

        return shop;
    }

    private async Task<SellerShopRecord> RequireActiveShopAsync(
        Guid ownerUserId,
        CancellationToken cancellationToken)
    {
        if (ownerUserId == Guid.Empty)
            throw new AppException("User id is required.");

        return await _products.GetActiveShopByOwnerAsync(ownerUserId, cancellationToken)
            ?? throw new ForbiddenAppException("Active shop not found for the current seller.");
    }

    private async Task InvalidateProductCacheAsync(Guid productId, CancellationToken cancellationToken) =>
        await _cache.RemoveAsync(SellerProductConstants.ProductDetailCacheKey(productId), cancellationToken);

    private static void ValidateMoney(decimal value, string fieldName)
    {
        if (value < 0)
            throw new AppException($"{fieldName} must be greater than or equal to 0.");
        if (value > SellerInventoryConstants.MaxMoney)
            throw new AppException($"{fieldName} is too large.");
    }

    private static DateTime? NormalizeUtc(DateTime? value)
    {
        if (value is null)
            return null;

        var dt = value.Value;
        return dt.Kind switch
        {
            DateTimeKind.Utc => dt,
            DateTimeKind.Local => dt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
        };
    }

    private static string? OptionalBounded(string? value, string fieldName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new AppException($"{fieldName} must not exceed {maxLength} characters.");

        return trimmed;
    }
}
