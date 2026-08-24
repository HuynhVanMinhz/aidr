namespace AIDR.Shared.Dtos.Admin;

public sealed class AdminCategoryDto
{
    public int CategoryId { get; init; }
    public int? ParentId { get; init; }
    public string? ParentName { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string Description { get; init; } = null!;
    public string ImageUrl { get; init; } = null!;
    public int SortOrder { get; init; }
    public bool IsActive { get; init; }
    public int ProductCount { get; init; }
    public int ChildCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public sealed class AdminCategoryOptionDto
{
    public int CategoryId { get; init; }
    public int? ParentId { get; init; }
    public string Name { get; init; } = null!;
    public int SortOrder { get; init; }
}

public sealed class AdminCategoryListResultDto
{
    public IReadOnlyList<AdminCategoryDto> Items { get; init; } = Array.Empty<AdminCategoryDto>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
    public int ActiveCount { get; init; }
    public int InactiveCount { get; init; }
    public int WithProductsCount { get; init; }
}

public sealed class CreateCategoryRequest
{
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string Description { get; set; } = null!;
    public string ImageUrl { get; set; } = null!;
    public int? ParentId { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class UpdateCategoryRequest
{
    public string Name { get; set; } = null!;
    public string Description { get; set; } = null!;
    public string ImageUrl { get; set; } = null!;
    public int SortOrder { get; set; }
    public int? ParentId { get; set; }
}

public sealed class UpdateCategoryStatusRequest
{
    public bool IsActive { get; set; }
}
