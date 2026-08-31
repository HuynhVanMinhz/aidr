using AIDR.Infrastructure.Persistence.Entities;

namespace AIDR.Infrastructure.Persistence;

/// <summary>
/// Keeps <see cref="Product.BasePrice"/> / <see cref="Product.SalePrice"/> equal to the
/// cheapest way to buy the product once it is sold in variants, so the catalogue's price
/// sort, price filter and "from X" label keep working off the columns they already read.
///
/// Anything that writes variants has to apply the same rule — the seller form, an import,
/// a seeder — or the catalogue starts advertising a price no variant actually sells at.
/// </summary>
public static class ProductVariantPricing
{
    /// <summary>The only fields the rollup depends on, so callers holding write models can use it too.</summary>
    public readonly record struct VariantPrice(decimal Price, decimal? SalePrice, bool IsActive);

    public static void Apply(
        Product product,
        IReadOnlyCollection<VariantPrice> variants,
        DateTime now)
    {
        // With nothing on sale there is no cheapest variant to speak of, so the seller's own
        // prices stand rather than being overwritten with a placeholder.
        var active = variants.Where(v => v.IsActive).ToList();
        if (active.Count == 0)
            return;

        var cheapestList = active.Min(v => v.Price);
        var cheapestActual = active.Min(v => v.SalePrice ?? v.Price);

        product.BasePrice = cheapestList;
        product.SalePrice = cheapestActual < cheapestList ? cheapestActual : null;
        product.UpdatedAt = now;
    }

    public static void Apply(Product product, IReadOnlyCollection<ProductVariant> variants, DateTime now) =>
        Apply(
            product,
            variants.Select(v => new VariantPrice(v.Price, v.SalePrice, v.IsActive)).ToList(),
            now);
}
