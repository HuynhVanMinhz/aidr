namespace AIDR.Shared.Dtos.Seller;

public sealed class SellerShopVoucherDto
{
    public Guid VoucherId { get; init; }
    public string Code { get; init; } = null!;
    public string Name { get; init; } = null!;
    public string? Description { get; init; }
    public string Scope { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string? ShopName { get; init; }
    public string DiscountType { get; init; } = null!;
    public decimal DiscountValue { get; init; }
    public decimal? MaxDiscountAmount { get; init; }
    public decimal MinOrderAmount { get; init; }
    public int? UsageLimit { get; init; }
    public int PerUserLimit { get; init; }
    public int UsedCount { get; init; }
    public DateTime StartsAt { get; init; }
    public DateTime EndsAt { get; init; }
    public bool IsActive { get; init; }
    public Guid CreatedBy { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public bool CanDelete { get; init; }
}

public sealed class SellerShopVoucherListResultDto
{
    public IReadOnlyList<SellerShopVoucherDto> Items { get; init; } =
        Array.Empty<SellerShopVoucherDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
    public int ActiveCount { get; init; }
    public int InactiveCount { get; init; }
    public int ExpiredCount { get; init; }
}

public sealed class CreateShopVoucherRequest
{
    public string Code { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string DiscountType { get; set; } = null!;
    public decimal DiscountValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public decimal MinOrderAmount { get; set; }
    public int? UsageLimit { get; set; }
    public int PerUserLimit { get; set; } = 1;
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class UpdateShopVoucherRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string DiscountType { get; set; } = null!;
    public decimal DiscountValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public decimal MinOrderAmount { get; set; }
    public int? UsageLimit { get; set; }
    public int PerUserLimit { get; set; } = 1;
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
}

public sealed class UpdateShopVoucherStatusRequest
{
    public bool IsActive { get; set; }
}
