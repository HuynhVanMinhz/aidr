using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Persistence.Entities;
using AIDR.Shared.Serialization;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Seeding;

/// <summary>
/// Turns a handful of demo products into variant products — the "iPhone 17 orange 128GB
/// costs more than white 256GB" case.
///
/// Converting is more than inserting rows. A variant product has no sellable stock of its
/// own: checkout allocates from lots carrying the variant's id, so a product-level lot left
/// behind would be inventory nothing can ever draw on. The existing lot is therefore
/// reassigned to the first variant rather than stranded, and a lot is created for each of
/// the others.
///
/// Idempotent: variant ids are derived from the product id and the combination, so a second
/// run updates the same rows instead of duplicating them.
/// </summary>
public static class ProductVariantsDemoSeeder
{
    private sealed record Axis(string Name, params string[] Values);

    /// <summary>Price adjustment for one option value, relative to the product's base price.</summary>
    private sealed record Delta(string Axis, string Value, decimal Amount);

    private sealed record Plan(
        string MatchName,
        string? RenameTo,
        string? RenameSlugTo,
        Axis[] Axes,
        Delta[] Deltas,
        /// <summary>Combination (values joined by " / ") that is deliberately sold out, to exercise the picker.</summary>
        string? SoldOutCombination = null,
        /// <summary>Combination carrying a promo price, to exercise the strike-through.</summary>
        string? DiscountedCombination = null,
        decimal DiscountAmount = 0m,
        /// <summary>
        /// Price of the cheapest combination. Given explicitly where the product's stored
        /// BasePrice is demo junk that would otherwise propagate into every variant.
        /// </summary>
        decimal? BasePriceOverride = null);

    private static readonly Plan[] Plans =
    {
        // Two axes, three colours: the headline case from the brief.
        new(
            MatchName: "iPhone 15 128GB",
            RenameTo: "iPhone 15",
            RenameSlugTo: "iphone-15",
            Axes: new[]
            {
                new Axis("Color", "Black", "Blue", "Pink"),
                new Axis("Storage", "128GB", "256GB"),
            },
            Deltas: new[]
            {
                new Delta("Storage", "256GB", 3_000_000m),
                new Delta("Color", "Pink", 500_000m),
            },
            SoldOutCombination: "Pink / 128GB",
            DiscountedCombination: "Black / 256GB",
            DiscountAmount: 1_500_000m),

        // Two axes that are not colour — the price driver is the spec itself.
        new(
            MatchName: "MacBook Air M3 13 inch",
            RenameTo: null,
            RenameSlugTo: null,
            Axes: new[]
            {
                new Axis("Memory", "8GB", "16GB"),
                new Axis("Storage", "256GB", "512GB"),
            },
            Deltas: new[]
            {
                new Delta("Memory", "16GB", 5_000_000m),
                new Delta("Storage", "512GB", 4_000_000m),
            },
            SoldOutCombination: "16GB / 512GB",
            // The seeded catalogue has this product at 10,000 VND, which would make every
            // variant read as a rounding error rather than a laptop.
            BasePriceOverride: 27_990_000m),

        new(
            MatchName: "iPad Air M2 11 inch 128GB",
            RenameTo: "iPad Air M2 11 inch",
            RenameSlugTo: "ipad-air-m2-11-inch",
            Axes: new[]
            {
                new Axis("Storage", "128GB", "256GB"),
                new Axis("Connectivity", "Wi-Fi", "Wi-Fi + 5G"),
            },
            Deltas: new[]
            {
                new Delta("Storage", "256GB", 3_500_000m),
                new Delta("Connectivity", "Wi-Fi + 5G", 4_500_000m),
            }),

        // Single axis, and every option the same price: variants are not only about price.
        new(
            MatchName: "Sony WH-1000XM5",
            RenameTo: null,
            RenameSlugTo: null,
            Axes: new[] { new Axis("Color", "Black", "Silver", "Midnight Blue") },
            Deltas: Array.Empty<Delta>(),
            SoldOutCombination: "Silver"),

        new(
            MatchName: "Samsung Galaxy Watch 6 44mm",
            RenameTo: "Samsung Galaxy Watch 6",
            RenameSlugTo: "samsung-galaxy-watch-6",
            Axes: new[]
            {
                new Axis("Size", "40mm", "44mm"),
                new Axis("Connectivity", "Bluetooth", "LTE"),
            },
            Deltas: new[]
            {
                new Delta("Size", "44mm", 800_000m),
                new Delta("Connectivity", "LTE", 1_500_000m),
            }),
    };

