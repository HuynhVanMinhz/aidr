using AIDR.Shared.Dtos.Engagement;

namespace AIDR.Modules.Engagement.Abstractions;

public interface IProductQaRepository
{
    Task<bool> ProductIsQaEnabledAsync(Guid productId, CancellationToken cancellationToken = default);

    Task<ProductQuestionListResult> ListVisibleAsync(
        Guid productId,
        int page,
        int pageSize,
        Guid? viewerUserId,
        CancellationToken cancellationToken = default);

    Task<ProductQuestionDto> CreateQuestionAsync(
        Guid userId,
        Guid productId,
        string content,
        CancellationToken cancellationToken = default);

    Task<ProductAnswerDto> CreateAnswerAsync(
        Guid userId,
        Guid questionId,
        string content,
        CancellationToken cancellationToken = default);

    Task<ProductQuestionDto> HideQuestionAsync(
        Guid shopOwnerUserId,
        Guid questionId,
        CancellationToken cancellationToken = default);

    Task<bool> HasCompletedPurchaseAsync(
        Guid userId,
        Guid productId,
        CancellationToken cancellationToken = default);
}

public interface IProductQaService
{
    Task<ProductQuestionListResult> ListAsync(
        Guid productId,
        ProductQuestionListQuery query,
        Guid? viewerUserId,
        CancellationToken cancellationToken = default);

    Task<ProductQuestionDto> AskAsync(
        Guid userId,
        Guid productId,
        CreateProductQuestionRequest request,
        CancellationToken cancellationToken = default);

    Task<ProductAnswerDto> AnswerAsync(
        Guid userId,
        Guid questionId,
        CreateProductAnswerRequest request,
        CancellationToken cancellationToken = default);

    Task<ProductQuestionDto> HideAsync(
        Guid userId,
        Guid questionId,
        CancellationToken cancellationToken = default);
}
