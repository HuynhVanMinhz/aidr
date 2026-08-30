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
    public const string AttachmentPreview = "Attachment";

    public const string HubUserGroupPrefix = "chat-user:";
    public const string HubReceiveMethod = "ReceiveMessage";
    public const string HubThreadReadMethod = "ThreadRead";
    public const string HubTypingMethod = "Typing";

    /// <summary>How long a typing signal stays valid before the receiver clears it.</summary>
    public const int TypingTimeoutSeconds = 6;

    /// <summary>
    /// Chat events are delivered per user (not per thread) so both participants stay in sync
    /// on every device, regardless of which conversation they currently have open.
    /// </summary>
    public static string UserGroupName(Guid userId) => $"{HubUserGroupPrefix}{userId:D}";

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
