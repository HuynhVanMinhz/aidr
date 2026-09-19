using AIDR.Modules.Admin.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Exceptions;
using AIDR.Shared.Serialization;

namespace AIDR.Modules.Admin.Services;

public sealed class AdminSystemVoucherService : IAdminSystemVoucherService
{
    private readonly IAdminSystemVoucherRepository _repository;

    public AdminSystemVoucherService(IAdminSystemVoucherRepository repository) =>
        _repository = repository;

    public async Task<AdminSystemVoucherListResultDto> ListAsync(
        string? q,
        bool? isActive,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var (normalizedPage, normalizedPageSize) = VoucherConstants.NormalizeAdminPaging(page, pageSize);
        var keyword = NormalizeSearch(q);
        var now = DateTime.UtcNow;

        var (items, totalCount, effectivePage, summary) = await _repository.ListPagedAsync(
            keyword,
            isActive,
            normalizedPage,
            normalizedPageSize,
            now,
            cancellationToken);

        return new AdminSystemVoucherListResultDto
        {
            Items = items.Select(Map).ToList(),
            Page = effectivePage,
            PageSize = normalizedPageSize,
            TotalCount = totalCount,
            ActiveCount = summary.ActiveCount,
            InactiveCount = summary.InactiveCount,
            ExpiredCount = summary.ExpiredCount
        };
    }

    public async Task<AdminSystemVoucherDto> GetByIdAsync(
        Guid voucherId,
        CancellationToken cancellationToken = default)
    {
        EnsureVoucherId(voucherId);
        var record = await _repository.GetByIdAsync(voucherId, cancellationToken)
            ?? throw new NotFoundException("System voucher not found.");
        EnsureSystemScope(record);
        return Map(record);
    }

    public async Task<AdminSystemVoucherDto> CreateAsync(
        Guid adminUserId,
        CreateSystemVoucherRequest request,
        CancellationToken cancellationToken = default)
    {
        if (adminUserId == Guid.Empty)
            throw new AppException("Admin user id is required.");

        var code = RequireCode(request.Code);
        var name = RequireName(request.Name);
        var description = NormalizeDescription(request.Description);
        var discountType = RequireDiscountType(request.DiscountType);
        ValidateDiscountFields(
            discountType,
            request.DiscountValue,
            request.MaxDiscountAmount,
            request.MinOrderAmount,
            request.UsageLimit,
            request.PerUserLimit);
        ValidatePeriod(request.StartsAt, request.EndsAt);

        if (await _repository.CodeExistsAsync(code, cancellationToken: cancellationToken))
            throw new ConflictException("Voucher code already exists.");

        var record = await _repository.CreateAsync(
            code,
            name,
            description,
            discountType,
            decimal.Round(request.DiscountValue, 2, MidpointRounding.AwayFromZero),
            request.MaxDiscountAmount is null
                ? null
                : decimal.Round(request.MaxDiscountAmount.Value, 2, MidpointRounding.AwayFromZero),
            decimal.Round(request.MinOrderAmount, 2, MidpointRounding.AwayFromZero),
            request.UsageLimit,
            request.PerUserLimit,
            UtcDateTime.Normalize(request.StartsAt),
            UtcDateTime.Normalize(request.EndsAt),
            request.IsActive,
            adminUserId,
            cancellationToken);

        return Map(record);
    }

    public async Task<AdminSystemVoucherDto> UpdateAsync(
        Guid voucherId,
        UpdateSystemVoucherRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureVoucherId(voucherId);

        var existing = await _repository.GetByIdAsync(voucherId, cancellationToken)
            ?? throw new NotFoundException("System voucher not found.");
        EnsureSystemScope(existing);

        var name = RequireName(request.Name);
        var description = NormalizeDescription(request.Description);
        var discountType = RequireDiscountType(request.DiscountType);
        ValidateDiscountFields(
            discountType,
            request.DiscountValue,
            request.MaxDiscountAmount,
            request.MinOrderAmount,
            request.UsageLimit,
            request.PerUserLimit);
        ValidatePeriod(request.StartsAt, request.EndsAt);

        if (request.UsageLimit is int usageLimit && usageLimit < existing.UsedCount)
            throw new AppException(
                $"Usage limit cannot be less than the current used count ({existing.UsedCount}).");

        var record = await _repository.UpdateAsync(
            voucherId,
            name,
            description,
            discountType,
            decimal.Round(request.DiscountValue, 2, MidpointRounding.AwayFromZero),
            request.MaxDiscountAmount is null
                ? null
                : decimal.Round(request.MaxDiscountAmount.Value, 2, MidpointRounding.AwayFromZero),
            decimal.Round(request.MinOrderAmount, 2, MidpointRounding.AwayFromZero),
            request.UsageLimit,
            request.PerUserLimit,
            UtcDateTime.Normalize(request.StartsAt),
            UtcDateTime.Normalize(request.EndsAt),
            cancellationToken);

        return Map(record);
    }

    public async Task<AdminSystemVoucherDto> UpdateStatusAsync(
        Guid voucherId,
        UpdateSystemVoucherStatusRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureVoucherId(voucherId);

        var existing = await _repository.GetByIdAsync(voucherId, cancellationToken)
            ?? throw new NotFoundException("System voucher not found.");
        EnsureSystemScope(existing);

        var record = await _repository.UpdateStatusAsync(voucherId, request.IsActive, cancellationToken);
        return Map(record);
    }

