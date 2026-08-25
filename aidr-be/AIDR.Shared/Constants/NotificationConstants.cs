namespace AIDR.Shared.Constants;

public static class NotificationConstants
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public const int MaxTitleLength = 200;
    public const int MaxBodyLength = 1000;
    public const int MaxTypeLength = 40;
    public const int MaxReferenceTypeLength = 40;

    public const string TypeOrder = "Order";
    public const string TypePayment = "Payment";
    public const string TypeModeration = "Moderation";
    public const string TypeReturn = "Return";
    public const string TypeChat = "Chat";
    public const string TypeSystem = "System";
    public const string TypePromo = "Promo";

    public const string RefOrder = "Order";
    public const string RefPayment = "Payment";
    public const string RefProduct = "Product";
    public const string RefReturnRequest = "ReturnRequest";
    public const string RefChatThread = "ChatThread";

    public const string HubUserGroupPrefix = "user:";
    public const string HubReceiveMethod = "ReceiveNotification";

    public static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        TypeOrder,
        TypePayment,
        TypeModeration,
        TypeReturn,
        TypeChat,
        TypeSystem,
        TypePromo
    };

    public static string UserGroupName(Guid userId) => $"{HubUserGroupPrefix}{userId:D}";

    public static (int Page, int PageSize) NormalizePaging(int page, int pageSize)
    {
        var normalizedPage = page < 1 ? 1 : page;
        var normalizedSize = pageSize < 1
            ? DefaultPageSize
            : Math.Min(pageSize, MaxPageSize);
        return (normalizedPage, normalizedSize);
    }

    public static string CanonicalType(string type) =>
        AllowedTypes.First(t => string.Equals(t, type, StringComparison.OrdinalIgnoreCase));
}
