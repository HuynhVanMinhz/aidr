using AIDR.Shared.Dtos.Order;

namespace AIDR.Modules.Order.Abstractions;

public interface IReturnService
{
    Task<BuyerReturnRequestDto> CreateAsync(
        Guid buyerUserId,
        Guid orderId,
        CreateReturnRequest request,
        CancellationToken cancellationToken = default);

    Task<BuyerReturnRequestDto> GetByOrderAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default);

    Task<BuyerReturnListResultDto> ListForBuyerAsync(
        Guid buyerUserId,
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<BuyerReturnRequestDto> GetByIdForBuyerAsync(
        Guid buyerUserId,
        Guid returnRequestId,
        CancellationToken cancellationToken = default);
}

public interface IReturnRepository
{
    Task<BuyerReturnRequestDto> CreateAsync(
        Guid buyerUserId,
        Guid orderId,
        string reason,
        string? description,
        string resolutionType,
        IReadOnlyList<(Guid OrderItemId, int Quantity)> items,
        IReadOnlyList<(string EvidenceType, string MediaUrl, string? PublicId)> evidences,
        CancellationToken cancellationToken = default);

    Task<BuyerReturnRequestDto?> GetByOrderForBuyerAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<BuyerReturnRequestDto> Items, int TotalCount, int EffectivePage)> ListForBuyerAsync(
        Guid buyerUserId,
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<BuyerReturnRequestDto?> GetByIdForBuyerAsync(
        Guid buyerUserId,
        Guid returnRequestId,
        CancellationToken cancellationToken = default);
}