    public async Task DeleteAsync(Guid voucherId, CancellationToken cancellationToken = default)
    {
        EnsureVoucherId(voucherId);

        var existing = await _repository.GetByIdAsync(voucherId, cancellationToken)
            ?? throw new NotFoundException("System voucher not found.");
        EnsureSystemScope(existing);

        if (existing.UsedCount > 0 || existing.HasRedemptions || existing.IsReferencedByOrders)
            throw new ConflictException(
                "Voucher has already been used. Disable it instead of deleting.");

        await _repository.DeleteAsync(voucherId, cancellationToken);
    }

    private static AdminSystemVoucherDto Map(AdminSystemVoucherRecord record) => new()
    {
        VoucherId = record.VoucherId,
        Code = record.Code,
        Name = record.Name,
        Description = record.Description,
        Scope = record.Scope,
        DiscountType = record.DiscountType,
        DiscountValue = record.DiscountValue,
        MaxDiscountAmount = record.MaxDiscountAmount,
        MinOrderAmount = record.MinOrderAmount,
        UsageLimit = record.UsageLimit,
        PerUserLimit = record.PerUserLimit,
        UsedCount = record.UsedCount,
        StartsAt = record.StartsAt,
        EndsAt = record.EndsAt,
        IsActive = record.IsActive,
        CreatedBy = record.CreatedBy,
        CreatedByName = record.CreatedByName,
        CreatedAt = record.CreatedAt,
        UpdatedAt = record.UpdatedAt,
        CanDelete = record.UsedCount == 0 && !record.HasRedemptions && !record.IsReferencedByOrders
    };

    private static void EnsureVoucherId(Guid voucherId)
    {
        if (voucherId == Guid.Empty)
            throw new AppException("Voucher id is required.");
    }

    private static void EnsureSystemScope(AdminSystemVoucherRecord record)
    {
        if (!string.Equals(record.Scope, VoucherConstants.ScopeSystem, StringComparison.OrdinalIgnoreCase))
            throw new NotFoundException("System voucher not found.");
    }

    private static string RequireCode(string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new AppException("Voucher code is required.");

        var trimmed = code.Trim().ToUpperInvariant();
        if (trimmed.Length > VoucherConstants.MaxCodeLength)
            throw new AppException($"Voucher code must not exceed {VoucherConstants.MaxCodeLength} characters.");

        if (trimmed.Any(ch => !(char.IsLetterOrDigit(ch) || ch is '-' or '_')))
            throw new AppException("Voucher code may only contain letters, digits, hyphen, and underscore.");

        return trimmed;
    }

    private static string RequireName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new AppException("Voucher name is required.");

        var trimmed = name.Trim();
        if (trimmed.Length > VoucherConstants.MaxNameLength)
            throw new AppException($"Voucher name must not exceed {VoucherConstants.MaxNameLength} characters.");

        return trimmed;
    }

    private static string? NormalizeDescription(string? description)
    {
        if (string.IsNullOrWhiteSpace(description))
            return null;

        var trimmed = description.Trim();
        if (trimmed.Length > VoucherConstants.MaxDescriptionLength)
            throw new AppException(
                $"Description must not exceed {VoucherConstants.MaxDescriptionLength} characters.");

        return trimmed;
    }

    private static string RequireDiscountType(string? discountType)
    {
        if (string.IsNullOrWhiteSpace(discountType))
            throw new AppException("Discount type is required.");

        var trimmed = discountType.Trim();
        if (!VoucherConstants.DiscountTypes.Contains(trimmed))
            throw new AppException("Discount type must be Percent or FixedAmount.");

        return string.Equals(trimmed, VoucherConstants.DiscountTypePercent, StringComparison.OrdinalIgnoreCase)
            ? VoucherConstants.DiscountTypePercent
            : VoucherConstants.DiscountTypeFixedAmount;
    }

    private static void ValidateDiscountFields(
        string discountType,
        decimal discountValue,
        decimal? maxDiscountAmount,
        decimal minOrderAmount,
        int? usageLimit,
        int perUserLimit)
    {
        if (discountValue <= 0)
            throw new AppException("Discount value must be greater than 0.");

        if (string.Equals(discountType, VoucherConstants.DiscountTypePercent, StringComparison.OrdinalIgnoreCase))
        {
            if (discountValue > VoucherConstants.MaxPercentValue)
                throw new AppException("Percent discount must not exceed 100.");
        }

        if (maxDiscountAmount is < 0)
            throw new AppException("Max discount amount cannot be negative.");

        if (maxDiscountAmount is 0)
            throw new AppException("Max discount amount must be greater than 0 when provided.");

        if (minOrderAmount < 0)
            throw new AppException("Minimum order amount cannot be negative.");

        if (usageLimit is <= 0)
            throw new AppException("Usage limit must be greater than 0 when provided.");

        if (perUserLimit < VoucherConstants.MinPerUserLimit ||
            perUserLimit > VoucherConstants.MaxPerUserLimit)
        {
            throw new AppException(
                $"Per-user limit must be between {VoucherConstants.MinPerUserLimit} and {VoucherConstants.MaxPerUserLimit}.");
        }
    }

    private static void ValidatePeriod(DateTime startsAt, DateTime endsAt)
    {
        if (startsAt == default)
            throw new AppException("Start date is required.");

        if (endsAt == default)
            throw new AppException("End date is required.");

        if (endsAt <= startsAt)
            throw new AppException("End date must be after start date.");
    }

    private static string? NormalizeSearch(string? q)
    {
        if (string.IsNullOrWhiteSpace(q))
            return null;

        var trimmed = q.Trim();
        if (trimmed.Length > AdminConstants.MaxListSearchLength)
            throw new AppException(
                $"Search query must not exceed {AdminConstants.MaxListSearchLength} characters.");

        return trimmed;
    }
}
