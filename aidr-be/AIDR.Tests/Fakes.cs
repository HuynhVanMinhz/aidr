using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Dtos.Discovery;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Exceptions;

namespace AIDR.Tests;

/// <summary>
/// In-memory stand-ins for the import's collaborators. They implement only what
/// the import actually calls; anything else throws, so a test that starts
/// depending on new behaviour fails loudly rather than on a silent default.
/// </summary>
internal sealed class FakeProductRepository : ISellerProductRepository
{
    public static readonly Guid ShopId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid OwnerId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    private readonly Dictionary<string, SellerProductRecord> _bySlug = new(StringComparer.OrdinalIgnoreCase);

    public void Add(SellerProductRecord product) => _bySlug[product.Slug] = product;

    public Task<SellerShopRecord?> GetActiveShopByOwnerAsync(Guid ownerUserId, CancellationToken ct = default) =>
        Task.FromResult<SellerShopRecord?>(new SellerShopRecord
        {
            ShopId = ShopId,
            OwnerUserId = OwnerId,
            Status = "Active",
        });

    public Task<Guid?> FindIdBySlugAsync(Guid shopId, string slug, CancellationToken ct = default) =>
        Task.FromResult(_bySlug.TryGetValue(slug, out var found) ? found.ProductId : (Guid?)null);

    public Task<SellerProductRecord?> GetByIdForShopAsync(Guid shopId, Guid productId, CancellationToken ct = default) =>
        Task.FromResult(_bySlug.Values.FirstOrDefault(p => p.ProductId == productId));

