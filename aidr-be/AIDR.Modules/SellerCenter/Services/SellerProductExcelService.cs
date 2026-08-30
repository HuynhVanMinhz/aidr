using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Seller;
using AIDR.Shared.Exceptions;

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
    private readonly ISellerProductWorkbook _workbook;

    public SellerProductExcelService(
        ISellerProductRepository repository,
        ISellerProductService products,
        ISellerProductWorkbook workbook)
    {
        _repository = repository;
        _products = products;
        _workbook = workbook;
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

        return _workbook.WriteProducts(exports, categories.Choices);
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

        return new SellerProductImportPreviewDto
        {
            TotalRows = plan.Rows.Count,
            CreateCount = plan.Rows.Count(r => r.Action == ActionCreate),
            UpdateCount = plan.Rows.Count(r => r.Action == ActionUpdate),
            ErrorCount = plan.Rows.Count(r => r.Action == ActionError),
            Warnings = plan.Warnings,
            Rows = plan.Rows.Select(ToDto).ToList(),
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
                        BuildUpdateRequest(row),
                        cancellationToken);

                    await ApplyImagesAsync(ownerUserId, productId, row, cancellationToken);
                    updated++;
                }
                else
                {
                    var detail = await _products.CreateAsync(
                        ownerUserId,
                        BuildCreateRequest(row),
                        cancellationToken);

                    created++;

                    // The slug is now taken, so a later duplicate row in the same
                    // sheet updates this product instead of colliding with it.
                    plan.RegisterCreated(row.Slug!, detail.ProductId);
                }
            }
            catch (AppException ex)
            {
                // NotFoundException and ConflictException are both AppException, so
                // one catch covers every rule the product service enforces.
                failed.Add(ToDto(row) with { Errors = [ex.Message] });
            }
        }

        return new SellerProductImportResultDto
        {
            Created = created,
            Updated = updated,
            Failed = failed.Count,
            FailedRows = failed,
        };
    }

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
        var sheetRows = _workbook.Read(file);

        if (sheetRows.Count == 0)
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

        return new ImportPlan(planned, warnings);
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

        /* slug — blank means "derive one", which is what most sellers expect */
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

        /* category — the id wins, the name is the fallback */
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
            errors.Add("CategoryId is required — copy one from the Categories sheet.");
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
        // A blank ImageUrls cell on an update means "leave the photos alone".
        // Reading it as "delete every photo" would destroy uploads that the
        // spreadsheet has no way to put back.
        if (row.ImageUrls.Count == 0) return;

        await _products.UploadImagesAsync(
            ownerUserId,
            productId,
            new UploadSellerProductImagesRequest
            {
                Images = BuildImageInputs(row.ImageUrls),
                ReplaceExisting = true,
            },
            cancellationToken);
    }

    private static CreateSellerProductRequest BuildCreateRequest(PlannedRow row) => new()
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
        Images = row.ImageUrls.Count == 0 ? null : BuildImageInputs(row.ImageUrls),
    };

    private static UpdateSellerProductRequest BuildUpdateRequest(PlannedRow row) => new()
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
            if (row.ImageUrls.Count == 0) continue;

            if (row.ProductId is { } productId &&
                existing.TryGetValue(productId, out var current) &&
                row.ImageUrls.SequenceEqual(current, StringComparer.Ordinal))
            {
                // Unchanged, so an empty list here means "leave the photos alone".
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

            if (row.ImageUrls.Count > SellerProductConstants.MaxImagesPerProduct)
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
    /// "Điện thoại Galaxy S24" has to become "dien-thoai-galaxy-s24" — a slug the
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

    private sealed class ImportPlan
    {
        public ImportPlan(List<PlannedRow> rows, List<string> warnings)
        {
            Rows = rows;
            Warnings = warnings;
        }

        public List<PlannedRow> Rows { get; }

        public IReadOnlyList<string> Warnings { get; }

        /// <summary>
        /// Once a row has created a product, later rows with the same slug must
        /// update it rather than fail on the shop's unique slug index.
        /// </summary>
        public void RegisterCreated(string slug, Guid productId)
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
        }
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
        public List<string> Errors { get; } = [];
    }
}