    public static async Task<IReadOnlyList<string>> SeedAsync(
        AidrDbContext db,
        string contentRootPath,
        CancellationToken ct = default)
    {
        // The columns below only exist once the variant schema has been applied.
        await SqlScriptSeeder.ExecuteFileAsync(
            db,
            contentRootPath,
            Path.Combine("scripts", "product-variants-schema.sql"),
            ct);

        var log = new List<string>();
        var now = DateTime.UtcNow;

        foreach (var plan in Plans)
        {
            // Also match the renamed form: the first run renames "iPhone 15 128GB" to
            // "iPhone 15", and a second run has to find that same product rather than
            // reporting it missing.
            var product = await db.Products
                .Include(p => p.Variants)
                .FirstOrDefaultAsync(
                    p => p.Name == plan.MatchName || (plan.RenameTo != null && p.Name == plan.RenameTo),
                    ct);

            if (product is null)
            {
                log.Add($"skip  {plan.MatchName} — not in this database");
                continue;
            }

            var created = await ApplyPlanAsync(db, product, plan, now, ct);
            log.Add($"ok    {product.Name} — {created} variant(s), stock {product.StockQuantity}, from {product.BasePrice:N0}");
        }

        await db.SaveChangesAsync(ct);
        return log;
    }

    private static async Task<int> ApplyPlanAsync(
        AidrDbContext db,
        Product product,
        Plan plan,
        DateTime now,
        CancellationToken ct)
    {
        // A name like "iPhone 15 128GB" contradicts a 128GB/256GB picker sitting under it.
        if (plan.RenameTo is not null)
            product.Name = plan.RenameTo;

        if (plan.RenameSlugTo is not null)
        {
            var slugTaken = await db.Products.AnyAsync(
                p => p.ShopId == product.ShopId
                     && p.Slug == plan.RenameSlugTo
                     && p.ProductId != product.ProductId,
                ct);

            if (!slugTaken)
                product.Slug = plan.RenameSlugTo;
        }

        product.VariantOptionsJson = ProductVariantJson.SerializeOptions(
            plan.Axes.Select(a => new ProductVariantJson.OptionAxis
            {
                Name = a.Name,
                Values = a.Values.ToList(),
            }));

        var combinations = Cartesian(plan.Axes);
        var basePrice = plan.BasePriceOverride ?? product.BasePrice;
        var index = 0;
        var seenIds = new List<Guid>();

        foreach (var combination in combinations)
        {
            var label = string.Join(" / ", plan.Axes.Select(a => combination[a.Name]));
            var variantId = DeriveVariantId(product.ProductId, label);
            seenIds.Add(variantId);

            var price = basePrice + plan.Deltas
                .Where(d => combination.TryGetValue(d.Axis, out var v) && v == d.Value)
                .Sum(d => d.Amount);

            decimal? salePrice = label == plan.DiscountedCombination
                ? price - plan.DiscountAmount
                : null;

            var variant = product.Variants.FirstOrDefault(v => v.VariantId == variantId);
            if (variant is null)
            {
                // Added through the navigation only. Adding to the DbSet as well would let
                // EF's relationship fixup append a second reference to this same list, and
                // every per-variant loop below would then run twice for the new rows.
                variant = new ProductVariant { VariantId = variantId, ProductId = product.ProductId, CreatedAt = now };
                product.Variants.Add(variant);
            }

            variant.VariantName = label;
            variant.AttributesJson = ProductVariantJson.SerializeAttributes(
                plan.Axes.ToDictionary(a => a.Name, a => combination[a.Name]));
            variant.Sku = BuildSku(product, label);
            variant.Price = price;
            variant.SalePrice = salePrice;
            variant.ImageUrl = null;
            variant.SortOrder = index;
            variant.IsActive = true;
            variant.UpdatedAt = now;

            index++;
        }

        // Rows left over from the older table-coverage seed used lower-case attribute keys and
        // matched no axis, so they can never be selected. Drop the ones this plan did not claim,
        // unless an order already references them.
        var orphans = product.Variants.Where(v => !seenIds.Contains(v.VariantId)).ToList();
        foreach (var orphan in orphans)
        {
            var referenced = await db.OrderItems.AnyAsync(i => i.VariantId == orphan.VariantId, ct);
            if (referenced)
            {
                orphan.IsActive = false;
                orphan.UpdatedAt = now;
                continue;
            }

            var cartLines = await db.CartItems.Where(i => i.VariantId == orphan.VariantId).ToListAsync(ct);
            db.CartItems.RemoveRange(cartLines);
            db.ProductVariants.Remove(orphan);
            product.Variants.Remove(orphan);
        }

        await AssignLotsAsync(db, product, plan, now, ct);

        // Save before recalculating: the recalculator reads the lots back, and the new ones
        // have to be visible to it as rows, not just as pending inserts.
        await db.SaveChangesAsync(ct);
        await InventoryStockRecalculator.RecalcAsync(db, product, ct);
        ProductVariantPricing.Apply(product, product.Variants.ToList(), now);

        return index;
    }

