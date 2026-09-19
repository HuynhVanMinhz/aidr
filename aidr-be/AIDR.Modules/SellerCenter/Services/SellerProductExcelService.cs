using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Exceptions;
using AIDR.Shared.Serialization;

namespace AIDR.Modules.SellerCenter.Services;

/// <summary>
/// Spreadsheet in, products out. Every row is written through
/// <see cref="ISellerProductService"/> rather than straight to the repository, so
/// an import can never accept something the create form would have rejected.
/// </summary>
public sealed class SellerProductExcelService : ISellerProductExcelService
{
    /// <summary>
    /// Far more than a real catalogue edit, and small enough that the whole plan
    /// fits in memory and in one preview table.
    /// </summary>
    private const int MaxRows = 2000;

    /// <summary>Page size for walking the shop's catalogue on export.</summary>
    private const int ExportPageSize = 200;

    private const string ActionCreate = "Create";
    private const string ActionUpdate = "Update";
    private const string ActionError = "Error";
    private const string ActionReceive = "Receive";

    private static readonly Regex SlugRegex = new(
        @"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex HttpUrlRegex = new(
        @"^https?:\/\/.+\..+",
        RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    /// <summary>Sellers separate list cells with commas, and sometimes alt+enter.</summary>
    private static readonly char[] ListSeparators = [',', '\n'];

    private readonly ISellerProductRepository _repository;
    private readonly ISellerProductService _products;
    private readonly ISellerInventoryService _inventory;
    private readonly ISellerProductWorkbook _workbook;
    private readonly ISellerImportImageStore _images;

    public SellerProductExcelService(
        ISellerProductRepository repository,
        ISellerProductService products,
        ISellerInventoryService inventory,
        ISellerProductWorkbook workbook,
        ISellerImportImageStore images)
    {
        _repository = repository;
        _products = products;
        // Stock goes in through the same service the Inventory screen uses, so a
        // spreadsheet can never receive a lot the form would have refused.
        _inventory = inventory;
        _workbook = workbook;
        // A catalogue photo is a URL, so a picture pasted into the sheet has to be
        // given one before any of it can be saved.
        _images = images;
    }

    public async Task<byte[]> ExportAsync(
        Guid ownerUserId,
        SellerProductQueryRequest request,
        CancellationToken cancellationToken = default)
    {
        var shop = await RequireShopAsync(ownerUserId, cancellationToken);
        var categories = await LoadCategoriesAsync(cancellationToken);

        var (statusFilter, includeDeleted) = ParseExportStatus(request.Status);
        var keyword = string.IsNullOrWhiteSpace(request.Q) ? null : request.Q.Trim();

        var records = new List<SellerProductRecord>();

        // The export follows whatever the seller is looking at, but not its paging:
        // downloading page 2 of their own catalogue would be a trap.
        for (var page = 1; ; page++)
        {
            var (items, total) = await _repository.ListByShopAsync(
                shop.ShopId,
                statusFilter,
                keyword,
                request.CategoryId,
                includeDeleted,
                page,
                ExportPageSize,
                cancellationToken);

            records.AddRange(items);

            if (items.Count == 0 || records.Count >= total) break;
        }

        var imagesByProduct = await _repository.ListImageUrlsAsync(
            records.Select(r => r.ProductId).ToList(),
            cancellationToken);

        var exports = records.Select(item => new SellerProductSheetExport
        {
            ProductId = item.ProductId,
            Status = item.Status,
            StockQuantity = item.StockQuantity,
            CategoryId = item.CategoryId,
            CategoryPath = categories.PathOf(item.CategoryId) ?? item.CategoryName,
            Name = item.Name,
            Slug = item.Slug,
            Brand = item.Brand,
            ModelNumber = item.ModelNumber,
            ConditionType = item.ConditionType,
            BasePrice = item.BasePrice,
            SalePrice = item.SalePrice,
            WarrantyMonths = item.WarrantyMonths,
            OriginCountry = item.OriginCountry,
            ShortDescription = item.ShortDescription,
            Description = item.Description,
            Tags = TagsJsonToText(item.TagsJson),
            Specs = SpecsJsonToText(item.SpecsJson),
            ImageUrls = string.Join(", ", imagesByProduct.GetValueOrDefault(item.ProductId) ?? []),
        }).ToList();

        // Every configuration the shop sells, so a seller can edit prices and swap a
        // colour's photo in the same file they edit the products in.
        var variantExports = records
            .SelectMany(item => item.Variants
                .OrderBy(v => v.SortOrder)
                .Select(v => new SellerProductVariantSheetExport
                {
                    Slug = item.Slug,
                    ProductName = item.Name,
                    Sku = v.Sku,
                    VariantName = v.VariantName,
                    Attributes = AttributesToText(v.AttributesJson),
                    Price = v.Price,
                    SalePrice = v.SalePrice,
                    ImageUrl = v.ImageUrl,
                    IsActive = v.IsActive,
                }))
            .ToList();

        // One line per sellable configuration: that is the grain stock is held at,
        // and the grain the seller has to type a quantity against.
        var stock = records.SelectMany(item => item.Variants.Count == 0
            ? [new SellerInventorySheetExport
                {
                    Slug = item.Slug,
                    ProductName = item.Name,
                    OnHand = item.StockQuantity,
                }]
            : item.Variants.Select(v => new SellerInventorySheetExport
                {
                    Slug = item.Slug,
                    ProductName = item.Name,
                    VariantSku = v.Sku,
                    VariantName = v.VariantName,
                    OnHand = v.StockQuantity,
                }))
            .ToList();

        return _workbook.WriteProducts(exports, variantExports, stock, categories.Choices);
    }

    public async Task<byte[]> BuildTemplateAsync(Guid ownerUserId, CancellationToken cancellationToken = default)
    {
        await RequireShopAsync(ownerUserId, cancellationToken);
        var categories = await LoadCategoriesAsync(cancellationToken);
        return _workbook.WriteTemplate(categories.Choices);
    }

    public async Task<SellerProductImportPreviewDto> PreviewImportAsync(
        Guid ownerUserId,
        Stream file,
        CancellationToken cancellationToken = default)
    {
        var plan = await PlanAsync(ownerUserId, file, cancellationToken);

        var receiving = plan.StockRows.Where(r => r.Action == ActionReceive).ToList();

        return new SellerProductImportPreviewDto
        {
            TotalRows = plan.Rows.Count,
            CreateCount = plan.Rows.Count(r => r.Action == ActionCreate),
            UpdateCount = plan.Rows.Count(r => r.Action == ActionUpdate),
            ErrorCount = plan.Rows.Count(r => r.Action == ActionError),
            StockRowCount = receiving.Count,
            StockErrorCount = plan.StockRows.Count(r => r.Action == ActionError),
            StockUnitCount = receiving.Sum(r => r.Quantity ?? 0),
            Warnings = plan.Warnings,
            Rows = plan.Rows.Select(ToDto).ToList(),
            StockRows = plan.StockRows.Select(ToDto).ToList(),
        };
    }

    public async Task<SellerProductImportResultDto> ImportAsync(
        Guid ownerUserId,
        Stream file,
        CancellationToken cancellationToken = default)
    {
        var plan = await PlanAsync(ownerUserId, file, cancellationToken);

        var created = 0;
        var updated = 0;
        var failed = new List<SellerProductImportRowDto>();

        foreach (var row in plan.Rows)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (row.Action == ActionError)
            {
                failed.Add(ToDto(row));
                continue;
            }

            try
            {
                if (row.ProductId is { } productId)
                {
                    await _products.UpdateAsync(
                        ownerUserId,
                        productId,
                        await BuildUpdateRequestAsync(row, cancellationToken),
                        cancellationToken);

                    await ApplyImagesAsync(ownerUserId, productId, row, cancellationToken);
                    updated++;
                }
                else
                {
                    var detail = await _products.CreateAsync(
                        ownerUserId,
                        await BuildCreateRequestAsync(row, cancellationToken),
                        cancellationToken);

                    created++;

                    // The slug is now taken, so a later duplicate row in the same
                    // sheet updates this product instead of colliding with it. The
                    // variant ids come too: a stock row naming a SKU this file has
                    // only just created has no other way to find it.
                    plan.RegisterCreated(row.Slug!, detail.ProductId, detail.Variants);
                }
            }
            catch (AppException ex)
            {
                // NotFoundException and ConflictException are both AppException, so
                // one catch covers every rule the product service enforces.
                failed.Add(ToDto(row) with { Errors = [ex.Message] });
            }
        }

        // Stock is applied last so a lot can reference a product this same file
        // created a moment ago.
        var (lots, units, stockFailed) = await ReceiveStockAsync(ownerUserId, plan, cancellationToken);

        return new SellerProductImportResultDto
        {
            Created = created,
            Updated = updated,
            Failed = failed.Count,
            FailedRows = failed,
            StockLotsReceived = lots,
            StockUnitsReceived = units,
            StockFailed = stockFailed.Count,
            FailedStockRows = stockFailed,
        };
    }

