namespace AIDR.Shared.Constants;

public static class ReviewConstants
{
    public const int MinRating = 1;
    public const int MaxRating = 5;
    public const int MaxTitleLength = 150;
    public const int MaxContentLength = 2000;
    public const int MaxSellerCommentLength = 1000;

    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    /// <summary>Buyers may edit their review within this many days after creation.</summary>
    public const int EditWindowDays = 30;

    public static (int Page, int PageSize) NormalizePaging(int page, int pageSize)
    {
        var normalizedPage = page < 1 ? 1 : page;
        var normalizedSize = pageSize < 1
            ? DefaultPageSize
            : Math.Min(pageSize, MaxPageSize);
        return (normalizedPage, normalizedSize);
    }
}
