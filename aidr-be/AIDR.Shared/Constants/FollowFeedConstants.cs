namespace AIDR.Shared.Constants;

public static class FollowFeedConstants
{
    public const string ItemTypeProduct = "Product";
    public const string ItemTypeVoucher = "Voucher";

    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 50;

    public static (int Page, int PageSize) NormalizePaging(int page, int pageSize)
    {
        var normalizedPage = page < 1 ? 1 : page;
        var normalizedSize = pageSize < 1
            ? DefaultPageSize
            : Math.Min(pageSize, MaxPageSize);
        return (normalizedPage, normalizedSize);
    }
}
