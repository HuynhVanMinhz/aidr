using System.Text.RegularExpressions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Exceptions;
using AIDR.Shared.Serialization;

namespace AIDR.Modules.SellerCenter.Services;

/// <summary>
/// Turns the variant editor's submission into what the repository stores, and reads it
/// back out again.
///
/// The seller declares the axes ("Color" -> Orange, White) and one row per combination.
/// Those two halves have to agree - a row for a colour that is not on the axis, or two
/// rows for the same combination, would leave the storefront unable to resolve a
/// selection to a price. Everything here exists to reject that before it is stored.
/// </summary>
internal static class SellerProductVariantNormalizer
{
    private static readonly Regex HttpUrlRegex = new(
        @"^https?:\/\/.+\..+",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    public sealed record NormalizedVariants(
        string? OptionsJson,
        IReadOnlyList<SellerProductVariantWriteModel>? Variants);

    /// <summary>
    /// Validates the pair and serialises it. Returns nulls when the caller left the
    /// variant editor alone, which the repository reads as "leave what is stored".
    /// </summary>
    public static NormalizedVariants Normalize(
        IReadOnlyList<SellerProductVariantOptionInput>? options,
        IReadOnlyList<SellerProductVariantInput>? variants)
    {
        var hasOptions = options is { Count: > 0 };
        var hasVariants = variants is { Count: > 0 };

        // Neither side supplied at all: the product is not using variants and the caller
        // did not ask to change that.
        if (options is null && variants is null)
            return new NormalizedVariants(null, null);

        // An explicit empty list on either side means "this product no longer has variants".
        if (!hasOptions && !hasVariants)
            return new NormalizedVariants(null, Array.Empty<SellerProductVariantWriteModel>());

        if (!hasOptions)
            throw new AppException("Variant options are required when variants are supplied.");

        if (!hasVariants)
            throw new AppException("At least one variant is required when variant options are supplied.");

        var axes = NormalizeOptions(options!);
        var rows = NormalizeRows(variants!, axes);

        var optionsJson = ProductVariantJson.SerializeOptions(
            axes.Select(a => new ProductVariantJson.OptionAxis
            {
                Name = a.Name,
                Values = a.Values.ToList()
            }));

        return new NormalizedVariants(optionsJson, rows);
    }

    /// <summary>Reads <c>Products.VariantOptionsJson</c> back out as the seller-facing DTO.</summary>
    public static IReadOnlyList<SellerProductVariantOptionDto> ParseOptions(string? optionsJson) =>
        ProductVariantJson.ParseOptions(optionsJson)
            .Select(o => new SellerProductVariantOptionDto { Name = o.Name, Values = o.Values })
            .ToList();

    public static IReadOnlyDictionary<string, string> ParseAttributes(string? attributesJson) =>
        ProductVariantJson.ParseAttributes(attributesJson);

    private static List<SellerProductVariantOptionDto> NormalizeOptions(
        IReadOnlyList<SellerProductVariantOptionInput> options)
    {
        if (options.Count > SellerProductConstants.MaxVariantOptions)
        {
            throw new AppException(
                $"A product may have at most {SellerProductConstants.MaxVariantOptions} variant options.");
        }

        var axes = new List<SellerProductVariantOptionDto>(options.Count);
        var seenNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var option in options)
        {
            var name = option.Name?.Trim();
            if (string.IsNullOrWhiteSpace(name))
                throw new AppException("Variant option name is required.");

            if (name.Length > SellerProductConstants.MaxVariantOptionNameLength)
            {
                throw new AppException(
                    $"Variant option name must not exceed {SellerProductConstants.MaxVariantOptionNameLength} characters.");
            }

            if (!seenNames.Add(name))
                throw new AppException($"Variant option '{name}' is listed twice.");

            var values = new List<string>();
            var seenValues = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var raw in option.Values ?? Array.Empty<string>())
            {
                var value = raw?.Trim();
                if (string.IsNullOrWhiteSpace(value))
                    throw new AppException($"Variant option '{name}' has an empty value.");

                if (value.Length > SellerProductConstants.MaxVariantOptionValueLength)
                {
                    throw new AppException(
                        $"Value '{value}' must not exceed {SellerProductConstants.MaxVariantOptionValueLength} characters.");
                }

                if (!seenValues.Add(value))
                    throw new AppException($"Variant option '{name}' lists '{value}' twice.");

                values.Add(value);
            }

            if (values.Count == 0)
                throw new AppException($"Variant option '{name}' needs at least one value.");

            if (values.Count > SellerProductConstants.MaxVariantOptionValues)
            {
                throw new AppException(
                    $"Variant option '{name}' may have at most {SellerProductConstants.MaxVariantOptionValues} values.");
            }

            axes.Add(new SellerProductVariantOptionDto { Name = name, Values = values });
        }

