using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Engagement.Services;

public sealed class ProductQaService : IProductQaService
{
    private readonly IProductQaRepository _qa;

    public ProductQaService(IProductQaRepository qa) => _qa = qa;

    public async Task<ProductQuestionListResult> ListAsync(
        Guid productId,
        ProductQuestionListQuery query,
        Guid? viewerUserId,
        CancellationToken cancellationToken = default)
    {
        if (productId == Guid.Empty)
            throw new AppException("Product id is required.");

        if (!await _qa.ProductIsQaEnabledAsync(productId, cancellationToken))
            throw new NotFoundException("Product not found.");

        var (page, pageSize) = ProductQaConstants.NormalizePaging(query.Page, query.PageSize);
        return await _qa.ListVisibleAsync(productId, page, pageSize, viewerUserId, cancellationToken);
    }

    public async Task<ProductQuestionDto> AskAsync(
        Guid userId,
        Guid productId,
        CreateProductQuestionRequest request,
        CancellationToken cancellationToken = default)
    {
        if (productId == Guid.Empty)
            throw new AppException("Product id is required.");

        var content = request.Content?.Trim() ?? string.Empty;
        if (content.Length < ProductQaConstants.MinContentLength)
            throw new AppException($"Question must be at least {ProductQaConstants.MinContentLength} characters.");
        if (content.Length > ProductQaConstants.MaxQuestionLength)
            throw new AppException($"Question must not exceed {ProductQaConstants.MaxQuestionLength} characters.");

        return await _qa.CreateQuestionAsync(userId, productId, content, cancellationToken);
    }

    public async Task<ProductAnswerDto> AnswerAsync(
        Guid userId,
        Guid questionId,
        CreateProductAnswerRequest request,
        CancellationToken cancellationToken = default)
    {
        if (questionId == Guid.Empty)
            throw new AppException("Question id is required.");

        var content = request.Content?.Trim() ?? string.Empty;
        if (content.Length < ProductQaConstants.MinContentLength)
            throw new AppException($"Answer must be at least {ProductQaConstants.MinContentLength} characters.");
        if (content.Length > ProductQaConstants.MaxAnswerLength)
            throw new AppException($"Answer must not exceed {ProductQaConstants.MaxAnswerLength} characters.");

        return await _qa.CreateAnswerAsync(userId, questionId, content, cancellationToken);
    }

    public async Task<ProductQuestionDto> HideAsync(
        Guid userId,
        Guid questionId,
        CancellationToken cancellationToken = default)
    {
        if (questionId == Guid.Empty)
            throw new AppException("Question id is required.");

        return await _qa.HideQuestionAsync(userId, questionId, cancellationToken);
    }
}
