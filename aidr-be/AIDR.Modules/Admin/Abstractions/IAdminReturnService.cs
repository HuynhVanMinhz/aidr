using AIDR.Shared.Dtos.Admin;

namespace AIDR.Modules.Admin.Abstractions;

public sealed class AdminReturnRequestListSummary
{
    public int PendingCount { get; init; }
    public int ApprovedCount { get; init; }
    public int RejectedCount { get; init; }
    public int SellerConfirmedCount { get; init; }
    public int ReceivingCount { get; init; }
    public int AcceptedCount { get; init; }
    public int RefundedCount { get; init; }
    public int ExchangedCount { get; init; }
    public int ClosedCount { get; init; }
}

public sealed class AdminReturnListRecord
{
    public Guid ReturnRequestId { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
    public Guid ShopId { get; init; }
    public string ShopName { get; init; } = null!;
    public Guid BuyerUserId { get; init; }
    public string BuyerEmail { get; init; } = null!;
    public string BuyerFullName { get; init; } = null!;
    public string Reason { get; init; } = null!;
    public string Status { get; init; } = null!;
    public string ResolutionType { get; init; } = null!;
    public decimal? RefundAmount { get; init; }
    public decimal OrderTotalAmount { get; init; }
    public int EvidenceCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public interface IAdminReturnService
{
    Task<AdminReturnRequestListResultDto> ListAsync(
        string? status,
        string? q,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<AdminReturnRequestDetailDto> GetByIdAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken = default);

    Task<AdminReturnRequestDetailDto> ApproveAsync(
        Guid returnRequestId,
        Guid adminUserId,
        CancellationToken cancellationToken = default);

    Task<AdminReturnRequestDetailDto> RejectAsync(
        Guid returnRequestId,
        Guid adminUserId,
        RejectReturnRequestRequest request,
        CancellationToken cancellationToken = default);

    Task<AdminReturnRequestDetailDto> UpdateStatusAsync(
        Guid returnRequestId,
        Guid adminUserId,
        UpdateReturnStatusRequest request,
        CancellationToken cancellationToken = default);
}

public interface IAdminReturnRepository
{
    Task<(IReadOnlyList<AdminReturnListRecord> Items, int TotalCount, int Page, AdminReturnRequestListSummary Summary)>
        ListPagedAsync(
            string? status,
            string? keyword,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default);

    Task<AdminReturnRequestDetailDto?> GetDetailAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken = default);

    Task<AdminReturnRequestDetailDto> ApproveAsync(
        Guid returnRequestId,
        Guid adminUserId,
        CancellationToken cancellationToken = default);

    Task<AdminReturnRequestDetailDto> RejectAsync(
        Guid returnRequestId,
        Guid adminUserId,
        string adminNote,
        CancellationToken cancellationToken = default);

    Task<AdminReturnRequestDetailDto> UpdateStatusAsync(
        Guid returnRequestId,
        Guid adminUserId,
        string toStatus,
        string? note,
        string? refundToBin,
        string? refundToAccountNumber,
        string? refundTransferProofUrl,
        CancellationToken cancellationToken = default);
}
