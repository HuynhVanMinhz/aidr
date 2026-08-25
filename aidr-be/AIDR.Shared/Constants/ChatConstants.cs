namespace AIDR.Shared.Constants;

public static class ChatConstants
{
    public const string ActiveShopStatus = "Active";

    public const string RoleBuyer = "Buyer";
    public const string RoleSeller = "Seller";

    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;
    public const int DefaultMessagePageSize = 30;
    public const int MaxMessagePageSize = 100;

    public const int MaxContentLength = 2000;
    public const int MaxAttachmentUrlLength = 512;
    public const int LastMessagePreviewLength = 120;

    public const string HubThreadGroupPrefix = "thread:";
    public const string HubReceiveMethod = "ReceiveMessage";

    public static string ThreadGroupName(Guid threadId) => $"{HubThreadGroupPrefix}{threadId:D}";

    public static (int Page, int PageSize) NormalizeThreadPaging(int page, int pageSize)
    {
        var normalizedPage = page < 1 ? 1 : page;
        var normalizedSize = pageSize < 1
            ? DefaultPageSize
            : Math.Min(pageSize, MaxPageSize);
        return (normalizedPage, normalizedSize);
    }

    public static (int Page, int PageSize) NormalizeMessagePaging(int page, int pageSize)
    {
        var normalizedPage = page < 1 ? 1 : page;
        var normalizedSize = pageSize < 1
            ? DefaultMessagePageSize
            : Math.Min(pageSize, MaxMessagePageSize);
        return (normalizedPage, normalizedSize);
    }
}
