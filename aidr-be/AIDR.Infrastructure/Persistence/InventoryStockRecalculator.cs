using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Persistence;

/// <summary>
/// Rebuilds the denormalised stock figures from the inventory lots, which are the
/// single source of truth for what is physically on hand.
///
/// A lot carries a VariantId once a product is sold in configurations, so a variant's
/// stock is the sum of its own lots and the product's is the sum of all of them. Both
/// the checkout path and the seller's inventory screen have to agree on that arithmetic,
/// which is why it lives here rather than being written twice.
/// </summary>
public static class InventoryStockRecalculator
{
    public static async Task RecalcAsync(
        AidrDbContext db,
        Product product,
        CancellationToken cancellationToken)
    {
        // Lots changed earlier in this unit of work are only in the change tracker, so
        // reading the table alone would recompute from pre-change values.
        var tracked = db.ChangeTracker.Entries<InventoryLot>()
            .Where(e => e.Entity.ProductId == product.ProductId && e.State != EntityState.Deleted)
            .Select(e => e.Entity)
            .ToList();
        var trackedIds = tracked.Select(l => l.LotId).ToHashSet();

        var others = await db.InventoryLots
            .Where(l => l.ProductId == product.ProductId && !trackedIds.Contains(l.LotId))
            .ToListAsync(cancellationToken);

        var lots = tracked.Concat(others)
            .Where(l => l.Status != SellerInventoryConstants.LotStatusVoid)
            .ToList();

        var now = DateTime.UtcNow;

        var variants = await db.ProductVariants
            .Where(v => v.ProductId == product.ProductId)
            .ToListAsync(cancellationToken);

        foreach (var variant in variants)
        {
            var variantLots = lots.Where(l => l.VariantId == variant.VariantId).ToList();
            var (quantity, avgCost) = Totals(variantLots);

            variant.StockQuantity = quantity;
            variant.AvgCostPrice = avgCost;
            variant.UpdatedAt = now;
        }

        var (productQuantity, productAvgCost) = Totals(lots);
        product.StockQuantity = productQuantity;
        product.AvgCostPrice = productAvgCost;
        product.UpdatedAt = now;
    }

    private static (int Quantity, decimal? AvgCost) Totals(IReadOnlyCollection<InventoryLot> lots)
    {
        var remaining = lots.Sum(l => l.QuantityRemaining);
        if (remaining == 0)
            return (0, null);

        var avgCost = decimal.Round(
            lots.Sum(l => l.QuantityRemaining * l.UnitCost) / remaining,
            2,
            MidpointRounding.AwayFromZero);

        return (remaining, avgCost);
    }
}
