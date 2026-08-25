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
}

public interface IReturnRepository
{
    Task<BuyerReturnRequestDto> CreateAsync(
        Guid buyerUserId,
        Guid orderId,
        string reason,
        string? description,
        IReadOnlyList<(Guid OrderItemId, int Quantity)> items,
        IReadOnlyList<(string EvidenceType, string MediaUrl, string? PublicId)> evidences,
        CancellationToken cancellationToken = default);

    Task<BuyerReturnRequestDto?> GetByOrderForBuyerAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default);
}
