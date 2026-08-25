namespace AIDR.Shared.Dtos.Engagement;

public sealed class FollowShopRequest
{
    public Guid ShopId { get; set; }
}

public sealed class FollowedShopDto
{
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? Tagline { get; init; }
    public string? ShortDescription { get; init; }
    public string? LogoUrl { get; init; }
    public string? BannerUrl { get; init; }
    public bool IsVerified { get; init; }
    public decimal AvgRating { get; init; }
    public int RatingCount { get; init; }
    public int FollowerCount { get; init; }
    public int ProductCount { get; init; }
    public DateTime FollowedAt { get; init; }
}

public sealed class UnfollowShopResponse
{
    public Guid ShopId { get; init; }
}
