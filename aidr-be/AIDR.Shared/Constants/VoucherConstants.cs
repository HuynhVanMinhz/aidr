namespace AIDR.Shared.Constants;

public static class VoucherConstants
{
    public const string ScopeSystem = "System";
    public const string ScopeShop = "Shop";

    public const string DiscountTypePercent = "Percent";
    public const string DiscountTypeFixedAmount = "FixedAmount";

    public const int MaxCodeLength = 40;
    public const int DefaultListPage = 1;
    public const int DefaultListPageSize = 20;
    public const int MaxListPageSize = 100;

    public static readonly HashSet<string> Scopes = new(StringComparer.OrdinalIgnoreCase)
    {
        ScopeSystem,
        ScopeShop
    };

    public static readonly HashSet<string> DiscountTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        DiscountTypePercent,
        DiscountTypeFixedAmount
    };

    public static (int Page, int PageSize) NormalizePaging(int page, int pageSize)
    {
        var normalizedPage = page < 1 ? DefaultListPage : page;
        var normalizedSize = pageSize < 1
            ? DefaultListPageSize
            : Math.Min(pageSize, MaxListPageSize);
        return (normalizedPage, normalizedSize);
    }

    public static decimal CalculateDiscountAmount(
        string discountType,
        decimal discountValue,
        decimal? maxDiscountAmount,
        decimal subtotalAmount)
    {
        if (subtotalAmount <= 0)
            return 0m;

        decimal discount;
        if (string.Equals(discountType, DiscountTypePercent, StringComparison.OrdinalIgnoreCase))
        {
            discount = decimal.Round(
                subtotalAmount * discountValue / 100m,
                2,
                MidpointRounding.AwayFromZero);

            if (maxDiscountAmount is > 0)
                discount = Math.Min(discount, maxDiscountAmount.Value);
        }
        else
        {
            discount = decimal.Round(discountValue, 2, MidpointRounding.AwayFromZero);
        }

        discount = Math.Min(discount, subtotalAmount);
        if (discount < 0)
            discount = 0m;

        return decimal.Round(discount, 2, MidpointRounding.AwayFromZero);
    }
}
