using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Engagement;

public sealed class PriceAlertRepository : IPriceAlertRepository
{
    private readonly AidrDbContext _db;

    public PriceAlertRepository(AidrDbContext db) => _db = db;

    public async Task<PagedResult<PriceAlertDto>> ListAsync(
        Guid userId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _db.ProductPriceAlerts
            .AsNoTracking()
            .Where(a => a.UserId == userId && a.IsActive);

        var totalCount = await query.CountAsync(cancellationToken);

        var rows = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                a.PriceAlertId,
                a.ProductId,
                a.AlertType,
                a.BaselinePrice,
                a.ThresholdPct,
                a.ThresholdAmount,
                a.IsActive,
                a.LastTriggeredAt,
                a.ExpiresAt,
                a.CreatedAt,
                ProductName = a.Product.Name,
                ProductSlug = a.Product.Slug,
                BasePrice = a.Product.BasePrice,
                SalePrice = a.Product.SalePrice,
                StockQuantity = a.Product.StockQuantity,
                ReservedQuantity = a.Product.ReservedQuantity,
                PrimaryImageUrl = a.Product.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(r => MapDto(
            r.PriceAlertId,
            r.ProductId,
            r.ProductName,
            r.ProductSlug,
            r.PrimaryImageUrl,
            r.AlertType,
            r.BaselinePrice,
            r.ThresholdPct,
            r.ThresholdAmount,
            r.BasePrice,
            r.SalePrice,
            r.IsActive,
            r.LastTriggeredAt,
            r.ExpiresAt,
            r.CreatedAt)).ToList();

        return new PagedResult<PriceAlertDto>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<ProductPriceAlertStatusDto> GetStatusAsync(
        Guid userId,
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        var types = await _db.ProductPriceAlerts
            .AsNoTracking()
            .Where(a => a.UserId == userId && a.ProductId == productId && a.IsActive)
            .Select(a => a.AlertType)
            .ToListAsync(cancellationToken);

        return new ProductPriceAlertStatusDto
        {
            PriceDrop = types.Any(t =>
                string.Equals(t, PriceAlertConstants.AlertTypePriceDrop, StringComparison.OrdinalIgnoreCase)),
            BackInStock = types.Any(t =>
                string.Equals(t, PriceAlertConstants.AlertTypeBackInStock, StringComparison.OrdinalIgnoreCase))
        };
    }

    public Task<PriceAlertProductSnapshot?> GetAlertableProductAsync(
        Guid productId,
        CancellationToken cancellationToken = default)
    {
        return _db.Products
            .AsNoTracking()
            .Where(p => p.ProductId == productId)
            .Select(p => new PriceAlertProductSnapshot
            {
                ProductId = p.ProductId,
                Name = p.Name,
                Slug = p.Slug,
                PrimaryImageUrl = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault(),
                Status = p.Status,
                ShopStatus = p.Shop.Status,
                BasePrice = p.BasePrice,
                SalePrice = p.SalePrice,
                StockQuantity = p.StockQuantity,
                ReservedQuantity = p.ReservedQuantity
            })
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<PriceAlertDto> UpsertAsync(
        Guid userId,
        CreatePriceAlertRequest request,
        CancellationToken cancellationToken = default)
    {
        var alertType = PriceAlertConstants.CanonicalAlertType(request.AlertType);
        var thresholdPct = request.ThresholdPct ?? PriceAlertConstants.DefaultThresholdPct;
        var thresholdAmount = request.ThresholdAmount ?? PriceAlertConstants.DefaultThresholdAmount;

        var product = await _db.Products
            .AsNoTracking()
            .Where(p => p.ProductId == request.ProductId)
            .Select(p => new
            {
                p.ProductId,
                p.Name,
                p.Slug,
                p.BasePrice,
                p.SalePrice,
                p.StockQuantity,
                p.ReservedQuantity,
                PrimaryImageUrl = p.Images
                    .OrderByDescending(i => i.IsPrimary)
                    .ThenBy(i => i.SortOrder)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault()
            })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        var effectivePrice = product.SalePrice ?? product.BasePrice;
        var available = Math.Max(0, product.StockQuantity - product.ReservedQuantity);

        var existing = await _db.ProductPriceAlerts
            .FirstOrDefaultAsync(
                a => a.UserId == userId && a.ProductId == request.ProductId && a.AlertType == alertType,
                cancellationToken);

        var now = DateTime.UtcNow;
        var expiresAt = now.AddDays(PriceAlertConstants.DefaultAlertTtlDays);

        if (existing is null)
        {
            existing = new ProductPriceAlert
            {
                PriceAlertId = Guid.NewGuid(),
                UserId = userId,
                ProductId = request.ProductId,
                AlertType = alertType,
                CreatedAt = now
            };
            _db.ProductPriceAlerts.Add(existing);
        }

        existing.ThresholdPct = thresholdPct;
        existing.ThresholdAmount = thresholdAmount;
        existing.IsActive = true;
        existing.ExpiresAt = expiresAt;
        existing.LastTriggeredAt = null;

        if (string.Equals(alertType, PriceAlertConstants.AlertTypePriceDrop, StringComparison.OrdinalIgnoreCase))
            existing.BaselinePrice = effectivePrice;
        else
            existing.BaselinePrice = null;

        await _db.SaveChangesAsync(cancellationToken);

        return new PriceAlertDto
        {
            PriceAlertId = existing.PriceAlertId,
            ProductId = product.ProductId,
            ProductName = product.Name,
            ProductSlug = product.Slug,
            PrimaryImageUrl = product.PrimaryImageUrl,
            AlertType = alertType,
            BaselinePrice = existing.BaselinePrice,
            ThresholdPct = existing.ThresholdPct,
            ThresholdAmount = existing.ThresholdAmount,
            CurrentPrice = effectivePrice,
            IsActive = existing.IsActive,
            LastTriggeredAt = existing.LastTriggeredAt,
            ExpiresAt = existing.ExpiresAt,
            CreatedAt = existing.CreatedAt
        };
    }

    public async Task<RemovePriceAlertResponse?> RemoveAsync(
        Guid userId,
        Guid priceAlertId,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.ProductPriceAlerts
            .FirstOrDefaultAsync(a => a.PriceAlertId == priceAlertId && a.UserId == userId, cancellationToken);

        if (entity is null)
            return null;

        entity.IsActive = false;
        await _db.SaveChangesAsync(cancellationToken);

        return new RemovePriceAlertResponse
        {
            PriceAlertId = entity.PriceAlertId,
            ProductId = entity.ProductId,
            AlertType = entity.AlertType
        };
    }

    public async Task<RemovePriceAlertResponse?> RemoveByProductAsync(
        Guid userId,
        Guid productId,
        string alertType,
        CancellationToken cancellationToken = default)
    {
        var canonical = PriceAlertConstants.CanonicalAlertType(alertType);
        var entity = await _db.ProductPriceAlerts
            .FirstOrDefaultAsync(
                a => a.UserId == userId && a.ProductId == productId && a.AlertType == canonical && a.IsActive,
                cancellationToken);

        if (entity is null)
            return null;

        entity.IsActive = false;
        await _db.SaveChangesAsync(cancellationToken);

        return new RemovePriceAlertResponse
        {
            PriceAlertId = entity.PriceAlertId,
            ProductId = entity.ProductId,
            AlertType = entity.AlertType
        };
    }

    public async Task<IReadOnlyList<PriceAlertSweepRow>> ListActiveForSweepAsync(
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        return await _db.ProductPriceAlerts
            .AsNoTracking()
            .Where(a => a.IsActive && (a.ExpiresAt == null || a.ExpiresAt > now))
            .Select(a => new PriceAlertSweepRow
            {
                PriceAlertId = a.PriceAlertId,
                UserId = a.UserId,
                ProductId = a.ProductId,
                ProductName = a.Product.Name,
                AlertType = a.AlertType,
                BaselinePrice = a.BaselinePrice,
                ThresholdPct = a.ThresholdPct,
                ThresholdAmount = a.ThresholdAmount,
                LastTriggeredAt = a.LastTriggeredAt,
                CurrentPrice = a.Product.SalePrice ?? a.Product.BasePrice,
                AvailableQuantity = Math.Max(0, a.Product.StockQuantity - a.Product.ReservedQuantity)
            })
            .ToListAsync(cancellationToken);
    }

    public async Task MarkTriggeredAsync(
        Guid priceAlertId,
        DateTime triggeredAt,
        decimal? newBaselinePrice,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.ProductPriceAlerts
            .FirstOrDefaultAsync(a => a.PriceAlertId == priceAlertId, cancellationToken);

        if (entity is null)
            return;

        entity.LastTriggeredAt = triggeredAt;
        if (newBaselinePrice.HasValue)
            entity.BaselinePrice = newBaselinePrice.Value;

        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task DeactivateExpiredAsync(DateTime now, CancellationToken cancellationToken = default)
    {
        await _db.ProductPriceAlerts
            .Where(a => a.IsActive && a.ExpiresAt != null && a.ExpiresAt <= now)
            .ExecuteUpdateAsync(
                s => s.SetProperty(a => a.IsActive, false),
                cancellationToken);
    }

    private static PriceAlertDto MapDto(
        Guid priceAlertId,
        Guid productId,
        string productName,
        string productSlug,
        string? primaryImageUrl,
        string alertType,
        decimal? baselinePrice,
        decimal thresholdPct,
        decimal thresholdAmount,
        decimal basePrice,
        decimal? salePrice,
        bool isActive,
        DateTime? lastTriggeredAt,
        DateTime? expiresAt,
        DateTime createdAt)
    {
        return new PriceAlertDto
        {
            PriceAlertId = priceAlertId,
            ProductId = productId,
            ProductName = productName,
            ProductSlug = productSlug,
            PrimaryImageUrl = primaryImageUrl,
            AlertType = alertType,
            BaselinePrice = baselinePrice,
            ThresholdPct = thresholdPct,
            ThresholdAmount = thresholdAmount,
            CurrentPrice = salePrice ?? basePrice,
            IsActive = isActive,
            LastTriggeredAt = lastTriggeredAt,
            ExpiresAt = expiresAt,
            CreatedAt = createdAt
        };
    }
}
