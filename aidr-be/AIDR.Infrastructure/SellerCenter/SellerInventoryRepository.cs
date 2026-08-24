using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.SellerCenter;

public sealed class SellerInventoryRepository : ISellerInventoryRepository
{
    private readonly AidrDbContext _db;

    public SellerInventoryRepository(AidrDbContext db) => _db = db;

    public async Task<(IReadOnlyList<SellerInventoryListItemDto> Items, int TotalCount, SellerInventorySummaryDto Summary)>
        ListByShopAsync(
            Guid shopId,
            string? keyword,
            bool? lowStockOnly,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default)
    {
        var baseQuery = _db.Products.AsNoTracking()
            .Where(p => p.ShopId == shopId && p.Status != SellerProductConstants.StatusDeleted);

        var summary = new SellerInventorySummaryDto
        {
            ProductCount = await baseQuery.CountAsync(cancellationToken),
            LowStockCount = await baseQuery.CountAsync(
                p => p.StockQuantity - p.ReservedQuantity <= p.LowStockThreshold,
                cancellationToken),
            TotalUnits = await baseQuery.SumAsync(p => (int?)p.StockQuantity, cancellationToken) ?? 0,
            ReservedUnits = await baseQuery.SumAsync(p => (int?)p.ReservedQuantity, cancellationToken) ?? 0
        };

        var query = baseQuery;
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var q = keyword.Trim();
            query = query.Where(p =>
                p.Name.Contains(q) ||
                (p.Brand != null && p.Brand.Contains(q)));
        }

        if (lowStockOnly == true)
            query = query.Where(p => p.StockQuantity - p.ReservedQuantity <= p.LowStockThreshold);

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderBy(p => p.StockQuantity - p.ReservedQuantity)
            .ThenBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.ProductId,
                p.Name,
                p.Slug,
                p.Status,
                PrimaryImageUrl = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault(),
                p.StockQuantity,
                p.ReservedQuantity,
                p.LowStockThreshold,
                p.LastCostPrice,
                p.AvgCostPrice,
                p.BasePrice,
                p.SalePrice,
                p.Currency,
                p.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(p =>
        {
            var available = Math.Max(0, p.StockQuantity - p.ReservedQuantity);
            return new SellerInventoryListItemDto
            {
                ProductId = p.ProductId,
                Name = p.Name,
                Slug = p.Slug,
                Status = p.Status,
                PrimaryImageUrl = p.PrimaryImageUrl,
                StockQuantity = p.StockQuantity,
                ReservedQuantity = p.ReservedQuantity,
                AvailableQuantity = available,
                LowStockThreshold = p.LowStockThreshold,
                IsLowStock = available <= p.LowStockThreshold,
                LastCostPrice = p.LastCostPrice,
                AvgCostPrice = p.AvgCostPrice,
                BasePrice = p.BasePrice,
                SalePrice = p.SalePrice,
                Currency = p.Currency,
                UpdatedAt = p.UpdatedAt
            };
        }).ToList();

