namespace AIDR.Shared.Constants;

public static class ProductQaConstants
{
    public const string StatusVisible = "Visible";
    public const string StatusHidden = "Hidden";

    public const int MinContentLength = 5;
    public const int MaxQuestionLength = 1000;
    public const int MaxAnswerLength = 2000;

    public const int DefaultPageSize = 10;
    public const int MaxPageSize = 50;

    public static readonly HashSet<string> AllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        StatusVisible,
        StatusHidden
    };

    public static (int Page, int PageSize) NormalizePaging(int page, int pageSize)
    {
        var normalizedPage = page < 1 ? 1 : page;
        var normalizedSize = pageSize < 1
            ? DefaultPageSize
            : Math.Min(pageSize, MaxPageSize);
        return (normalizedPage, normalizedSize);
    }
}
