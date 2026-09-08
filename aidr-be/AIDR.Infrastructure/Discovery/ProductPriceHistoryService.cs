using AIDR.Infrastructure.Persistence;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Modules.Engagement.Services;
using AIDR.Shared.Caching;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AIDR.Infrastructure.Discovery;

public sealed class ProductPriceHistoryService : IProductPriceHistoryService
{
    private readonly AidrDbContext _db;
    private readonly ICacheService _cache;
    private readonly PriceAlertOptions _options;

    public ProductPriceHistoryService(
        AidrDbContext db,
        ICacheService cache,
        IOptions<PriceAlertOptions> options)
    {
        _db = db;
        _cache = cache;
        _options = options.Value;
    }

    public async Task<ProductPriceHistoryDto> GetHistoryAsync(
        Guid productId,
        int days,
        CancellationToken cancellationToken = default)
    {
        if (productId == Guid.Empty)
            throw new AppException("Product id is required.");

        var normalizedDays = PriceAlertConstants.NormalizeHistoryDays(days);
        var cacheKey = PriceAlertConstants.PriceHistoryCacheKey(productId, normalizedDays);
        var ttl = TimeSpan.FromMinutes(Math.Max(1, _options.CacheTtlMinutes));

        var cached = await _cache.GetAsync<ProductPriceHistoryDto>(cacheKey, cancellationToken);
        if (cached is not null)
            return cached;

        var product = await _db.Products
            .AsNoTracking()
            .Where(p => p.ProductId == productId && p.Status == WishlistConstants.ApprovedStatus)
            .Select(p => new
            {
                p.ProductId,
                p.BasePrice,
                p.SalePrice
            })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Product not found.");

        var currentPrice = product.SalePrice ?? product.BasePrice;
        var since = DateTime.UtcNow.AddDays(-normalizedDays);

        var historyRows = await _db.ProductPriceHistories
            .AsNoTracking()
            .Where(h => h.ProductId == productId && h.ChangedAt >= since)
            .OrderBy(h => h.ChangedAt)
            .Select(h => new
            {
                h.ChangedAt,
                Price = h.NewSalePrice ?? h.NewBasePrice ?? currentPrice
            })
            .ToListAsync(cancellationToken);

        var points = new List<ProductPriceHistoryPointDto>();

        if (historyRows.Count == 0)
        {
            points.Add(new ProductPriceHistoryPointDto { At = since, Price = currentPrice });
        }
        else
        {
            foreach (var row in historyRows)
            {
                points.Add(new ProductPriceHistoryPointDto
                {
                    At = row.ChangedAt,
                    Price = row.Price
                });
            }
        }

        points.Add(new ProductPriceHistoryPointDto
        {
            At = DateTime.UtcNow,
            Price = currentPrice
        });

        var distinctPoints = points
            .GroupBy(p => p.At)
            .Select(g => g.Last())
            .OrderBy(p => p.At)
            .ToList();

        var result = new ProductPriceHistoryDto
        {
            ProductId = productId,
            Days = normalizedDays,
            CurrentPrice = currentPrice,
            LowestInPeriod = distinctPoints.Count > 0 ? distinctPoints.Min(p => p.Price) : currentPrice,
            HighestInPeriod = distinctPoints.Count > 0 ? distinctPoints.Max(p => p.Price) : currentPrice,
            Points = distinctPoints
        };

        await _cache.SetAsync(cacheKey, result, ttl, cancellationToken);
        return result;
    }
}