    /// <summary>
    /// Receives every planned lot. A row that fails is reported and the rest still
    /// run: a rejected lot is not a reason to leave the other deliveries unrecorded.
    /// </summary>
    private async Task<(int Lots, int Units, List<SellerInventoryImportRowDto> Failed)> ReceiveStockAsync(
        Guid ownerUserId,
        ImportPlan plan,
        CancellationToken cancellationToken)
    {
        var lots = 0;
        var units = 0;
        var failed = new List<SellerInventoryImportRowDto>();

        foreach (var row in plan.StockRows)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (row.Action == ActionError)
            {
                failed.Add(ToDto(row));
                continue;
            }

            // Products created by this run had no id at planning time.
            var productId = row.ProductId ?? plan.CreatedIdFor(row.Slug!);
            if (productId is null)
            {
                failed.Add(ToDto(row) with
                {
                    Errors = [$"No product with slug \"{row.Slug}\" - the row that would have created it did not run."],
                });
                continue;
            }

            // A configuration created by this same run had no id at planning time.
            var variantId = row.VariantId;
            if (variantId is null && row.VariantSku is not null)
            {
                variantId = plan.CreatedVariantIdFor(row.Slug!, row.VariantSku);
                if (variantId is null)
                {
                    failed.Add(ToDto(row) with
                    {
                        Errors = [$"No configuration with SKU \"{row.VariantSku}\" - the Variants row that would have created it did not run."],
                    });
                    continue;
                }
            }

            try
            {
                await _inventory.ImportLotAsync(
                    ownerUserId,
                    productId.Value,
                    new ImportStockLotRequest
                    {
                        VariantId = variantId,
                        LotCode = row.LotCode,
                        Quantity = row.Quantity!.Value,
                        UnitCost = row.UnitCost!.Value,
                        SupplierName = row.SupplierName,
                        InvoiceNumber = row.InvoiceNumber,
                        ReceivedAt = row.ReceivedAt,
                        Note = row.Note,
                    },
                    cancellationToken);

                lots++;
                units += row.Quantity!.Value;
            }
            catch (AppException ex)
            {
                failed.Add(ToDto(row) with { Errors = [ex.Message] });
            }
        }

