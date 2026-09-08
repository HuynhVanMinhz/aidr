namespace AIDR.Modules.Engagement.Services;

public sealed class PriceAlertOptions
{
    public const string SectionName = "PriceAlerts";

    public bool EnableBackgroundJob { get; set; } = true;
    public int JobIntervalMinutes { get; set; } = 15;
    public int CacheTtlMinutes { get; set; } = 15;
}

public sealed class BuyerProtectionOptions
{
    public const string SectionName = "BuyerProtection";

    public int ReturnWindowDaysAfterCompleted { get; set; } = 7;
    public bool ShowEscrowNote { get; set; } = true;
}