        return (items, total, summary);
    }

    public async Task<SellerInventoryDetailDto?> GetDetailAsync(
        Guid shopId,
        Guid productId,
        int transactionLimit,
        CancellationToken cancellationToken = default)
    {
        var product = await _db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.ShopId == shopId && p.ProductId == productId, cancellationToken);
        if (product is null)
            return null;

        return await MapDetailAsync(product, transactionLimit, cancellationToken);
    }

    public Task<string?> GetProductStatusAsync(
        Guid shopId,
        Guid productId,
        CancellationToken cancellationToken = default) =>
        _db.Products.AsNoTracking()
            .Where(p => p.ShopId == shopId && p.ProductId == productId)
            .Select(p => p.Status)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<SellerInventoryDetailDto> ImportLotAsync(
        Guid shopId,
        Guid productId,
        ImportLotWriteModel model,
        CancellationToken cancellationToken = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        var product = await LoadOwnedProductAsync(shopId, productId, cancellationToken);

        var lotCode = string.IsNullOrWhiteSpace(model.LotCode)
            ? await NextLotCodeAsync(productId, model.ReceivedAt, cancellationToken)
            : model.LotCode.Trim();

        var duplicate = await _db.InventoryLots
            .AnyAsync(l => l.ProductId == productId && l.LotCode == lotCode, cancellationToken);
        if (duplicate)
            throw new ConflictException("Lot code already exists for this product.");

        var lot = new InventoryLot
        {
            LotId = Guid.NewGuid(),
            ProductId = productId,
            LotCode = lotCode,
            QuantityReceived = model.Quantity,
            QuantityRemaining = model.Quantity,
            UnitCost = model.UnitCost,
            Currency = SellerInventoryConstants.CurrencyVnd,
            SupplierName = model.SupplierName,
            InvoiceNumber = model.InvoiceNumber,
            ReceivedAt = model.ReceivedAt,
            ExpiresAt = model.ExpiresAt,
            Status = SellerInventoryConstants.LotStatusOpen,
            Note = model.Note,
            CreatedBy = model.CreatedBy,
            CreatedAt = DateTime.UtcNow
        };

        _db.InventoryLots.Add(lot);
        _db.InventoryTransactions.Add(new InventoryTransaction
        {
            ProductId = productId,
            LotId = lot.LotId,
            ChangeQty = model.Quantity,
            UnitCost = model.UnitCost,
            Reason = SellerInventoryConstants.ReasonStockIn,
            ReferenceType = SellerInventoryConstants.ReferenceTypeLot,
            ReferenceId = lot.LotId,
            Note = model.Note,
            CreatedBy = model.CreatedBy,
            CreatedAt = DateTime.UtcNow
        });

        product.LastCostPrice = model.UnitCost;
        await RecalcStockAsync(product, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return (await GetDetailAsync(shopId, productId, SellerInventoryConstants.DefaultTransactionLimit, cancellationToken))!;
    }

    public async Task<SellerInventoryDetailDto> AdjustAsync(
        Guid shopId,
        Guid productId,
        AdjustInventoryWriteModel model,
        CancellationToken cancellationToken = default)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        var product = await LoadOwnedProductAsync(shopId, productId, cancellationToken);

        if (model.ChangeQty > 0)
            await ApplyIncreaseAsync(product, model, cancellationToken);
        else
            await ApplyDecreaseAsync(product, model, cancellationToken);

        await RecalcStockAsync(product, cancellationToken);

        if (product.StockQuantity < product.ReservedQuantity)
            throw new ConflictException("Cannot reduce stock below the reserved quantity.");

        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return (await GetDetailAsync(shopId, productId, SellerInventoryConstants.DefaultTransactionLimit, cancellationToken))!;
    }

    public async Task<SellerInventoryDetailDto> UpdateLowStockThresholdAsync(
        Guid shopId,
        Guid productId,
        int lowStockThreshold,
        CancellationToken cancellationToken = default)
    {
        var product = await LoadOwnedProductAsync(shopId, productId, cancellationToken);
        product.LowStockThreshold = lowStockThreshold;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return (await GetDetailAsync(shopId, productId, SellerInventoryConstants.DefaultTransactionLimit, cancellationToken))!;
    }

    public async Task<SellerPriceUpdateDto> UpdateSellingPriceAsync(
        Guid shopId,
        Guid productId,
        UpdateSellingPriceWriteModel model,
        CancellationToken cancellationToken = default)
    {
        var product = await LoadOwnedProductAsync(shopId, productId, cancellationToken);

        if (product.BasePrice == model.BasePrice && product.SalePrice == model.SalePrice)
            throw new AppException("Selling price is unchanged.");

        var history = new ProductPriceHistory
        {
            ProductId = productId,
            OldBasePrice = product.BasePrice,
            NewBasePrice = model.BasePrice,
            OldSalePrice = product.SalePrice,
            NewSalePrice = model.SalePrice,
            ChangedBy = model.ChangedBy,
            Reason = model.Reason,
            ChangedAt = DateTime.UtcNow
        };

        var oldBase = product.BasePrice;
        var oldSale = product.SalePrice;
        product.BasePrice = model.BasePrice;
        product.SalePrice = model.SalePrice;
        product.UpdatedAt = DateTime.UtcNow;

        _db.ProductPriceHistories.Add(history);
        await _db.SaveChangesAsync(cancellationToken);

        return new SellerPriceUpdateDto
        {
            ProductId = product.ProductId,
            BasePrice = product.BasePrice,
            SalePrice = product.SalePrice,
            OldBasePrice = oldBase,
            OldSalePrice = oldSale,
            PriceHistoryId = history.PriceHistoryId,
            Currency = product.Currency
        };
    }

    private async Task ApplyIncreaseAsync(
        Product product,
        AdjustInventoryWriteModel model,
        CancellationToken cancellationToken)
    {
        if (model.LotId is null || model.LotId == Guid.Empty)
            throw new AppException("Lot id is required when increasing stock. Import a new lot to add stock with a unit cost.");

        var lot = await _db.InventoryLots
            .FirstOrDefaultAsync(
                l => l.LotId == model.LotId && l.ProductId == product.ProductId,
                cancellationToken)
            ?? throw new NotFoundException("Inventory lot not found.");

        if (lot.Status == SellerInventoryConstants.LotStatusVoid)
            throw new ConflictException("Cannot adjust a voided lot.");

        lot.QuantityReceived += model.ChangeQty;
        lot.QuantityRemaining += model.ChangeQty;
        if (lot.Status == SellerInventoryConstants.LotStatusDepleted)
            lot.Status = SellerInventoryConstants.LotStatusOpen;

        _db.InventoryTransactions.Add(new InventoryTransaction
        {
            ProductId = product.ProductId,
            LotId = lot.LotId,
            ChangeQty = model.ChangeQty,
            UnitCost = lot.UnitCost,
            Reason = SellerInventoryConstants.ReasonManualAdjust,
            ReferenceType = SellerInventoryConstants.ReferenceTypeLot,
            ReferenceId = lot.LotId,
            Note = model.Note,
            CreatedBy = model.CreatedBy,
            CreatedAt = DateTime.UtcNow
        });
    }

    private async Task ApplyDecreaseAsync(
        Product product,
        AdjustInventoryWriteModel model,
        CancellationToken cancellationToken)
    {
        var reduceQty = Math.Abs(model.ChangeQty);
        var available = Math.Max(0, product.StockQuantity - product.ReservedQuantity);
        if (reduceQty > available)
            throw new ConflictException("Insufficient available stock for this adjustment.");

        if (model.LotId is { } lotId && lotId != Guid.Empty)
        {
            var lot = await _db.InventoryLots
                .FirstOrDefaultAsync(l => l.LotId == lotId && l.ProductId == product.ProductId, cancellationToken)
                ?? throw new NotFoundException("Inventory lot not found.");

            if (lot.Status == SellerInventoryConstants.LotStatusVoid)
                throw new ConflictException("Cannot adjust a voided lot.");

            if (lot.QuantityRemaining < reduceQty)
                throw new ConflictException("The selected lot does not have enough remaining quantity.");

            ApplyLotDecrease(lot, reduceQty, product.ProductId, model);
            return;
        }

        var lots = await _db.InventoryLots
            .Where(l =>
                l.ProductId == product.ProductId &&
                l.Status == SellerInventoryConstants.LotStatusOpen &&
                l.QuantityRemaining > 0)
            .OrderBy(l => l.ReceivedAt)
            .ThenBy(l => l.CreatedAt)
            .ToListAsync(cancellationToken);

        var remaining = reduceQty;
        foreach (var lot in lots)
        {
            if (remaining == 0)
                break;

            var take = Math.Min(lot.QuantityRemaining, remaining);
            ApplyLotDecrease(lot, take, product.ProductId, model);
            remaining -= take;
        }

        if (remaining > 0)
            throw new ConflictException("Insufficient lot quantity to complete this adjustment.");
    }

    private void ApplyLotDecrease(InventoryLot lot, int qty, Guid productId, AdjustInventoryWriteModel model)
    {
        lot.QuantityRemaining -= qty;
        if (lot.QuantityRemaining == 0)
            lot.Status = SellerInventoryConstants.LotStatusDepleted;

        _db.InventoryTransactions.Add(new InventoryTransaction
        {
            ProductId = productId,
            LotId = lot.LotId,
            ChangeQty = -qty,
            UnitCost = lot.UnitCost,
            Reason = SellerInventoryConstants.ReasonManualAdjust,
            ReferenceType = SellerInventoryConstants.ReferenceTypeLot,
            ReferenceId = lot.LotId,
            Note = model.Note,
            CreatedBy = model.CreatedBy,
            CreatedAt = DateTime.UtcNow
        });
    }

    private async Task RecalcStockAsync(Product product, CancellationToken cancellationToken)
    {
        var tracked = _db.ChangeTracker.Entries<InventoryLot>()
            .Where(e => e.Entity.ProductId == product.ProductId && e.State != EntityState.Deleted)
            .Select(e => e.Entity)
            .ToList();
        var trackedIds = tracked.Select(l => l.LotId).ToHashSet();

        var others = await _db.InventoryLots
            .Where(l => l.ProductId == product.ProductId && !trackedIds.Contains(l.LotId))
            .ToListAsync(cancellationToken);

        var lots = tracked.Concat(others)
            .Where(l => l.Status != SellerInventoryConstants.LotStatusVoid)
            .ToList();

        var remaining = lots.Sum(l => l.QuantityRemaining);
        product.StockQuantity = remaining;
        product.AvgCostPrice = remaining == 0
            ? null
            : decimal.Round(
                lots.Sum(l => l.QuantityRemaining * l.UnitCost) / remaining,
                2,
                MidpointRounding.AwayFromZero);
        product.UpdatedAt = DateTime.UtcNow;
    }

    private async Task<Product> LoadOwnedProductAsync(
        Guid shopId,
        Guid productId,
        CancellationToken cancellationToken)
    {
        var product = await _db.Products
            .FirstOrDefaultAsync(p => p.ShopId == shopId && p.ProductId == productId, cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        if (product.Status == SellerProductConstants.StatusDeleted)
            throw new ConflictException("Cannot manage inventory for a deleted product.");

        return product;
    }

    private async Task<string> NextLotCodeAsync(
        Guid productId,
        DateTime receivedAt,
        CancellationToken cancellationToken)
    {
        var prefix = $"LOT-{receivedAt:yyyyMMdd}-";
        var codes = await _db.InventoryLots.AsNoTracking()
            .Where(l => l.ProductId == productId && l.LotCode.StartsWith(prefix))
            .Select(l => l.LotCode)
            .ToListAsync(cancellationToken);

        var max = 0;
        foreach (var code in codes)
        {
            var suffix = code.Length > prefix.Length ? code[prefix.Length..] : string.Empty;
            if (int.TryParse(suffix, out var n))
                max = Math.Max(max, n);
        }

        return $"{prefix}{(max + 1):D3}";
    }

    private async Task<SellerInventoryDetailDto> MapDetailAsync(
        Product product,
        int transactionLimit,
        CancellationToken cancellationToken)
    {
        var lots = await _db.InventoryLots.AsNoTracking()
            .Where(l => l.ProductId == product.ProductId)
            .OrderByDescending(l => l.ReceivedAt)
            .ThenByDescending(l => l.CreatedAt)
            .Select(l => new SellerInventoryLotDto
            {
                LotId = l.LotId,
                LotCode = l.LotCode,
                QuantityReceived = l.QuantityReceived,
                QuantityRemaining = l.QuantityRemaining,
                UnitCost = l.UnitCost,
                Currency = l.Currency,
                SupplierName = l.SupplierName,
                InvoiceNumber = l.InvoiceNumber,
                ReceivedAt = l.ReceivedAt,
                ExpiresAt = l.ExpiresAt,
                Status = l.Status,
                Note = l.Note
            })
            .ToListAsync(cancellationToken);

        var transactions = await _db.InventoryTransactions.AsNoTracking()
            .Where(t => t.ProductId == product.ProductId)
            .OrderByDescending(t => t.CreatedAt)
            .ThenByDescending(t => t.InventoryTxId)
            .Take(transactionLimit)
            .Select(t => new SellerInventoryTransactionDto
            {
                InventoryTxId = t.InventoryTxId,
                LotId = t.LotId,
                LotCode = t.Lot != null ? t.Lot.LotCode : null,
                ChangeQty = t.ChangeQty,
                UnitCost = t.UnitCost,
                Reason = t.Reason,
                ReferenceType = t.ReferenceType,
                ReferenceId = t.ReferenceId,
                Note = t.Note,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var available = Math.Max(0, product.StockQuantity - product.ReservedQuantity);
        return new SellerInventoryDetailDto
        {
            ProductId = product.ProductId,
            Name = product.Name,
            Status = product.Status,
            StockQuantity = product.StockQuantity,
            ReservedQuantity = product.ReservedQuantity,
            AvailableQuantity = available,
            LowStockThreshold = product.LowStockThreshold,
            IsLowStock = available <= product.LowStockThreshold,
            LastCostPrice = product.LastCostPrice,
            AvgCostPrice = product.AvgCostPrice,
            BasePrice = product.BasePrice,
            SalePrice = product.SalePrice,
            Currency = product.Currency,
            Lots = lots,
            RecentTransactions = transactions
        };
    }
}