    public Task<IReadOnlyList<SellerCategoryOptionRecord>> ListActiveCategoryOptionsAsync(CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<SellerCategoryOptionRecord>>(
        [
            new() { CategoryId = 7, ParentId = null, Name = "Phones" },
        ]);

    public Task<IReadOnlyDictionary<Guid, IReadOnlyList<string>>> ListImageUrlsAsync(
        IReadOnlyCollection<Guid> productIds,
        CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyDictionary<Guid, IReadOnlyList<string>>>(
            new Dictionary<Guid, IReadOnlyList<string>>());

    public Task<(IReadOnlyList<SellerProductRecord> Items, int TotalCount)> ListByShopAsync(
        Guid shopId, string? status, string? keyword, int? categoryId, bool includeDeleted,
        int page, int pageSize, CancellationToken ct = default)
    {
        var items = (IReadOnlyList<SellerProductRecord>)_bySlug.Values.ToList();
        return Task.FromResult((items, items.Count));
    }

    public Task<bool> CategoryExistsAndActiveAsync(int categoryId, CancellationToken ct = default) =>
        Task.FromResult(categoryId == 7);

    public Task<bool> SlugExistsInShopAsync(Guid shopId, string slug, Guid? excludeProductId = null, CancellationToken ct = default) =>
        Task.FromResult(_bySlug.ContainsKey(slug));

    public Task<int> GetImageCountAsync(Guid productId, CancellationToken ct = default) => Task.FromResult(1);

    public Task<SellerProductRecord> CreateAsync(Guid shopId, SellerProductWriteModel model, CancellationToken ct = default) =>
        throw new NotSupportedException("The import writes through ISellerProductService.");

    public Task<SellerProductRecord> UpdateAsync(Guid shopId, Guid productId, SellerProductWriteModel model, CancellationToken ct = default) =>
        throw new NotSupportedException("The import writes through ISellerProductService.");

    public Task SoftDeleteAsync(Guid shopId, Guid productId, CancellationToken ct = default) =>
        throw new NotSupportedException();

    public Task<SellerProductRecord> AddImagesAsync(
        Guid shopId, Guid productId, IReadOnlyList<SellerProductImageWriteModel> images,
        bool replaceExisting, CancellationToken ct = default) =>
        throw new NotSupportedException();
}

/// <summary>Records what the import asked for, and can be told to refuse a slug.</summary>
internal sealed class FakeProductService : ISellerProductService
{
    private readonly FakeProductRepository _repository;

    public FakeProductService(FakeProductRepository repository) => _repository = repository;

    /// <summary>Slugs whose create must fail, to model a row the server rejects.</summary>
    public HashSet<string> RejectSlugs { get; } = new(StringComparer.OrdinalIgnoreCase);

    public List<string> Created { get; } = [];
    public List<Guid> Updated { get; } = [];

    /// <summary>The requests themselves, for tests about what the sheet turned into.</summary>
    public List<CreateSellerProductRequest> CreateRequests { get; } = [];
    public List<UpdateSellerProductRequest> UpdateRequests { get; } = [];
    public List<UploadSellerProductImagesRequest> ImageUploads { get; } = [];

    public Task<SellerProductDetailDto> CreateAsync(
        Guid ownerUserId,
        CreateSellerProductRequest request,
        CancellationToken ct = default)
    {
        if (RejectSlugs.Contains(request.Slug ?? string.Empty))
            throw new AppException($"Rejected \"{request.Slug}\".");

        var id = Guid.NewGuid();
        Created.Add(request.Slug!);
        CreateRequests.Add(request);

        // Registered so a stock row pointing at this slug can resolve after create.
        _repository.Add(new SellerProductRecord
        {
            ProductId = id,
            ShopId = FakeProductRepository.ShopId,
            Name = request.Name!,
            Slug = request.Slug!,
            ConditionType = "New",
            Status = "Pending",
        });

        // The real service answers with the variants it wrote, ids and all; a stock
        // row naming a SKU created by this same file has nothing else to go on.
        var variants = (request.Variants ?? [])
            .Select((v, index) => new SellerProductVariantDto
            {
                VariantId = Guid.NewGuid(),
                Sku = v.Sku,
                VariantName = string.Join(" / ", v.Attributes.Values),
                Attributes = v.Attributes,
                Price = v.Price,
                SalePrice = v.SalePrice,
                ImageUrl = v.ImageUrl,
                SortOrder = index,
                IsActive = v.IsActive,
            })
            .ToList();

        return Task.FromResult(new SellerProductDetailDto
        {
            ProductId = id,
            Slug = request.Slug!,
            Variants = variants,
        });
    }

    public Task<SellerProductDetailDto> UpdateAsync(
        Guid ownerUserId,
        Guid productId,
        UpdateSellerProductRequest request,
        CancellationToken ct = default)
    {
        Updated.Add(productId);
        UpdateRequests.Add(request);
        return Task.FromResult(new SellerProductDetailDto { ProductId = productId });
    }

    public Task<PagedResult<SellerProductListItemDto>> ListAsync(
        Guid ownerUserId, SellerProductQueryRequest request, CancellationToken ct = default) =>
        throw new NotSupportedException();

    public Task<SellerProductDetailDto> GetByIdAsync(Guid ownerUserId, Guid productId, CancellationToken ct = default) =>
        throw new NotSupportedException();

    public Task<SellerProductDetailDto> UploadImagesAsync(
        Guid ownerUserId,
        Guid productId,
        UploadSellerProductImagesRequest request,
        CancellationToken ct = default)
    {
        ImageUploads.Add(request);
        return Task.FromResult(new SellerProductDetailDto { ProductId = productId });
    }

    public Task DeleteAsync(Guid ownerUserId, Guid productId, CancellationToken ct = default) =>
        throw new NotSupportedException();
}

/// <summary>Captures every lot the import tries to receive.</summary>
internal sealed class RecordingInventoryService : ISellerInventoryService
{
    public List<(Guid ProductId, ImportStockLotRequest Request)> Lots { get; } = [];

    /// <summary>Product ids whose lots must be refused, to model a server rule.</summary>
    public HashSet<Guid> RejectProducts { get; } = [];

    public Task<SellerInventoryDetailDto> ImportLotAsync(
        Guid ownerUserId,
        Guid productId,
        ImportStockLotRequest request,
        CancellationToken ct = default)
    {
        if (RejectProducts.Contains(productId))
            throw new AppException("The lot was refused.");

        Lots.Add((productId, request));
        return Task.FromResult(new SellerInventoryDetailDto { ProductId = productId });
    }

    public Task<SellerInventoryListResult> ListAsync(
        Guid ownerUserId, SellerInventoryQueryRequest request, CancellationToken ct = default) =>
        throw new NotSupportedException();

    public Task<SellerInventoryDetailDto> GetByProductIdAsync(Guid ownerUserId, Guid productId, CancellationToken ct = default) =>
        throw new NotSupportedException();

    public Task<SellerInventoryDetailDto> UpdateLowStockThresholdAsync(
        Guid ownerUserId, Guid productId, UpdateSellerInventoryRequest request, CancellationToken ct = default) =>
        throw new NotSupportedException();

    public Task<SellerInventoryDetailDto> AdjustAsync(
        Guid ownerUserId, Guid productId, AdjustSellerInventoryRequest request, CancellationToken ct = default) =>
        throw new NotSupportedException();

    public Task<SellerPriceUpdateDto> UpdateSellingPriceAsync(
        Guid ownerUserId, Guid productId, UpdateSellingPriceRequest request, CancellationToken ct = default) =>
        throw new NotSupportedException();

    public Task<RestockAdviceResultDto> GetRestockAdviceAsync(
        Guid ownerUserId, int salesWindowDays, CancellationToken ct = default) =>
        throw new NotSupportedException();
}

/// <summary>Hands the service preset sheets, so planning is tested without Excel.</summary>
internal sealed class StubWorkbook : ISellerProductWorkbook
{
    public List<SellerProductSheetRow> Products { get; } = [];
    public List<SellerProductVariantSheetRow> Variants { get; } = [];
    public List<SellerInventorySheetRow> Inventory { get; } = [];

    /// <summary>What the last export was asked to write, so a test can read it back.</summary>
    public IReadOnlyList<SellerProductVariantSheetExport> WrittenVariants { get; private set; } = [];

    public SellerImportSheets Read(Stream stream) => new()
    {
        Products = Products,
        Variants = Variants,
        Inventory = Inventory,
    };

    public byte[] WriteProducts(
        IReadOnlyList<SellerProductSheetExport> products,
        IReadOnlyList<SellerProductVariantSheetExport> variants,
        IReadOnlyList<SellerInventorySheetExport> inventory,
        IReadOnlyList<SellerCategoryChoice> categories)
    {
        WrittenVariants = variants;
        return [];
    }

    public byte[] WriteTemplate(IReadOnlyList<SellerCategoryChoice> categories) => [];
}

/// <summary>
/// Stands in for the image host. Records what it was asked to store and hands back
/// a URL, so an import test never touches the network.
/// </summary>
internal sealed class StubImportImageStore : ISellerImportImageStore
{
    public bool IsConfigured { get; set; } = true;
    public int MaxBytes { get; set; } = 5 * 1024 * 1024;
    public IReadOnlyCollection<string> AllowedExtensions { get; set; } =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "png", "jpg", "jpeg", "webp" };

    public List<SheetImage> Saved { get; } = [];

    /// <summary>Set to make the upload itself fail, the way a rejected file would.</summary>
    public string? FailWith { get; set; }

    public Task<string> SaveAsync(SheetImage image, CancellationToken cancellationToken = default)
    {
        if (FailWith is not null)
            throw new AppException(FailWith);

        Saved.Add(image);
        return Task.FromResult($"https://cdn.test/import/{Saved.Count}.{image.Extension}");
    }
}
