using AIDR.Shared.Dtos.SellerCenter;

namespace AIDR.Modules.SellerCenter.Abstractions;

public sealed class SellerReturnListSummary
{
    public int ApprovedCount { get; init; }
    public int SellerConfirmedCount { get; init; }
    public int ReceivingCount { get; init; }
    public int AcceptedCount { get; init; }
}

public sealed class SellerReturnListRecord
{
    public Guid ReturnRequestId { get; init; }
    public Guid OrderId { get; init; }
    public string OrderCode { get; init; } = null!;
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

public interface ISellerReturnService
{
    Task<SellerReturnListResultDto> ListAsync(
        Guid sellerUserId,
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<SellerReturnDetailDto> GetByIdAsync(
        Guid sellerUserId,
        Guid returnRequestId,
        CancellationToken cancellationToken = default);

    Task<SellerReturnDetailDto> ConfirmAsync(
        Guid sellerUserId,
        Guid returnRequestId,
        ConfirmSellerReturnRequest request,
        CancellationToken cancellationToken = default);

    Task<SellerReturnDetailDto> MarkReceivingAsync(
        Guid sellerUserId,
        Guid returnRequestId,
        SellerReturnActionRequest? request,
        CancellationToken cancellationToken = default);

    Task<SellerReturnDetailDto> AcceptGoodsAsync(
        Guid sellerUserId,
        Guid returnRequestId,
        SellerReturnActionRequest? request,
        CancellationToken cancellationToken = default);

    Task<SellerReturnDetailDto> RejectAsync(
        Guid sellerUserId,
        Guid returnRequestId,
        RejectSellerReturnRequest request,
        CancellationToken cancellationToken = default);
}

public interface ISellerReturnRepository
{
    Task<(IReadOnlyList<SellerReturnListRecord> Items, int TotalCount, int Page, SellerReturnListSummary Summary)>
        ListPagedForShopAsync(
            Guid shopId,
            string? status,
            int page,
            int pageSize,
            CancellationToken cancellationToken = default);

    Task<SellerReturnDetailDto?> GetDetailForShopAsync(
        Guid shopId,
        Guid returnRequestId,
        CancellationToken cancellationToken = default);

    Task<SellerReturnDetailDto> ConfirmAsync(
        Guid shopId,
        Guid returnRequestId,
        Guid sellerUserId,
        string resolutionType,
        string? note,
        CancellationToken cancellationToken = default);

    Task<SellerReturnDetailDto> AdvanceAsync(
        Guid shopId,
        Guid returnRequestId,
        Guid sellerUserId,
        string toStatus,
        string? note,
        CancellationToken cancellationToken = default);

    Task<SellerReturnDetailDto> RejectAsync(
        Guid shopId,
        Guid returnRequestId,
        Guid sellerUserId,
        string note,
        CancellationToken cancellationToken = default);

    Task<Guid?> GetShopOwnerUserIdAsync(Guid shopId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> ListAdminUserIdsAsync(CancellationToken cancellationToken = default);
}
