namespace AIDR.Shared.Dtos.Seller;

public sealed class SellerProductQueryRequest
{
    /// <summary>Filter by status; omit or "all" for every non-deleted product. Use "Deleted" to list soft-deleted.</summary>
    public string? Status { get; set; }
    public string? Q { get; set; }
    public int? CategoryId { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public sealed class SellerProductImageDto
{
    public Guid ProductImageId { get; init; }
    public string ImageUrl { get; init; } = null!;
    public string? PublicId { get; init; }
    public int SortOrder { get; init; }
    public bool IsPrimary { get; init; }
}

/// <summary>
/// One axis a buyer picks along, e.g. <c>Color -> [Orange, White]</c>. The order of
/// the axes and of their values is the order the storefront renders them in.
/// </summary>
public sealed class SellerProductVariantOptionDto
{
    public string Name { get; init; } = null!;
    public IReadOnlyList<string> Values { get; init; } = Array.Empty<string>();
}

public sealed class SellerProductVariantDto
{
    public Guid VariantId { get; init; }
    public string? Sku { get; init; }
    public string VariantName { get; init; } = null!;
    /// <summary>The chosen value per axis, e.g. <c>{"Color":"Orange","Storage":"128GB"}</c>.</summary>
    public IReadOnlyDictionary<string, string> Attributes { get; init; } =
        new Dictionary<string, string>();
    public decimal Price { get; init; }
    public decimal? SalePrice { get; init; }
    public decimal EffectivePrice { get; init; }
    /// <summary>Summed from this variant's inventory lots — not settable on the product form.</summary>
    public int StockQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public int AvailableQuantity { get; init; }
    public string? ImageUrl { get; init; }
    public int SortOrder { get; init; }
    public bool IsActive { get; init; }
}

public sealed class SellerProductVariantOptionInput
{
    public string Name { get; set; } = null!;
    public IReadOnlyList<string> Values { get; set; } = Array.Empty<string>();
}

public sealed class SellerProductVariantInput
{
    /// <summary>Omit for a new row; supply to update the existing variant in place.</summary>
    public Guid? VariantId { get; set; }
    public string? Sku { get; set; }
    /// <summary>Derived from the attribute values when left blank.</summary>
    public string? VariantName { get; set; }
    public Dictionary<string, string> Attributes { get; set; } = new();
    public decimal Price { get; set; }
    public decimal? SalePrice { get; set; }
    public string? ImageUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class SellerProductListItemDto
{
    public Guid ProductId { get; init; }
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? ShortDescription { get; init; }
    public string? Brand { get; init; }
    public string ConditionType { get; init; } = null!;
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public decimal EffectivePrice { get; init; }
    /// <summary>Dearest active variant; equals <see cref="EffectivePrice"/> when there are none.</summary>
    public decimal MaxEffectivePrice { get; init; }
    public string Currency { get; init; } = "VND";
    public int StockQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public int VariantCount { get; init; }
    public string Status { get; init; } = null!;
    public string? PrimaryImageUrl { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = null!;
    public Guid ShopId { get; init; }
    public DateTime? PublishedAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}

public sealed class SellerProductDetailDto
{
    public Guid ProductId { get; init; }
    public Guid ShopId { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = null!;
    public string Name { get; init; } = null!;
    public string Slug { get; init; } = null!;
    public string? ShortDescription { get; init; }
    public string? Description { get; init; }
    public string? Brand { get; init; }
    public string? ModelNumber { get; init; }
    public string ConditionType { get; init; } = null!;
    public decimal BasePrice { get; init; }
    public decimal? SalePrice { get; init; }
    public decimal EffectivePrice { get; init; }
    public string Currency { get; init; } = "VND";
    public int StockQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public int? WarrantyMonths { get; init; }
    public string? OriginCountry { get; init; }
    public string? TagsJson { get; init; }
    public string? SpecsJson { get; init; }
    public bool IsFeatured { get; init; }
    public string Status { get; init; } = null!;
    public DateTime? PublishedAt { get; init; }
    public decimal AvgRating { get; init; }
    public int ReviewCount { get; init; }
    public int SoldCount { get; init; }
    public int ViewCount { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public IReadOnlyList<SellerProductImageDto> Images { get; init; } = Array.Empty<SellerProductImageDto>();
    public IReadOnlyList<SellerProductVariantOptionDto> VariantOptions { get; init; } =
        Array.Empty<SellerProductVariantOptionDto>();
    /// <summary>Empty when the product is sold as a single configuration.</summary>
    public IReadOnlyList<SellerProductVariantDto> Variants { get; init; } =
        Array.Empty<SellerProductVariantDto>();
}

public sealed class SellerProductImageInput
{
    public string ImageUrl { get; set; } = null!;
    public string? PublicId { get; set; }
    public int SortOrder { get; set; }
    public bool IsPrimary { get; set; }
}

public sealed class CreateSellerProductRequest
{
    public int CategoryId { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string? ShortDescription { get; set; }
    public string? Description { get; set; }
    public string? Brand { get; set; }
    public string? ModelNumber { get; set; }
    public string ConditionType { get; set; } = "New";
    public decimal BasePrice { get; set; }
    public decimal? SalePrice { get; set; }
    public int? WarrantyMonths { get; set; }
    public string? OriginCountry { get; set; }
    public string? TagsJson { get; set; }
    public string? SpecsJson { get; set; }
    public IReadOnlyList<SellerProductImageInput>? Images { get; set; }
    /// <summary>
    /// Supply together with <see cref="Variants"/> to sell this product in several
    /// configurations. Leave both empty for a single-price product — BasePrice then
    /// stands on its own; otherwise it is recomputed as the cheapest variant.
    /// </summary>
    public IReadOnlyList<SellerProductVariantOptionInput>? VariantOptions { get; set; }
    public IReadOnlyList<SellerProductVariantInput>? Variants { get; set; }
}

public sealed class UpdateSellerProductRequest
{
    public int CategoryId { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string? ShortDescription { get; set; }
    public string? Description { get; set; }
    public string? Brand { get; set; }
    public string? ModelNumber { get; set; }
    public string ConditionType { get; set; } = "New";
    public decimal BasePrice { get; set; }
    public decimal? SalePrice { get; set; }
    public int? WarrantyMonths { get; set; }
    public string? OriginCountry { get; set; }
    public string? TagsJson { get; set; }
    public string? SpecsJson { get; set; }
    /// <summary>
    /// Null leaves the current variants untouched. An empty list removes them,
    /// which is refused while any of them still holds stock or sits in a cart.
    /// </summary>
    public IReadOnlyList<SellerProductVariantOptionInput>? VariantOptions { get; set; }
    public IReadOnlyList<SellerProductVariantInput>? Variants { get; set; }
}

public sealed class UploadSellerProductImagesRequest
{
    public IReadOnlyList<SellerProductImageInput> Images { get; set; } = Array.Empty<SellerProductImageInput>();
    /// <summary>When true, replace existing images with the provided set.</summary>
    public bool ReplaceExisting { get; set; }
}
