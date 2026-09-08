namespace AIDR.Modules.Engagement.Services;

public sealed class ReviewDigestOptions
{
    public const string SectionName = "ReviewDigest";

    public int MinReviews { get; set; } = 5;
    public int MaxReviewsInPrompt { get; set; } = 50;
    public int CacheTtlMinutes { get; set; } = 60;
    public bool RegenerateOnInvalidate { get; set; } = true;
}
