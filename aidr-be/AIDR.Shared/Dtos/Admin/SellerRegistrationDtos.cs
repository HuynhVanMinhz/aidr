namespace AIDR.Shared.Dtos.Admin;

public sealed class AdminSellerRegistrationDto
{
    public Guid RequestId { get; init; }
    public Guid UserId { get; init; }
    public string UserEmail { get; init; } = null!;
    public string UserFullName { get; init; } = null!;
    public string ShopName { get; init; } = null!;
    public string? BusinessInfo { get; init; }
    public IReadOnlyList<string> DocumentUrls { get; init; } = Array.Empty<string>();
    public string Status { get; init; } = null!;
    public string? AdminNote { get; init; }
    public Guid? ReviewedBy { get; init; }
    public string? ReviewerFullName { get; init; }
    public DateTime? ReviewedAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public Guid? ShopId { get; init; }
}

public sealed class AdminSellerRegistrationListResultDto
{
    public IReadOnlyList<AdminSellerRegistrationDto> Items { get; init; } =
        Array.Empty<AdminSellerRegistrationDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
    public int PendingCount { get; init; }
    public int ApprovedCount { get; init; }
    public int RejectedCount { get; init; }
}

public sealed class RejectSellerRegistrationRequest
{
    public string AdminNote { get; set; } = null!;
}

public sealed class ApproveSellerRegistrationResultDto
{
    public AdminSellerRegistrationDto Request { get; init; } = null!;
    public Guid ShopId { get; init; }
    public Guid WalletId { get; init; }
}