        return axes;
    }

    private static List<SellerProductVariantWriteModel> NormalizeRows(
        IReadOnlyList<SellerProductVariantInput> variants,
        IReadOnlyList<SellerProductVariantOptionDto> axes)
    {
        if (variants.Count > SellerProductConstants.MaxVariantsPerProduct)
        {
            throw new AppException(
                $"A product may have at most {SellerProductConstants.MaxVariantsPerProduct} variants.");
        }

        var rows = new List<SellerProductVariantWriteModel>(variants.Count);
        var seenCombinations = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seenSkus = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seenIds = new HashSet<Guid>();

        for (var index = 0; index < variants.Count; index++)
        {
            var input = variants[index];

            if (input.VariantId is { } id && !seenIds.Add(id))
                throw new AppException("The same variant was submitted twice.");

            // Read the value for each axis in the declared order, so both the derived name
            // and the uniqueness key are stable no matter how the client ordered the keys.
            var attributes = new Dictionary<string, string>(StringComparer.Ordinal);
            var values = new List<string>(axes.Count);

            foreach (var axis in axes)
            {
                var match = input.Attributes
                    .FirstOrDefault(kv => string.Equals(kv.Key?.Trim(), axis.Name, StringComparison.OrdinalIgnoreCase));

                var value = match.Value?.Trim();
                if (string.IsNullOrWhiteSpace(value))
                    throw new AppException($"Variant #{index + 1} is missing a value for '{axis.Name}'.");

                var canonical = axis.Values
                    .FirstOrDefault(v => string.Equals(v, value, StringComparison.OrdinalIgnoreCase));

                if (canonical is null)
                {
                    throw new AppException(
                        $"Variant #{index + 1} uses '{value}' for '{axis.Name}', which is not one of its values.");
                }

                attributes[axis.Name] = canonical;
                values.Add(canonical);
            }

            if (input.Attributes.Count > axes.Count)
            {
                var extra = input.Attributes.Keys
                    .FirstOrDefault(k => !axes.Any(a => string.Equals(a.Name, k?.Trim(), StringComparison.OrdinalIgnoreCase)));
                throw new AppException($"Variant #{index + 1} has an attribute '{extra}' that is not a declared option.");
            }

            var combination = string.Join(" | ", values);
            if (!seenCombinations.Add(combination))
                throw new AppException($"Two variants share the same configuration: {combination}.");

            var name = input.VariantName?.Trim();
            if (string.IsNullOrWhiteSpace(name))
                name = string.Join(" / ", values);

            if (name.Length > SellerProductConstants.MaxVariantNameLength)
            {
                throw new AppException(
                    $"Variant name must not exceed {SellerProductConstants.MaxVariantNameLength} characters.");
            }

            var sku = input.Sku?.Trim();
            if (string.IsNullOrWhiteSpace(sku))
            {
                sku = null;
            }
            else
            {
                if (sku.Length > SellerProductConstants.MaxVariantSkuLength)
                {
                    throw new AppException(
                        $"Variant SKU must not exceed {SellerProductConstants.MaxVariantSkuLength} characters.");
                }

                if (!seenSkus.Add(sku))
                    throw new AppException($"SKU '{sku}' is used by more than one variant.");
            }

            if (input.Price < 0)
                throw new AppException($"Price for '{name}' must be greater than or equal to 0.");

            decimal? salePrice = null;
            if (input.SalePrice is { } sale)
            {
                if (sale < 0)
                    throw new AppException($"Sale price for '{name}' must be greater than or equal to 0.");

                if (sale > input.Price)
                    throw new AppException($"Sale price for '{name}' cannot exceed its price.");

                salePrice = decimal.Round(sale, 2, MidpointRounding.AwayFromZero);
            }

            var imageUrl = input.ImageUrl?.Trim();
            if (string.IsNullOrWhiteSpace(imageUrl))
            {
                imageUrl = null;
            }
            else
            {
                if (imageUrl.Length > SellerProductConstants.MaxImageUrlLength)
                {
                    throw new AppException(
                        $"Variant image URL must not exceed {SellerProductConstants.MaxImageUrlLength} characters.");
                }

                if (!HttpUrlRegex.IsMatch(imageUrl))
                    throw new AppException("Variant image URL must be a valid http or https URL.");
            }

            rows.Add(new SellerProductVariantWriteModel
            {
                VariantId = input.VariantId,
                Sku = sku,
                VariantName = name,
                AttributesJson = ProductVariantJson.SerializeAttributes(attributes),
                Price = decimal.Round(input.Price, 2, MidpointRounding.AwayFromZero),
                SalePrice = salePrice,
                ImageUrl = imageUrl,
                // Fall back to submission order so the storefront has a stable sequence
                // even when the client does not bother setting SortOrder.
                SortOrder = input.SortOrder != 0 ? input.SortOrder : index,
                IsActive = input.IsActive
            });
        }

        if (!rows.Any(r => r.IsActive))
            throw new AppException("At least one variant must be active.");

        return rows;
    }
}