        return (lots, units, failed);
    }


    /* ------------------------------------------------------------- variants */

    /// <summary>
    /// Attaches the Variants sheet to the products it describes.
    ///
    /// Variants are declared against a product's slug rather than in the product's
    /// own row, because a configuration is a row in its own right: it has its own
    /// price, its own SKU and its own photo. A sheet that mentions no variants for
    /// a product leaves that product's configurations exactly as they are - the
    /// alternative would let an untouched export wipe them.
    /// </summary>
    private async Task PlanVariantsAsync(
        Guid shopId,
        IReadOnlyList<SellerProductVariantSheetRow> sheetRows,
        List<PlannedRow> planned,
        List<string> warnings,
        CancellationToken cancellationToken)
    {
        if (sheetRows.Count == 0) return;

        if (sheetRows.Count > MaxRows)
            throw new AppException($"The Variants sheet has {sheetRows.Count} rows; the limit is {MaxRows} per import.");

        // The later row wins for a repeated slug on the Products sheet, so the
        // variants have to attach to that same row.
        var bySlug = planned
            .Where(r => r.Slug is not null)
            .GroupBy(r => r.Slug!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Last(), StringComparer.OrdinalIgnoreCase);

        foreach (var group in sheetRows.GroupBy(
                     r => r.Slug?.Trim().ToLowerInvariant() ?? string.Empty,
                     StringComparer.OrdinalIgnoreCase))
        {
            var rows = group.OrderBy(r => r.RowNumber).ToList();
            var where = $"Variants sheet, row{(rows.Count == 1 ? string.Empty : "s")} " +
                        string.Join(", ", rows.Select(r => r.RowNumber));

            if (group.Key.Length == 0)
            {
                warnings.Add($"{where}: no Slug, so there is no product to attach the configuration to. Skipped.");
                continue;
            }

            if (!bySlug.TryGetValue(group.Key, out var product))
            {
                warnings.Add(
                    $"{where}: {Quoted(group.Key)} is not on the Products sheet, so its variants were skipped. " +
                    "Add the product's own row to the Products sheet as well - an export contains both.");
                continue;
            }

            // Matching against what the product already has is what keeps each
            // variant's id, and with it the stock and orders hanging off that id.
            var existing = product.ProductId is { } id
                ? await _repository.GetByIdForShopAsync(shopId, id, cancellationToken)
                : null;

            BuildVariantsFor(product, rows, existing);

            if (product.Errors.Count > 0)
            {
                product.Action = ActionError;
                product.ProductId = null;
            }
        }
    }

    private void BuildVariantsFor(
        PlannedRow product,
        IReadOnlyList<SellerProductVariantSheetRow> rows,
        SellerProductRecord? existing)
    {
        var errors = product.Errors;
        var slug = Quoted(product.Slug ?? string.Empty);
        var variants = new List<PlannedVariant>(rows.Count);
        var axes = new List<ProductVariantJson.OptionAxis>();
        var seenCombinations = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seenSkus = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (rows.Count > SellerProductConstants.MaxVariantsPerProduct)
        {
            errors.Add(
                $"Variants sheet: {slug} has {rows.Count} configurations; " +
                $"the limit is {SellerProductConstants.MaxVariantsPerProduct}.");
            return;
        }

        foreach (var row in rows)
        {
            var at = $"Variants sheet, row {row.RowNumber}";

            var attributes = ParseAttributes(row.Attributes, at, errors);
            if (attributes is null) continue;

            // Every row of one product has to answer the same questions; otherwise the
            // picker would show an axis some configurations have no value for.
            if (axes.Count == 0)
            {
                foreach (var name in attributes.Keys)
                    axes.Add(new ProductVariantJson.OptionAxis { Name = name, Values = [] });

                if (axes.Count > SellerProductConstants.MaxVariantOptions)
                {
                    errors.Add(
                        $"{at}: {axes.Count} options were given; the limit is " +
                        $"{SellerProductConstants.MaxVariantOptions}.");
                    return;
                }
            }
            else if (!axes.Select(a => a.Name)
                         .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
                         .SequenceEqual(
                             attributes.Keys.OrderBy(n => n, StringComparer.OrdinalIgnoreCase),
                             StringComparer.OrdinalIgnoreCase))
            {
                errors.Add(
                    $"{at}: this row lists {Quoted(string.Join(", ", attributes.Keys))} while the first row of " +
                    $"{slug} lists {Quoted(string.Join(", ", axes.Select(a => a.Name)))}. " +
                    "Every configuration of one product must use the same option names.");
                continue;
            }

            foreach (var axis in axes)
            {
                var value = attributes[axis.Name];
                if (!axis.Values.Contains(value, StringComparer.OrdinalIgnoreCase))
                    axis.Values.Add(value);
            }

            var combination = string.Join(" / ", axes.Select(a => attributes[a.Name]));
            if (!seenCombinations.Add(combination))
            {
                errors.Add($"{at}: {Quoted(combination)} is listed twice.");
                continue;
            }

            /* price */
            if (string.IsNullOrWhiteSpace(row.Price))
            {
                errors.Add($"{at}: Price is required.");
                continue;
            }

            if (!TryParseMoney(row.Price, out var price) || price < 0)
            {
                errors.Add($"{at}: Price {Quoted(row.Price)} is not a number of 0 or more.");
                continue;
            }

            decimal? salePrice = null;
            if (!string.IsNullOrWhiteSpace(row.SalePrice))
            {
                if (!TryParseMoney(row.SalePrice, out var sale) || sale < 0)
                {
                    errors.Add($"{at}: SalePrice {Quoted(row.SalePrice)} is not a number of 0 or more.");
                    continue;
                }

                if (sale > price)
                {
                    errors.Add($"{at}: SalePrice must not be above this row's own Price.");
                    continue;
                }

                salePrice = sale;
            }

            /* sku */
            var sku = Trimmed(row.Sku);
            if (sku is not null)
            {
                if (sku.Length > SellerProductConstants.MaxVariantSkuLength)
                {
                    errors.Add($"{at}: Sku must not exceed {SellerProductConstants.MaxVariantSkuLength} characters.");
                    continue;
                }

                if (!seenSkus.Add(sku))
                {
                    errors.Add($"{at}: Sku {Quoted(sku)} is used by another configuration of this product.");
                    continue;
                }
            }

            /* photo: a link if there is one, otherwise the picture pasted on the row */
            var imageUrl = Trimmed(row.ImageUrl);
            var imageFile = row.Images.FirstOrDefault();

            if (imageUrl is not null)
            {
                if (!HttpUrlRegex.IsMatch(imageUrl))
                {
                    errors.Add($"{at}: ImageUrl {Quoted(imageUrl)} must start with http:// or https://.");
                    continue;
                }

                if (imageUrl.Length > SellerProductConstants.MaxImageUrlLength)
                {
                    errors.Add($"{at}: ImageUrl exceeds {SellerProductConstants.MaxImageUrlLength} characters.");
                    continue;
                }

                // Both were given; the typed link is the deliberate one.
                imageFile = null;
            }
            else if (imageFile is not null)
            {
                var before = errors.Count;
                ValidateSheetImage(imageFile, $"the configuration on row {row.RowNumber}", errors);
                if (errors.Count != before) continue;
            }

            /* active */
            var isActive = true;
            if (!string.IsNullOrWhiteSpace(row.IsActive) && !TryParseFlag(row.IsActive, out isActive))
            {
                errors.Add($"{at}: Active {Quoted(row.IsActive)} is not yes/no.");
                continue;
            }

            variants.Add(new PlannedVariant
            {
                RowNumber = row.RowNumber,
                Sku = sku,
                Attributes = new Dictionary<string, string>(attributes, StringComparer.Ordinal),
                Price = price,
                SalePrice = salePrice,
                ImageUrl = imageUrl,
                ImageFile = imageFile,
                IsActive = isActive,
                SortOrder = variants.Count,
            });
        }

        if (errors.Count > 0) return;

        if (variants.Count == 0)
        {
            errors.Add($"Variants sheet: no usable configuration was read for {slug}.");
            return;
        }

        if (!variants.Any(v => v.IsActive))
        {
            errors.Add($"Variants sheet: at least one configuration of {slug} must be Active.");
            return;
        }

        foreach (var axis in axes)
        {
            if (axis.Name.Length > SellerProductConstants.MaxVariantOptionNameLength)
                errors.Add($"Variants sheet: option name {Quoted(axis.Name)} is too long.");

            if (axis.Values.Count > SellerProductConstants.MaxVariantOptionValues)
            {
                errors.Add(
                    $"Variants sheet: option {Quoted(axis.Name)} has {axis.Values.Count} values; " +
                    $"the limit is {SellerProductConstants.MaxVariantOptionValues}.");
            }

            foreach (var value in axis.Values)
            {
                if (value.Length > SellerProductConstants.MaxVariantOptionValueLength)
                    errors.Add($"Variants sheet: option value {Quoted(value)} is too long.");
            }
        }

        if (errors.Count > 0) return;

        MatchExistingVariants(variants, existing, errors);
        if (errors.Count > 0) return;

        product.VariantOptions = axes;
        product.Variants = variants;
    }

    /// <summary>
    /// Gives each row the id of the configuration it is really editing.
    ///
    /// Without this, re-importing an export would read as "delete every variant and
    /// add these" - which the repository refuses for anything holding stock or
    /// sitting on an order, and which would strand inventory lots for the rest. A
    /// row is matched by SKU first, because that is the handle the seller controls,
    /// and by its combination of option values otherwise.
    /// </summary>
    private static void MatchExistingVariants(
        List<PlannedVariant> variants,
        SellerProductRecord? existing,
        List<string> errors)
    {
        if (existing is null || existing.Variants.Count == 0) return;

        var claimed = new HashSet<Guid>();

        foreach (var variant in variants.Where(v => v.Sku is not null))
        {
            var match = existing.Variants.FirstOrDefault(v =>
                v.Sku is not null &&
                string.Equals(v.Sku, variant.Sku, StringComparison.OrdinalIgnoreCase));

            if (match is not null && claimed.Add(match.VariantId))
                variant.VariantId = match.VariantId;
        }

        foreach (var variant in variants.Where(v => v.VariantId is null))
        {
            var match = existing.Variants.FirstOrDefault(v =>
                !claimed.Contains(v.VariantId) &&
                SameCombination(ProductVariantJson.ParseAttributes(v.AttributesJson), variant.Attributes));

            if (match is not null && claimed.Add(match.VariantId))
                variant.VariantId = match.VariantId;
        }

        // Anything the sheet no longer lists is a deletion, and one the seller may
        // not have meant. Say what it would cost before the repository refuses it.
        var dropped = existing.Variants.Where(v => !claimed.Contains(v.VariantId));
        foreach (var stocked in dropped.Where(v => v.StockQuantity > 0))
        {
            errors.Add(
                $"Variants sheet: {Quoted(stocked.VariantName)} is not listed, and it still holds " +
                $"{stocked.StockQuantity} unit(s) in stock. Add its row back, or write the stock off first.");
        }
    }

    private static bool SameCombination(
        IReadOnlyDictionary<string, string> left,
        IReadOnlyDictionary<string, string> right)
    {
        if (left.Count != right.Count) return false;

        foreach (var (name, value) in left)
        {
            if (!right.TryGetValue(name, out var other) ||
                !string.Equals(other, value, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }

        return true;
    }

    /// <summary>Reads "Color=Pink; Storage=256GB" into the pairs it names, in that order.</summary>
    private static Dictionary<string, string>? ParseAttributes(string? raw, string at, List<string> errors)
    {
        const string shape = "\"Color=Pink; Storage=256GB\"";

        if (string.IsNullOrWhiteSpace(raw))
        {
            errors.Add($"{at}: Attributes is required, e.g. {shape}.");
            return null;
        }

        var attributes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var part in raw.Split([';', '\n'], StringSplitOptions.RemoveEmptyEntries))
        {
            var pair = part.Split('=', 2);
            if (pair.Length != 2)
            {
                errors.Add($"{at}: {Quoted(part)} is not an option; they look like {shape}.");
                return null;
            }

            var name = pair[0].Trim();
            var value = pair[1].Trim();

            if (name.Length == 0 || value.Length == 0)
            {
                errors.Add($"{at}: {Quoted(part)} is missing an option name or its value.");
                return null;
            }

            if (!attributes.TryAdd(name, value))
            {
                errors.Add($"{at}: option {Quoted(name)} is given twice on the same row.");
                return null;
            }
        }

        if (attributes.Count == 0)
        {
            errors.Add($"{at}: Attributes is required, e.g. {shape}.");
            return null;
        }

        return attributes;
    }

    /// <summary>Sellers write Yes, No, TRUE, 0 - all of them mean the obvious thing.</summary>
    private static bool TryParseFlag(string raw, out bool value)
    {
        switch (raw.Trim().ToLowerInvariant())
        {
            case "y" or "yes" or "true" or "1" or "on" or "active":
                value = true;
                return true;
            case "n" or "no" or "false" or "0" or "off" or "hidden" or "inactive":
                value = false;
                return true;
            default:
                value = true;
                return false;
        }
    }

    /// <summary>Writes an attributes JSON back out the way the sheet asks for it.</summary>
    private static string AttributesToText(string? attributesJson) =>
        string.Join(
            "; ",
            ProductVariantJson.ParseAttributes(attributesJson).Select(pair => $"{pair.Key}={pair.Value}"));

    /* ------------------------------------------------------------ planning */

    /// <summary>
    /// Reads the sheet and decides, for every row, what would happen and what is
    /// wrong with it. Preview and import share this so the table the seller
    /// approved is exactly the work that then runs.
    /// </summary>
    private async Task<ImportPlan> PlanAsync(
        Guid ownerUserId,
        Stream file,
        CancellationToken cancellationToken)
    {
        var shop = await RequireShopAsync(ownerUserId, cancellationToken);
        var sheets = _workbook.Read(file);
        var sheetRows = sheets.Products;

        // A file may legitimately carry only stock, or only variants; what it may not
        // do is carry nothing at all.
        if (sheetRows.Count == 0 && sheets.Inventory.Count == 0 && sheets.Variants.Count == 0)
            throw new AppException("The sheet has no product rows.");

        if (sheetRows.Count > MaxRows)
            throw new AppException($"This file has {sheetRows.Count} rows; the limit is {MaxRows} per import.");

        var categories = await LoadCategoriesAsync(cancellationToken);
        var warnings = new List<string>();
        var planned = new List<PlannedRow>(sheetRows.Count);
        var slugRows = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var sheetRow in sheetRows)
        {
            var row = BuildPlannedRow(sheetRow, categories);

            if (row.Slug is { } slug)
            {
                if (slugRows.TryGetValue(slug, out var firstRow))
                {
                    warnings.Add(
                        $"Slug \"{slug}\" appears on rows {firstRow} and {sheetRow.RowNumber}; " +
                        "the later row wins.");
                }
                else
                {
                    slugRows[slug] = sheetRow.RowNumber;
                }

                if (row.Errors.Count == 0)
                {
                    row.ProductId = await _repository.FindIdBySlugAsync(shop.ShopId, slug, cancellationToken);
                    row.Action = row.ProductId is null ? ActionCreate : ActionUpdate;
                }
            }

            planned.Add(row);
        }

        await ValidateImagesAsync(planned, cancellationToken);
        await PlanVariantsAsync(shop.ShopId, sheets.Variants, planned, warnings, cancellationToken);

        var stock = await PlanStockAsync(shop.ShopId, sheets.Inventory, planned, cancellationToken);
        WarnOnRepeatedStockRows(stock, warnings);

        return new ImportPlan(planned, warnings, stock);
    }

    /// <summary>
    /// Two rows for the same configuration are legal - a shop really can take two
    /// deliveries - but they are also what a duplicated paste looks like, and the
    /// difference is only visible to the seller. So it is said out loud.
    /// </summary>
    private static void WarnOnRepeatedStockRows(List<PlannedStockRow> stock, List<string> warnings)
    {
        var groups = stock
            .Where(r => r.Action == ActionReceive && r.Slug is not null)
            .GroupBy(r => $"{r.Slug}|{r.VariantSku?.ToLowerInvariant() ?? string.Empty}")
            .Where(g => g.Count() > 1);

        foreach (var group in groups)
        {
            var first = group.First();
            var where = first.VariantSku is null
                ? Quoted(first.Slug!)
                : $"{Quoted(first.Slug!)} / {Quoted(first.VariantSku)}";

            warnings.Add(
                $"Rows {string.Join(", ", group.Select(r => r.RowNumber))} all receive stock for " +
                $"{where}; that is {group.Sum(r => r.Quantity ?? 0)} units in " +
                $"{group.Count()} separate lots.");
        }
    }

    /// <summary>
    /// Works out what each Inventory row would receive, and against which product
    /// and configuration. A slug the file itself is creating is accepted here and
    /// resolved to its new id once the products have been written.
    /// </summary>
    private async Task<List<PlannedStockRow>> PlanStockAsync(
        Guid shopId,
        IReadOnlyList<SellerInventorySheetRow> sheetRows,
        List<PlannedRow> productRows,
        CancellationToken cancellationToken)
    {
        var planned = new List<PlannedStockRow>(sheetRows.Count);
        if (sheetRows.Count == 0) return planned;

        if (sheetRows.Count > MaxRows)
            throw new AppException($"The Inventory sheet has {sheetRows.Count} rows; the limit is {MaxRows} per import.");

        // One lookup per distinct slug, however many lots that slug receives.
        var resolved = new Dictionary<string, SellerProductRecord?>(StringComparer.OrdinalIgnoreCase);

        foreach (var sheetRow in sheetRows)
        {
            var row = new PlannedStockRow { RowNumber = sheetRow.RowNumber, Action = ActionError };
            var errors = row.Errors;

            row.Slug = sheetRow.Slug?.Trim().ToLowerInvariant();
            row.VariantSku = Trimmed(sheetRow.VariantSku);

            if (string.IsNullOrWhiteSpace(row.Slug))
                errors.Add("Slug is required - it says which product this stock is for.");

            /* quantity and cost: the two cells that make a row do anything */
            if (string.IsNullOrWhiteSpace(sheetRow.Quantity))
            {
                errors.Add("Quantity is required to receive stock.");
            }
            else if (!int.TryParse(
                         sheetRow.Quantity.Trim(),
                         NumberStyles.Integer,
                         CultureInfo.InvariantCulture,
                         out var qty))
            {
                errors.Add($"Quantity {Quoted(sheetRow.Quantity)} is not a whole number.");
            }
            else if (qty <= 0 || qty > SellerInventoryConstants.MaxQuantity)
            {
                errors.Add($"Quantity must be between 1 and {SellerInventoryConstants.MaxQuantity}.");
            }
            else
            {
                row.Quantity = qty;
            }

            if (string.IsNullOrWhiteSpace(sheetRow.UnitCost))
                errors.Add("UnitCost is required: a lot with no cost would make every margin figure wrong.");
            else if (!TryParseMoney(sheetRow.UnitCost, out var cost))
                errors.Add($"UnitCost {Quoted(sheetRow.UnitCost)} is not a number.");
            else if (cost < 0)
                errors.Add("UnitCost must be 0 or more.");
            else
                row.UnitCost = cost;

            if (!string.IsNullOrWhiteSpace(sheetRow.ReceivedAt))
            {
                if (DateTime.TryParse(
                        sheetRow.ReceivedAt.Trim(),
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal,
                        out var receivedAt))
                {
                    row.ReceivedAt = receivedAt;
                }
                else
                {
                    errors.Add($"ReceivedAt {Quoted(sheetRow.ReceivedAt)} is not a date; use 2026-09-04.");
                }
            }

            row.LotCode = Trimmed(sheetRow.LotCode);
            row.SupplierName = Trimmed(sheetRow.SupplierName);
            row.InvoiceNumber = Trimmed(sheetRow.InvoiceNumber);
            row.Note = Trimmed(sheetRow.Note);

            /* which product, and which configuration of it */
            if (row.Slug is { } slug)
            {
                if (!resolved.TryGetValue(slug, out var record))
                {
                    var productId = await _repository.FindIdBySlugAsync(shopId, slug, cancellationToken);
                    record = productId is null
                        ? null
                        : await _repository.GetByIdForShopAsync(shopId, productId.Value, cancellationToken);
                    resolved[slug] = record;
                }

                if (record is not null)
                {
                    row.ProductId = record.ProductId;
                    row.ProductName = record.Name;
                    ResolveVariant(record, row);
                }
                else
                {
                    var creating = productRows.FirstOrDefault(r =>
                        r.Action == ActionCreate &&
                        string.Equals(r.Slug, slug, StringComparison.OrdinalIgnoreCase));

                    if (creating is null)
                    {
                        errors.Add($"No product with slug {Quoted(slug)} in your shop, and this file does not create one.");
                    }
                    else
                    {
                        row.ProductName = creating.Name;

                        // A product this file creates may still be sold in variants -
                        // the Variants sheet says so - and its ids only exist once it
                        // has been written, so the SKU is checked against the plan.
                        if (creating.Variants is { Count: > 0 } plannedVariants)
                        {
                            if (row.VariantSku is null)
                            {
                                var known = plannedVariants
                                    .Where(v => v.Sku is not null)
                                    .Select(v => v.Sku!)
                                    .ToList();

                                errors.Add(known.Count == 0
                                    ? $"{Quoted(creating.Name ?? slug)} is being created with variants, but none of them has a Sku on the Variants sheet to address it by."
                                    : $"{Quoted(creating.Name ?? slug)} is being created with variants; set VariantSku to one of: {string.Join(", ", known)}.");
                            }
                            else if (!plannedVariants.Any(v =>
                                         string.Equals(v.Sku, row.VariantSku, StringComparison.OrdinalIgnoreCase)))
                            {
                                errors.Add($"The Variants sheet has no configuration with Sku {Quoted(row.VariantSku)} for {Quoted(slug)}.");
                            }
                        }
                        else if (row.VariantSku is not null)
                        {
                            errors.Add("VariantSku cannot be used for a product this file is creating without a Variants sheet row; add one, or leave it blank.");
                        }
                    }
                }
            }

            row.Action = errors.Count == 0 ? ActionReceive : ActionError;
            planned.Add(row);
        }

        return planned;
    }

    /// <summary>
    /// Stock belongs to a configuration, so a product sold in variants has to be
    /// told which one; a single-configuration product has to be told nothing.
    /// </summary>
    private static void ResolveVariant(SellerProductRecord record, PlannedStockRow row)
    {
        if (record.Variants.Count == 0)
        {
            if (row.VariantSku is not null)
                row.Errors.Add($"{Quoted(record.Name)} is sold as a single configuration; leave VariantSku blank.");
            return;
        }

        if (row.VariantSku is null)
        {
            var known = record.Variants
                .Where(v => !string.IsNullOrWhiteSpace(v.Sku))
                .Select(v => v.Sku!)
                .ToList();

            row.Errors.Add(known.Count == 0
                ? $"{Quoted(record.Name)} is sold in variants, but none of them has a SKU to address it by."
                : $"{Quoted(record.Name)} is sold in variants; set VariantSku to one of: {string.Join(", ", known)}.");
            return;
        }

        var match = record.Variants.FirstOrDefault(v =>
            string.Equals(v.Sku, row.VariantSku, StringComparison.OrdinalIgnoreCase));

        if (match is null)
            row.Errors.Add($"{Quoted(record.Name)} has no variant with SKU {Quoted(row.VariantSku)}.");
        else
            row.VariantId = match.VariantId;
    }

    private static string Quoted(string value) => "\"" + value.Trim() + "\"";

    private static string? Trimmed(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    private PlannedRow BuildPlannedRow(SellerProductSheetRow sheet, CategoryLookup categories)
    {
        var row = new PlannedRow { RowNumber = sheet.RowNumber, Action = ActionError };
        var errors = row.Errors;

        /* name */
        var name = sheet.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name))
            errors.Add("Name is required.");
        else if (name.Length > SellerProductConstants.MaxNameLength)
            errors.Add($"Name must not exceed {SellerProductConstants.MaxNameLength} characters.");
        else
            row.Name = name;

        /* slug - blank means "derive one", which is what most sellers expect */
        var slug = sheet.Slug?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(slug) && row.Name is not null)
            slug = Slugify(row.Name);

        if (string.IsNullOrWhiteSpace(slug))
        {
            if (row.Name is not null)
                errors.Add("Slug could not be derived from the name; enter one in the Slug column.");
        }
        else if (slug.Length > SellerProductConstants.MaxSlugLength)
        {
            errors.Add($"Slug must not exceed {SellerProductConstants.MaxSlugLength} characters.");
        }
        else if (!SlugRegex.IsMatch(slug))
        {
            errors.Add("Slug must contain only lowercase letters, numbers and hyphens.");
        }
        else
        {
            row.Slug = slug;
        }

        /* category - the id wins, the name is the fallback */
        row.CategoryId = ResolveCategory(sheet, categories, errors, out var categoryName);
        row.CategoryName = categoryName;

        /* condition */
        if (string.IsNullOrWhiteSpace(sheet.Condition))
        {
            row.Condition = SellerProductConstants.ConditionNew;
        }
        else
        {
            var match = SellerProductConstants.AllowedConditions
                .FirstOrDefault(c => c.Equals(sheet.Condition.Trim(), StringComparison.OrdinalIgnoreCase));

            if (match is null)
                errors.Add("Condition must be one of: New, LikeNew, Refurbished, Used.");
            else
                row.Condition = match;
        }

        /* prices */
        if (string.IsNullOrWhiteSpace(sheet.BasePrice))
        {
            errors.Add("BasePrice is required.");
        }
        else if (!TryParseMoney(sheet.BasePrice, out var basePrice))
        {
            errors.Add($"BasePrice \"{sheet.BasePrice}\" is not a number.");
        }
        else if (basePrice < 0)
        {
            errors.Add("BasePrice must be 0 or more.");
        }
        else
        {
            row.BasePrice = basePrice;
        }

        if (!string.IsNullOrWhiteSpace(sheet.SalePrice))
        {
            if (!TryParseMoney(sheet.SalePrice, out var salePrice))
                errors.Add($"SalePrice \"{sheet.SalePrice}\" is not a number.");
            else if (salePrice < 0)
                errors.Add("SalePrice must be 0 or more.");
            else if (row.BasePrice is { } b && salePrice > b)
                errors.Add("SalePrice must not be above BasePrice.");
            else
                row.SalePrice = salePrice;
        }

        /* warranty */
        if (!string.IsNullOrWhiteSpace(sheet.WarrantyMonths))
        {
            if (!TryParseMoney(sheet.WarrantyMonths, out var months) || months != Math.Floor(months))
                errors.Add($"WarrantyMonths \"{sheet.WarrantyMonths}\" is not a whole number.");
            else if (months is < 0 or > 1200)
                errors.Add("WarrantyMonths must be between 0 and 1200.");
            else
                row.WarrantyMonths = (int)months;
        }

        /* bounded free text */
        row.ShortDescription = Bounded(
            sheet.ShortDescription, "ShortDescription", SellerProductConstants.MaxShortDescriptionLength, errors);
        row.Brand = Bounded(sheet.Brand, "Brand", SellerProductConstants.MaxBrandLength, errors);
        row.ModelNumber = Bounded(
            sheet.ModelNumber, "ModelNumber", SellerProductConstants.MaxModelNumberLength, errors);
        row.OriginCountry = Bounded(
            sheet.OriginCountry, "OriginCountry", SellerProductConstants.MaxOriginCountryLength, errors);
        row.Description = string.IsNullOrWhiteSpace(sheet.Description) ? null : sheet.Description.Trim();

        /* tags and specs, written the friendly way and stored as JSON */
        row.TagsJson = BuildTagsJson(sheet.Tags, errors);
        row.SpecsJson = BuildSpecsJson(sheet.Specs, errors);

        // Images are only split here. Whether these URLs must pass validation
        // depends on whether the row actually changes them, and that is not known
        // until the slug has been matched against the shop.
        row.ImageUrls = SplitImageUrls(sheet.ImageUrls);
        row.ImageFiles = sheet.Images.ToList();

        if (errors.Count == 0)
            row.Action = ActionCreate;

        return row;
    }

    private static int? ResolveCategory(
        SellerProductSheetRow sheet,
        CategoryLookup categories,
        List<string> errors,
        out string? categoryName)
    {
        categoryName = null;

        if (!string.IsNullOrWhiteSpace(sheet.CategoryId))
        {
            if (!int.TryParse(sheet.CategoryId.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var id))
            {
                errors.Add($"CategoryId \"{sheet.CategoryId}\" is not a number.");
                return null;
            }

            var path = categories.PathOf(id);
            if (path is null)
            {
                errors.Add($"CategoryId {id} does not exist, or is not active.");
                return null;
            }

            categoryName = path;
            return id;
        }

        if (string.IsNullOrWhiteSpace(sheet.Category))
        {
            errors.Add("CategoryId is required - copy one from the Categories sheet.");
            return null;
        }

        var matches = categories.FindByText(sheet.Category);

        if (matches.Count == 0)
        {
            errors.Add($"Category \"{sheet.Category}\" was not found. Use a CategoryId from the Categories sheet.");
            return null;
        }

        if (matches.Count > 1)
        {
            errors.Add(
                $"Category \"{sheet.Category}\" matches {matches.Count} categories. " +
                "Put the CategoryId in instead.");
            return null;
        }

        categoryName = categories.PathOf(matches[0]);
        return matches[0];
    }

    private async Task ApplyImagesAsync(
        Guid ownerUserId,
        Guid productId,
        PlannedRow row,
        CancellationToken cancellationToken)
    {
        var urls = await ResolveImageUrlsAsync(row, cancellationToken);

        // A blank ImageUrls cell and no pasted picture on an update means "leave the
        // photos alone". Reading it as "delete every photo" would destroy uploads
        // that the spreadsheet has no way to put back.
        if (urls.Count == 0) return;

        await _products.UploadImagesAsync(
            ownerUserId,
            productId,
            new UploadSellerProductImagesRequest
            {
                Images = BuildImageInputs(urls),
                ReplaceExisting = true,
            },
            cancellationToken);
    }

    /// <summary>
    /// The row's photos as URLs: the links it typed, then anything it pasted.
    ///
    /// Uploading happens here rather than while planning, so a preview stays a
    /// read: a seller who looks at the plan and walks away has uploaded nothing.
    /// The result is written back onto the row, because create and update each
    /// ask for it and the picture must not be sent twice.
    /// </summary>
    private async Task<List<string>> ResolveImageUrlsAsync(
        PlannedRow row,
        CancellationToken cancellationToken)
    {
        if (row.ImageFiles.Count == 0) return row.ImageUrls;

        var uploaded = new List<string>(row.ImageFiles.Count);
        foreach (var file in row.ImageFiles)
            uploaded.Add(await _images.SaveAsync(file, cancellationToken));

        row.ImageUrls = [.. row.ImageUrls, .. uploaded];
        row.ImageFiles = [];
        return row.ImageUrls;
    }

    /// <summary>
    /// The variants to write, with every pasted picture turned into a URL first.
    /// Null when the file said nothing about this product's configurations.
    /// </summary>
    private async Task<List<SellerProductVariantInput>?> ResolveVariantInputsAsync(
        PlannedRow row,
        CancellationToken cancellationToken)
    {
        if (row.Variants is null) return null;

        var inputs = new List<SellerProductVariantInput>(row.Variants.Count);

        foreach (var variant in row.Variants)
        {
            if (variant.ImageUrl is null && variant.ImageFile is not null)
                variant.ImageUrl = await _images.SaveAsync(variant.ImageFile, cancellationToken);

            inputs.Add(new SellerProductVariantInput
            {
                VariantId = variant.VariantId,
                Sku = variant.Sku,
                // Left blank so the API derives "Pink / 256GB" - one place decides the format.
                VariantName = null,
                Attributes = variant.Attributes,
                Price = variant.Price,
                SalePrice = variant.SalePrice,
                ImageUrl = variant.ImageUrl,
                SortOrder = variant.SortOrder,
                IsActive = variant.IsActive,
            });
        }

        return inputs;
    }

    private static List<SellerProductVariantOptionInput>? BuildVariantOptions(PlannedRow row) =>
        row.Variants is null
            ? null
            : row.VariantOptions
                .Select(axis => new SellerProductVariantOptionInput
                {
                    Name = axis.Name,
                    Values = axis.Values.ToList(),
                })
                .ToList();

    private async Task<CreateSellerProductRequest> BuildCreateRequestAsync(
        PlannedRow row,
        CancellationToken cancellationToken)
    {
        var urls = await ResolveImageUrlsAsync(row, cancellationToken);
        var variants = await ResolveVariantInputsAsync(row, cancellationToken);
        return BuildCreateRequest(row, urls, variants);
    }

    private async Task<UpdateSellerProductRequest> BuildUpdateRequestAsync(
        PlannedRow row,
        CancellationToken cancellationToken)
    {
        var variants = await ResolveVariantInputsAsync(row, cancellationToken);
        return BuildUpdateRequest(row, variants);
    }

    private static CreateSellerProductRequest BuildCreateRequest(
        PlannedRow row,
        IReadOnlyList<string> imageUrls,
        List<SellerProductVariantInput>? variants) => new()
    {
        CategoryId = row.CategoryId!.Value,
        Name = row.Name!,
        Slug = row.Slug!,
        ShortDescription = row.ShortDescription,
        Description = row.Description,
        Brand = row.Brand,
        ModelNumber = row.ModelNumber,
        ConditionType = row.Condition!,
        BasePrice = row.BasePrice!.Value,
        SalePrice = row.SalePrice,
        WarrantyMonths = row.WarrantyMonths,
        OriginCountry = row.OriginCountry,
        TagsJson = row.TagsJson,
        SpecsJson = row.SpecsJson,
        Images = imageUrls.Count == 0 ? null : BuildImageInputs(imageUrls),
        VariantOptions = variants is null ? null : BuildVariantOptions(row),
        Variants = variants,
    };

    private static UpdateSellerProductRequest BuildUpdateRequest(
        PlannedRow row,
        List<SellerProductVariantInput>? variants) => new()
    {
        CategoryId = row.CategoryId!.Value,
        Name = row.Name!,
        Slug = row.Slug!,
        ShortDescription = row.ShortDescription,
        Description = row.Description,
        Brand = row.Brand,
        ModelNumber = row.ModelNumber,
        ConditionType = row.Condition!,
        BasePrice = row.BasePrice!.Value,
        SalePrice = row.SalePrice,
        WarrantyMonths = row.WarrantyMonths,
        OriginCountry = row.OriginCountry,
        TagsJson = row.TagsJson,
        SpecsJson = row.SpecsJson,
        // Null leaves the product's configurations alone, which is what a file with
        // no Variants sheet has to mean.
        VariantOptions = variants is null ? null : BuildVariantOptions(row),
        Variants = variants,
    };

    private static List<SellerProductImageInput> BuildImageInputs(IReadOnlyList<string> urls) =>
        urls.Select((url, index) => new SellerProductImageInput
        {
            ImageUrl = url,
            SortOrder = index,
            IsPrimary = index == 0,
        }).ToList();

    private static SellerProductImportRowDto ToDto(PlannedRow row) => new()
    {
        RowNumber = row.RowNumber,
        Name = row.Name,
        Slug = row.Slug,
        Action = row.Action,
        ProductId = row.ProductId,
        CategoryName = row.CategoryName,
        BasePrice = row.BasePrice,
        Errors = row.Errors.ToList(),
    };

    private static SellerInventoryImportRowDto ToDto(PlannedStockRow row) => new()
    {
        RowNumber = row.RowNumber,
        Slug = row.Slug,
        ProductName = row.ProductName,
        VariantSku = row.VariantSku,
        Action = row.Action,
        Quantity = row.Quantity,
        UnitCost = row.UnitCost,
        Errors = row.Errors.ToList(),
    };

    /* ---------------------------------------------------------- cell parsing */

    /// <summary>
    /// Sellers paste prices out of other systems, so "29.990.000", "29,990,000"
    /// and "29990000 d" all have to mean the same number. Any separator is
    /// dropped except a single decimal point with one or two digits behind it.
    /// </summary>
    private static bool TryParseMoney(string raw, out decimal value)
    {
        value = 0m;

        var cleaned = new string(raw.Where(c => char.IsDigit(c) || c is '.' or ',' or '-').ToArray());
        if (cleaned.Length == 0) return false;

        var negative = cleaned.StartsWith('-');
        cleaned = cleaned.Replace("-", string.Empty);

        // The last separator is a decimal point only when 1-2 digits follow it.
        var lastSeparator = cleaned.LastIndexOfAny(['.', ',']);
        var fractionDigits = lastSeparator < 0 ? -1 : cleaned.Length - lastSeparator - 1;

        string normalized;
        if (fractionDigits is 1 or 2)
        {
            var whole = cleaned[..lastSeparator].Replace(".", string.Empty).Replace(",", string.Empty);
            normalized = $"{whole}.{cleaned[(lastSeparator + 1)..]}";
        }
        else
        {
            normalized = cleaned.Replace(".", string.Empty).Replace(",", string.Empty);
        }

        if (!decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out value))
            return false;

        if (negative) value = -value;
        return true;
    }

    private static string? Bounded(string? raw, string label, int max, List<string> errors)
    {
        var trimmed = raw?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed)) return null;

        if (trimmed.Length > max)
        {
            errors.Add($"{label} must not exceed {max} characters.");
            return null;
        }

        return trimmed;
    }

    /// <summary>Accepts "a, b" and a raw JSON array, so an export from anywhere still loads.</summary>
    private static string? BuildTagsJson(string? raw, List<string> errors)
    {
        var trimmed = raw?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed)) return null;

        string json;
        if (trimmed.StartsWith('['))
        {
            if (!IsValidJson(trimmed))
            {
                errors.Add("Tags looks like JSON but is not valid. Use a comma separated list instead.");
                return null;
            }
            json = trimmed;
        }
        else
        {
            var tags = trimmed
                .Split([',', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (tags.Count == 0) return null;
            json = JsonSerializer.Serialize(tags);
        }

        if (json.Length > SellerProductConstants.MaxTagsJsonLength)
        {
            errors.Add($"Tags is too long ({json.Length} characters as stored; the limit is {SellerProductConstants.MaxTagsJsonLength}).");
            return null;
        }

        return json;
    }

    /// <summary>Accepts "ram=12GB; storage=256GB" and a raw JSON object.</summary>
    private static string? BuildSpecsJson(string? raw, List<string> errors)
    {
        var trimmed = raw?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed)) return null;

        string json;
        if (trimmed.StartsWith('{'))
        {
            if (!IsValidJson(trimmed))
            {
                errors.Add("Specs looks like JSON but is not valid. Use name=value pairs separated by semicolons instead.");
                return null;
            }
            json = trimmed;
        }
        else
        {
            var specs = new Dictionary<string, string>(StringComparer.Ordinal);

            foreach (var pair in trimmed.Split([';', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var separator = pair.IndexOf('=');
                if (separator <= 0)
                {
                    errors.Add($"Specs entry \"{pair}\" is not a name=value pair.");
                    return null;
                }

                var key = pair[..separator].Trim();
                if (key.Length == 0)
                {
                    errors.Add($"Specs entry \"{pair}\" has no name.");
                    return null;
                }

                specs[key] = pair[(separator + 1)..].Trim();
            }

            if (specs.Count == 0) return null;
            json = JsonSerializer.Serialize(specs);
        }

        if (json.Length > SellerProductConstants.MaxSpecsJsonLength)
        {
            errors.Add($"Specs is too long ({json.Length} characters as stored; the limit is {SellerProductConstants.MaxSpecsJsonLength}).");
            return null;
        }

        return json;
    }

    private static List<string> SplitImageUrls(string? raw) =>
        string.IsNullOrWhiteSpace(raw)
            ? []
            : [.. raw.Split(ListSeparators, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)];

    /// <summary>
    /// A row that leaves the ImageUrls cell exactly as the export wrote it is not
    /// changing anything, so it must not be judged against rules the stored value
    /// may already break. Without this, exporting a catalogue and importing it
    /// back untouched would fail on every product whose images are not absolute
    /// URLs.
    /// </summary>
    private async Task ValidateImagesAsync(List<PlannedRow> rows, CancellationToken cancellationToken)
    {
        var updateIds = rows
            .Where(r => r.ProductId is not null && r.ImageUrls.Count > 0)
            .Select(r => r.ProductId!.Value)
            .Distinct()
            .ToList();

        var existing = updateIds.Count == 0
            ? new Dictionary<Guid, IReadOnlyList<string>>()
            : await _repository.ListImageUrlsAsync(updateIds, cancellationToken);

        foreach (var row in rows)
        {
            foreach (var file in row.ImageFiles)
                ValidateSheetImage(file, "the product's photo", row.Errors);

            if (row.ImageUrls.Count == 0 && row.ImageFiles.Count == 0) continue;

            if (row.ImageFiles.Count == 0 &&
                row.ProductId is { } productId &&
                existing.TryGetValue(productId, out var current) &&
                row.ImageUrls.SequenceEqual(current, StringComparer.Ordinal))
            {
                // Unchanged, so an empty list here means "leave the photos alone".
                // A pasted picture is never "unchanged": it is a photo the product
                // does not have yet.
                row.ImageUrls = [];
                continue;
            }

            foreach (var url in row.ImageUrls)
            {
                if (!HttpUrlRegex.IsMatch(url))
                    row.Errors.Add($"Image URL \"{url}\" must start with http:// or https://.");
                else if (url.Length > SellerProductConstants.MaxImageUrlLength)
                    row.Errors.Add($"An image URL exceeds {SellerProductConstants.MaxImageUrlLength} characters.");
            }

            if (row.ImageUrls.Count + row.ImageFiles.Count > SellerProductConstants.MaxImagesPerProduct)
            {
                row.Errors.Add(
                    $"A product can have at most {SellerProductConstants.MaxImagesPerProduct} images.");
            }

            if (row.Errors.Count > 0)
            {
                row.Action = ActionError;
                row.ProductId = null;
            }
        }
    }

    /// <summary>
    /// What can be said about a pasted picture without touching the network. The
    /// upload itself waits for the import, so a preview never costs anything.
    /// </summary>
    private void ValidateSheetImage(SheetImage image, string what, List<string> errors)
    {
        if (!_images.IsConfigured)
        {
            errors.Add(
                $"A picture is pasted on this row for {what}, but this server has no image host " +
                "configured. Put an http(s) link in the cell instead.");
            return;
        }

        if (image.Content.Length == 0)
        {
            errors.Add($"The picture pasted for {what} is empty.");
            return;
        }

        if (image.Content.Length > _images.MaxBytes)
        {
            errors.Add(
                $"The picture pasted for {what} is {image.Content.Length / 1024f / 1024f:0.#} MB; " +
                $"the limit is {_images.MaxBytes / 1024 / 1024} MB.");
            return;
        }

        if (!_images.AllowedExtensions.Contains(image.Extension))
        {
            errors.Add(
                $"The picture pasted for {what} is a .{image.Extension} file. " +
                $"Use one of: {string.Join(", ", _images.AllowedExtensions.OrderBy(e => e))}.");
        }
    }

    private static bool IsValidJson(string value)
    {
        try
        {
            using var _ = JsonDocument.Parse(value);
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static string? TagsJsonToText(string? tagsJson)
    {
        if (string.IsNullOrWhiteSpace(tagsJson)) return null;

        try
        {
            var tags = JsonSerializer.Deserialize<List<JsonElement>>(tagsJson);
            if (tags is null) return tagsJson;

            return string.Join(
                ", ",
                tags.Where(t => t.ValueKind is not (JsonValueKind.Object or JsonValueKind.Array))
                    .Select(t => t.ToString()));
        }
        catch (JsonException)
        {
            // Round-tripping something unreadable beats dropping it silently.
            return tagsJson;
        }
    }

    private static string? SpecsJsonToText(string? specsJson)
    {
        if (string.IsNullOrWhiteSpace(specsJson)) return null;

        try
        {
            using var doc = JsonDocument.Parse(specsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return specsJson;

            var pairs = doc.RootElement.EnumerateObject()
                .Where(p => p.Value.ValueKind is not (JsonValueKind.Object or JsonValueKind.Array))
                .Select(p => $"{p.Name}={p.Value}")
                .ToList();

            return pairs.Count == 0 ? specsJson : string.Join("; ", pairs);
        }
        catch (JsonException)
        {
            return specsJson;
        }
    }

    /// <summary>
    /// "Điện thoại Galaxy S24" has to become "dien-thoai-galaxy-s24" - a slug the
    /// service will accept and a URL a buyer can read.
    /// </summary>
    private static string Slugify(string name)
    {
        var decomposed = name.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);

        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
                continue;

            builder.Append(ch is 'đ' or 'Đ' ? 'd' : char.ToLowerInvariant(ch));
        }

        var ascii = builder.ToString().Normalize(NormalizationForm.FormC);
        var slug = Regex.Replace(ascii, "[^a-z0-9]+", "-").Trim('-');

        return slug.Length > SellerProductConstants.MaxSlugLength
            ? slug[..SellerProductConstants.MaxSlugLength].Trim('-')
            : slug;
    }

    /* ----------------------------------------------------------- categories */

    private async Task<CategoryLookup> LoadCategoriesAsync(CancellationToken cancellationToken)
    {
        var options = await _repository.ListActiveCategoryOptionsAsync(cancellationToken);
        return new CategoryLookup(options);
    }

    private async Task<SellerShopRecord> RequireShopAsync(Guid ownerUserId, CancellationToken cancellationToken) =>
        await _repository.GetActiveShopByOwnerAsync(ownerUserId, cancellationToken)
            ?? throw new NotFoundException("You do not have an active shop.");

    /// <summary>
    /// Mirrors the list screen's own status filter so the export matches what the
    /// seller can see, including its "all" and blank shorthands.
    /// </summary>
    private static (string? Status, bool IncludeDeleted) ParseExportStatus(string? status)
    {
        var trimmed = status?.Trim();

        if (string.IsNullOrWhiteSpace(trimmed))
            return (null, false);

        if (string.Equals(trimmed, "all", StringComparison.OrdinalIgnoreCase))
            return (null, true);

        var match = SellerProductConstants.AllowedStatuses
            .FirstOrDefault(s => s.Equals(trimmed, StringComparison.OrdinalIgnoreCase))
            ?? throw new AppException($"Unknown product status \"{trimmed}\".");

        return (match, match == SellerProductConstants.StatusDeleted);
    }

    private sealed class CategoryLookup
    {
        private readonly Dictionary<int, string> _paths = new();
        private readonly Dictionary<string, List<int>> _byText =
            new(StringComparer.OrdinalIgnoreCase);

        public CategoryLookup(IReadOnlyList<SellerCategoryOptionRecord> options)
        {
            var byId = options.ToDictionary(o => o.CategoryId);

            foreach (var option in options)
            {
                var path = BuildPath(option, byId);
                _paths[option.CategoryId] = path;

                // Both the leaf name and the full path are offered, because the
                // sheet is hand-edited and people write whichever they have.
                Index(option.Name, option.CategoryId);
                if (!string.Equals(path, option.Name, StringComparison.OrdinalIgnoreCase))
                    Index(path, option.CategoryId);
            }

            Choices = options
                .Select(o => new SellerCategoryChoice { CategoryId = o.CategoryId, Path = _paths[o.CategoryId] })
                .OrderBy(c => c.Path, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        public IReadOnlyList<SellerCategoryChoice> Choices { get; }

        public string? PathOf(int categoryId) => _paths.GetValueOrDefault(categoryId);

        public IReadOnlyList<int> FindByText(string text)
        {
            var key = NormalizePathText(text);
            return _byText.TryGetValue(key, out var ids) ? ids : [];
        }

        private void Index(string text, int categoryId)
        {
            var key = NormalizePathText(text);
            if (key.Length == 0) return;

            if (!_byText.TryGetValue(key, out var ids))
                _byText[key] = ids = [];

            if (!ids.Contains(categoryId)) ids.Add(categoryId);
        }

        /// <summary>"Phones>Samsung" and "Phones &gt; Samsung " are the same path.</summary>
        private static string NormalizePathText(string text) =>
            string.Join(
                " > ",
                text.Split(['>', '/'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));

        private static string BuildPath(
            SellerCategoryOptionRecord option,
            IReadOnlyDictionary<int, SellerCategoryOptionRecord> byId)
        {
            var parts = new List<string> { option.Name };
            var parentId = option.ParentId;

            // Depth is small, but a bad row in the table must not spin forever.
            for (var guard = 0; parentId is { } id && guard < 10; guard++)
            {
                if (!byId.TryGetValue(id, out var parent)) break;
                parts.Insert(0, parent.Name);
                parentId = parent.ParentId;
            }

            return string.Join(" > ", parts);
        }
    }

    /// <summary>One Inventory row, decided but not yet written.</summary>
    private sealed class PlannedStockRow
    {
        public int RowNumber { get; init; }
        public string Action { get; set; } = null!;
        public string? Slug { get; set; }
        public string? ProductName { get; set; }
        public Guid? ProductId { get; set; }
        public string? VariantSku { get; set; }
        public Guid? VariantId { get; set; }
        public int? Quantity { get; set; }
        public decimal? UnitCost { get; set; }
        public string? LotCode { get; set; }
        public string? SupplierName { get; set; }
        public string? InvoiceNumber { get; set; }
        public DateTime? ReceivedAt { get; set; }
        public string? Note { get; set; }
        public List<string> Errors { get; } = [];
    }

    /// <summary>One row of the Variants sheet, once it has been understood.</summary>
    private sealed class PlannedVariant
    {
        public int RowNumber { get; init; }

        /// <summary>The existing variant this row updates, if the product already has one.</summary>
        public Guid? VariantId { get; set; }

        public string? Sku { get; init; }
        public Dictionary<string, string> Attributes { get; init; } = [];
        public decimal Price { get; init; }
        public decimal? SalePrice { get; init; }
        public string? ImageUrl { get; set; }
        public SheetImage? ImageFile { get; init; }
        public bool IsActive { get; init; }
        public int SortOrder { get; init; }
    }

    private sealed class ImportPlan
    {
        public ImportPlan(List<PlannedRow> rows, List<string> warnings, List<PlannedStockRow> stockRows)
        {
            Rows = rows;
            Warnings = warnings;
            StockRows = stockRows;
        }

        public List<PlannedRow> Rows { get; }

        public IReadOnlyList<string> Warnings { get; }

        public List<PlannedStockRow> StockRows { get; }

        /// <summary>
        /// The id a slug ended up with, for stock rows planned before the product
        /// existed. Null means the row that would have created it never succeeded.
        /// </summary>
        public Guid? CreatedIdFor(string slug) =>
            Rows.FirstOrDefault(r =>
                r.ProductId is not null &&
                string.Equals(r.Slug, slug, StringComparison.OrdinalIgnoreCase))?.ProductId;

        /// <summary>
        /// Once a row has created a product, later rows with the same slug must
        /// update it rather than fail on the shop's unique slug index.
        /// </summary>
        public void RegisterCreated(
            string slug,
            Guid productId,
            IReadOnlyList<SellerProductVariantDto>? variants = null)
        {
            foreach (var row in Rows)
            {
                if (row.ProductId is null &&
                    row.Action == ActionCreate &&
                    string.Equals(row.Slug, slug, StringComparison.OrdinalIgnoreCase))
                {
                    row.ProductId = productId;
                    row.Action = ActionUpdate;
                }
            }

            foreach (var variant in variants ?? [])
            {
                if (variant.Sku is { Length: > 0 } sku)
                    _createdVariants[Key(slug, sku)] = variant.VariantId;
            }
        }

        /// <summary>The id of a configuration this run created, addressed the way a stock row does.</summary>
        public Guid? CreatedVariantIdFor(string slug, string sku) =>
            _createdVariants.TryGetValue(Key(slug, sku), out var id) ? id : null;

        private readonly Dictionary<string, Guid> _createdVariants = new(StringComparer.OrdinalIgnoreCase);

        private static string Key(string slug, string sku) => $"{slug}|{sku}";
    }

    private sealed class PlannedRow
    {
        public int RowNumber { get; init; }
        public string Action { get; set; } = ActionError;
        public Guid? ProductId { get; set; }
        public string? Name { get; set; }
        public string? Slug { get; set; }
        public int? CategoryId { get; set; }
        public string? CategoryName { get; set; }
        public string? Brand { get; set; }
        public string? ModelNumber { get; set; }
        public string? Condition { get; set; }
        public decimal? BasePrice { get; set; }
        public decimal? SalePrice { get; set; }
        public int? WarrantyMonths { get; set; }
        public string? OriginCountry { get; set; }
        public string? ShortDescription { get; set; }
        public string? Description { get; set; }
        public string? TagsJson { get; set; }
        public string? SpecsJson { get; set; }
        public List<string> ImageUrls { get; set; } = [];

        /// <summary>Pictures pasted onto the row; uploaded during the import, not the preview.</summary>
        public List<SheetImage> ImageFiles { get; set; } = [];

        /// <summary>
        /// Null when the file said nothing about this product's variants, which has to
        /// stay different from an empty list: one leaves the configurations alone, the
        /// other would delete them.
        /// </summary>
        public List<PlannedVariant>? Variants { get; set; }

        /// <summary>The axes the variants are built from, in the order shoppers see them.</summary>
        public List<ProductVariantJson.OptionAxis> VariantOptions { get; set; } = [];

        public List<string> Errors { get; } = [];
    }
}
