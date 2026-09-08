namespace AIDR.Shared.Dtos.Engagement;

public sealed class ProductQuestionListQuery
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}

public sealed class CreateProductQuestionRequest
{
    public string Content { get; set; } = null!;
}

public sealed class CreateProductAnswerRequest
{
    public string Content { get; set; } = null!;
}

public sealed class ProductAnswerDto
{
    public Guid AnswerId { get; init; }
    public Guid QuestionId { get; init; }
    public Guid UserId { get; init; }
    public string UserName { get; init; } = null!;
    public string? UserAvatarUrl { get; init; }
    public string Content { get; init; } = null!;
    public bool IsOfficial { get; init; }
    public bool IsOwn { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class ProductQuestionDto
{
    public Guid QuestionId { get; init; }
    public Guid ProductId { get; init; }
    public Guid UserId { get; init; }
    public string UserName { get; init; } = null!;
    public string? UserAvatarUrl { get; init; }
    public string Content { get; init; } = null!;
    public string Status { get; init; } = null!;
    public bool IsOwn { get; init; }
    public bool CanHide { get; init; }
    public DateTime CreatedAt { get; init; }
    public IReadOnlyList<ProductAnswerDto> Answers { get; init; } = Array.Empty<ProductAnswerDto>();
}

public sealed class ProductQuestionListResult
{
    public Guid ProductId { get; init; }
    public IReadOnlyList<ProductQuestionDto> Items { get; init; } = Array.Empty<ProductQuestionDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}
