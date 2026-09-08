using AIDR.Api.Extensions;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AIDR.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class ProductQuestionsController : ControllerBase
{
    private readonly IProductQaService _qa;

    public ProductQuestionsController(IProductQaService qa) => _qa = qa;

    /// <summary>List visible Q&amp;A for a product (newest questions first).</summary>
    [HttpGet("products/{productId:guid}/questions")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResult<ProductQuestionListResult>>> List(
        Guid productId,
        [FromQuery] ProductQuestionListQuery query,
        CancellationToken cancellationToken)
    {
        Guid? viewerId = User.TryGetUserId(out var userId) ? userId : null;
        var result = await _qa.ListAsync(productId, query, viewerId, cancellationToken);
        return Ok(ApiResult<ProductQuestionListResult>.Ok(result));
    }

    /// <summary>Ask a public question on a product detail page.</summary>
    [HttpPost("products/{productId:guid}/questions")]
    [Authorize(Policy = "Buyer")]
    public async Task<ActionResult<ApiResult<ProductQuestionDto>>> Ask(
        Guid productId,
        [FromBody] CreateProductQuestionRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _qa.AskAsync(User.GetUserId(), productId, request, cancellationToken);
        return Ok(ApiResult<ProductQuestionDto>.Ok(result, "Question posted."));
    }

    /// <summary>Answer a product question (shop owner or buyer who purchased).</summary>
    [HttpPost("questions/{questionId:guid}/answers")]
    [Authorize(Policy = "Buyer")]
    public async Task<ActionResult<ApiResult<ProductAnswerDto>>> Answer(
        Guid questionId,
        [FromBody] CreateProductAnswerRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _qa.AnswerAsync(User.GetUserId(), questionId, request, cancellationToken);
        return Ok(ApiResult<ProductAnswerDto>.Ok(result, "Answer posted."));
    }

    /// <summary>Hide a spam question (shop owner only).</summary>
    [HttpPost("questions/{questionId:guid}/hide")]
    [Authorize(Policy = "Seller")]
    public async Task<ActionResult<ApiResult<ProductQuestionDto>>> Hide(
        Guid questionId,
        CancellationToken cancellationToken)
    {
        var result = await _qa.HideAsync(User.GetUserId(), questionId, cancellationToken);
        return Ok(ApiResult<ProductQuestionDto>.Ok(result, "Question hidden."));
    }
}