    /// <summary>
    /// Gives every variant its own stock. The product's existing lot is handed to the first
    /// variant rather than left behind — an unassigned lot is stock the checkout can never
    /// allocate, which would read as "in stock" everywhere and fail at the last step.
    /// </summary>
    private static async Task AssignLotsAsync(
        AidrDbContext db,
        Product product,
        Plan plan,
        DateTime now,
        CancellationToken ct)
    {
        var variants = product.Variants.OrderBy(v => v.SortOrder).ToList();
        if (variants.Count == 0)
            return;

        var unassigned = await db.InventoryLots
            .Where(l => l.ProductId == product.ProductId && l.VariantId == null)
            .OrderBy(l => l.ReceivedAt)
            .ToListAsync(ct);

        foreach (var lot in unassigned)
        {
            lot.VariantId = variants[0].VariantId;
        }

        var lotIndex = 0;
        foreach (var variant in variants)
        {
            var soldOut = variant.VariantName == plan.SoldOutCombination;

            var hasLot = unassigned.Any(l => l.VariantId == variant.VariantId)
                || await db.InventoryLots.AnyAsync(
                    l => l.ProductId == product.ProductId && l.VariantId == variant.VariantId, ct);

            if (hasLot)
            {
                lotIndex++;
                continue;
            }

            // Spread the quantities so the demo shows a healthy variant, a low one and a
            // sold-out one rather than a uniform wall of numbers.
            var received = soldOut ? 5 : 6 + (lotIndex * 4) % 15;
            var remaining = soldOut ? 0 : received;
            var unitCost = decimal.Round(variant.Price * 0.78m, 2, MidpointRounding.AwayFromZero);

            db.InventoryLots.Add(new InventoryLot
            {
                LotId = DeriveLotId(variant.VariantId),
                ProductId = product.ProductId,
                VariantId = variant.VariantId,
                LotCode = $"LOT-VAR-{variant.VariantId.ToString("N")[..8].ToUpperInvariant()}",
                QuantityReceived = received,
                QuantityRemaining = remaining,
                UnitCost = unitCost,
                Currency = "VND",
                SupplierName = "Variant demo seed",
                ReceivedAt = now.AddDays(-30 + lotIndex),
                Status = remaining == 0 ? "Depleted" : "Open",
                Note = "Seeded by ProductVariantsDemoSeeder",
                CreatedAt = now,
            });

            variant.LastCostPrice = unitCost;
            lotIndex++;
        }
    }

    private static List<Dictionary<string, string>> Cartesian(IReadOnlyList<Axis> axes) =>
        axes.Aggregate(
            new List<Dictionary<string, string>> { new() },
            (rows, axis) => rows
                .SelectMany(row => axis.Values.Select(value =>
                    new Dictionary<string, string>(row) { [axis.Name] = value }))
                .ToList());

    /// <summary>
    /// A deterministic id per (product, combination) so re-running updates rows instead of
    /// duplicating them, without needing a natural key on the table.
    /// </summary>
    private static Guid DeriveVariantId(Guid productId, string combination)
    {
        var bytes = System.Security.Cryptography.MD5.HashData(
            System.Text.Encoding.UTF8.GetBytes($"variant:{productId:D}:{combination}"));
        return new Guid(bytes);
    }

    private static Guid DeriveLotId(Guid variantId)
    {
        var bytes = System.Security.Cryptography.MD5.HashData(
            System.Text.Encoding.UTF8.GetBytes($"lot:{variantId:D}"));
        return new Guid(bytes);
    }

    private static string BuildSku(Product product, string combination)
    {
        var prefix = new string(product.Name
            .Where(char.IsLetterOrDigit)
            .Take(6)
            .ToArray())
            .ToUpperInvariant();

        var suffix = new string(combination
            .Where(char.IsLetterOrDigit)
            .ToArray())
            .ToUpperInvariant();

        var sku = $"{prefix}-{suffix}";
        return sku.Length > 64 ? sku[..64] : sku;
    }
}
