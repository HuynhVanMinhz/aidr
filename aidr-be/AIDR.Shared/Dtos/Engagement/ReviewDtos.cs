namespace AIDR.Shared.Dtos.Engagement;

public sealed class ProductReviewListQuery
{
    public int? Rating { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public sealed class CreateProductReviewRequest
{
    public Guid OrderId { get; set; }
    public byte Rating { get; set; }
    public string? Title { get; set; }
    public string Content { get; set; } = null!;
}

public sealed class UpdateProductReviewRequest
{
    public byte Rating { get; set; }
    public string? Title { get; set; }
    public string Content { get; set; } = null!;
}

public sealed class ProductReviewDto
{
    public Guid ReviewId { get; init; }
    public Guid ProductId { get; init; }
    public Guid BuyerUserId { get; init; }
    public Guid? OrderId { get; init; }
    public byte Rating { get; init; }
    public string? Title { get; init; }
    public string? Content { get; init; }
    public string? SentimentLabel { get; init; }
    public decimal? SentimentScore { get; init; }
    public string BuyerName { get; init; } = null!;
    public string? BuyerAvatarUrl { get; init; }
    public bool IsVisible { get; init; }
    public bool IsOwn { get; init; }
    public bool CanEdit { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public sealed class ProductReviewListResult
{
    public Guid ProductId { get; init; }
    public decimal AvgRating { get; init; }
    public int ReviewCount { get; init; }
    public IReadOnlyList<ProductReviewDto> Items { get; init; } = Array.Empty<ProductReviewDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public sealed class CreateSellerRatingRequest
{
    public Guid ShopId { get; set; }
    public Guid OrderId { get; set; }
    public byte Score { get; set; }
    public string? Comment { get; set; }
}

public sealed class SellerRatingDto
{
    public Guid SellerRatingId { get; init; }
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public string ShopSlug { get; init; } = null!;
    public Guid BuyerUserId { get; init; }
    public Guid? OrderId { get; init; }
    public byte Score { get; init; }
    public string? Comment { get; init; }
    public decimal ShopAvgRating { get; init; }
    public int ShopRatingCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}
