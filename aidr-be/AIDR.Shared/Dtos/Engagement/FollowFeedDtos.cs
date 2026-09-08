using AIDR.Shared.Dtos.Discovery;

namespace AIDR.Shared.Dtos.Engagement;

public sealed class FollowFeedItemDto
{
    public string ItemType { get; init; } = null!;
    public DateTime CreatedAt { get; init; }
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string ShopSlug { get; init; } = null!;
    public ProductListItemDto? Product { get; init; }
    public FollowFeedVoucherDto? Voucher { get; init; }
}

public sealed class FollowFeedVoucherDto
{
    public Guid VoucherId { get; init; }
    public string Code { get; init; } = null!;
    public string Name { get; init; } = null!;
    public string? Description { get; init; }
    public string DiscountType { get; init; } = null!;
    public decimal DiscountValue { get; init; }
    public decimal? MaxDiscountAmount { get; init; }
    public decimal MinOrderAmount { get; init; }
    public DateTime StartsAt { get; init; }
    public DateTime EndsAt { get; init; }
}

public sealed class FollowFeedResultDto
{
    public IReadOnlyList<FollowFeedItemDto> Items { get; init; } = Array.Empty<FollowFeedItemDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}
