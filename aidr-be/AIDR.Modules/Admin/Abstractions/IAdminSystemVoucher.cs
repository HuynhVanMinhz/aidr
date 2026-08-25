using AIDR.Shared.Dtos.Admin;

namespace AIDR.Modules.Admin.Abstractions;

public sealed class AdminSystemVoucherRecord
{
    public Guid VoucherId { get; init; }
    public string Code { get; init; } = null!;
    public string Name { get; init; } = null!;
    public string? Description { get; init; }
    public string Scope { get; init; } = null!;
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
    public string? CreatedByName { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public bool HasRedemptions { get; init; }
    public bool IsReferencedByOrders { get; init; }
}

public sealed class AdminSystemVoucherListSummary
{
    public int ActiveCount { get; init; }
    public int InactiveCount { get; init; }
    public int ExpiredCount { get; init; }
}

public interface IAdminSystemVoucherRepository
{
    Task<(IReadOnlyList<AdminSystemVoucherRecord> Items, int TotalCount, int EffectivePage, AdminSystemVoucherListSummary Summary)>
        ListPagedAsync(
            string? keyword,
            bool? isActive,
            int page,
            int pageSize,
            DateTime utcNow,
            CancellationToken cancellationToken = default);

    Task<AdminSystemVoucherRecord?> GetByIdAsync(
        Guid voucherId,
        CancellationToken cancellationToken = default);

    Task<bool> CodeExistsAsync(
        string code,
        Guid? excludeVoucherId = null,
        CancellationToken cancellationToken = default);

    Task<AdminSystemVoucherRecord> CreateAsync(
        string code,
        string name,
        string? description,
        string discountType,
        decimal discountValue,
        decimal? maxDiscountAmount,
        decimal minOrderAmount,
        int? usageLimit,
        int perUserLimit,
        DateTime startsAt,
        DateTime endsAt,
        bool isActive,
        Guid createdBy,
        CancellationToken cancellationToken = default);

    Task<AdminSystemVoucherRecord> UpdateAsync(
        Guid voucherId,
        string name,
        string? description,
        string discountType,
        decimal discountValue,
        decimal? maxDiscountAmount,
        decimal minOrderAmount,
        int? usageLimit,
        int perUserLimit,
        DateTime startsAt,
        DateTime endsAt,
        CancellationToken cancellationToken = default);

    Task<AdminSystemVoucherRecord> UpdateStatusAsync(
        Guid voucherId,
        bool isActive,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid voucherId, CancellationToken cancellationToken = default);
}

public interface IAdminSystemVoucherService
{
    Task<AdminSystemVoucherListResultDto> ListAsync(
        string? q,
        bool? isActive,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<AdminSystemVoucherDto> GetByIdAsync(
        Guid voucherId,
        CancellationToken cancellationToken = default);

    Task<AdminSystemVoucherDto> CreateAsync(
        Guid adminUserId,
        CreateSystemVoucherRequest request,
        CancellationToken cancellationToken = default);

    Task<AdminSystemVoucherDto> UpdateAsync(
        Guid voucherId,
        UpdateSystemVoucherRequest request,
        CancellationToken cancellationToken = default);

    Task<AdminSystemVoucherDto> UpdateStatusAsync(
        Guid voucherId,
        UpdateSystemVoucherStatusRequest request,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid voucherId, CancellationToken cancellationToken = default);
}
