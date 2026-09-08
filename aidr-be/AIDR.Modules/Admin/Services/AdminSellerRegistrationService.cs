using System.Text.Json;
using System.Text.RegularExpressions;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Modules.Kyc.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Admin.Services;

public sealed class AdminSellerRegistrationService : IAdminSellerRegistrationService
{
    private static readonly HashSet<string> AllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        AdminConstants.SellerRegistrationStatusPending,
        AdminConstants.SellerRegistrationStatusApproved,
        AdminConstants.SellerRegistrationStatusRejected,
        SellerRegistrationConstants.StatusNeedsMoreInfo
    };

    private static readonly Regex NonSlugChars = new(
        @"[^a-z0-9]+",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private readonly IAdminSellerRegistrationRepository _repository;
    private readonly IKycRepository _kyc;

    public AdminSellerRegistrationService(
        IAdminSellerRegistrationRepository repository,
        IKycRepository kyc)
    {
        _repository = repository;
        _kyc = kyc;
    }

    public async Task<AdminSellerRegistrationListResultDto> ListAsync(
        string? status,
        string? q,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeStatusFilter(status);
        var (normalizedPage, normalizedPageSize) = AdminConstants.NormalizePaging(page, pageSize);
        var keyword = NormalizeSearch(q);

        var (items, totalCount, effectivePage, summary) = await _repository.ListPagedAsync(
            normalized,
            keyword,
            normalizedPage,
            normalizedPageSize,
            cancellationToken);

        return new AdminSellerRegistrationListResultDto
        {
            Items = items.Select(r => Map(r)).ToList(),
            Page = effectivePage,
            PageSize = normalizedPageSize,
            TotalCount = totalCount,
            PendingCount = summary.PendingCount,
            ApprovedCount = summary.ApprovedCount,
            RejectedCount = summary.RejectedCount
        };
    }

    public async Task<AdminSellerRegistrationDto> GetByIdAsync(
        Guid requestId,
        CancellationToken cancellationToken = default)
    {
        EnsureRequestId(requestId);

        var record = await _repository.GetByIdAsync(requestId, cancellationToken)
            ?? throw new NotFoundException("Seller registration request not found.");

        // The reviewer needs the identity check next to the paperwork. Applications
        // filed before the applicant verified carry no link, so fall back to the
        // person's own latest check rather than showing nothing.
        var kycId = record.KycVerificationId ?? record.LatestKycVerificationId;
        var kyc = kycId is { } id
            ? await _kyc.GetByIdAsync(id, cancellationToken)
            : null;

        DuplicateIdentityWarningDto? duplicateWarning = null;
        if (kycId is { } linkedKycId)
        {
            var match = await _kyc.FindDuplicateApprovedSellerForVerificationAsync(
                linkedKycId,
                record.UserId,
                cancellationToken);

            if (match is not null)
            {
                duplicateWarning = new DuplicateIdentityWarningDto
                {
                    HasDuplicate = true,
                    Message = "This identity is linked to another approved seller account.",
                    MatchedUserId = match.UserId,
                    MatchedUserEmail = match.UserEmail,
                    MatchedShopId = match.ShopId,
                    MatchedShopName = match.ShopName
                };
            }
        }

        return Map(record, kyc, duplicateWarning);
    }

    public async Task<ApproveSellerRegistrationResultDto> ApproveAsync(
        Guid requestId,
        Guid adminUserId,
        CancellationToken cancellationToken = default)
    {
        EnsureRequestId(requestId);
        EnsureUserId(adminUserId, "Admin user id");

        var existing = await _repository.GetByIdAsync(requestId, cancellationToken)
            ?? throw new NotFoundException("Seller registration request not found.");

        if (!string.Equals(
                existing.Status,
                AdminConstants.SellerRegistrationStatusPending,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException("Only pending seller registration requests can be approved.");
        }

        var slug = await BuildUniqueSlugAsync(existing.ShopName, cancellationToken);
        var shortDescription = Truncate(
            existing.BusinessInfo?.Trim(),
            AdminConstants.MaxShopShortDescriptionLength);

        var result = await _repository.ApproveAsync(
            requestId,
            adminUserId,
            slug,
            shortDescription,
            cancellationToken);

        return new ApproveSellerRegistrationResultDto
        {
            Request = Map(result.Request),
            ShopId = result.ShopId,
            WalletId = result.WalletId
        };
    }

    public async Task<AdminSellerRegistrationDto> RejectAsync(
        Guid requestId,
        Guid adminUserId,
        RejectSellerRegistrationRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureRequestId(requestId);
        EnsureUserId(adminUserId, "Admin user id");

        var note = RequireAdminNote(request.AdminNote);

        var existing = await _repository.GetByIdAsync(requestId, cancellationToken)
            ?? throw new NotFoundException("Seller registration request not found.");

        if (!string.Equals(
                existing.Status,
                AdminConstants.SellerRegistrationStatusPending,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException("Only pending seller registration requests can be rejected.");
        }

        var record = await _repository.RejectAsync(requestId, adminUserId, note, cancellationToken);
        return Map(record);
    }

    public async Task<AdminSellerRegistrationDto> RequestMoreInfoAsync(
        Guid requestId,
        Guid adminUserId,
        RequestMoreInfoRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureRequestId(requestId);
        EnsureUserId(adminUserId, "Admin user id");

        if (request is null)
            throw new AppException("A note is required so the applicant knows what to fix.");

        var note = RequireAdminNote(request.AdminNote);

        var existing = await _repository.GetByIdAsync(requestId, cancellationToken)
            ?? throw new NotFoundException("Seller registration request not found.");

        if (!string.Equals(
                existing.Status,
                AdminConstants.SellerRegistrationStatusPending,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException(
                "Only pending seller registration requests can be sent back for more information.");
        }

        var record = await _repository.RequestMoreInfoAsync(
            requestId,
            adminUserId,
            note,
            cancellationToken);

        return Map(record);
    }

    private async Task<string> BuildUniqueSlugAsync(string shopName, CancellationToken cancellationToken)
    {
        var baseSlug = Slugify(shopName);
        if (string.IsNullOrWhiteSpace(baseSlug))
            baseSlug = "shop";

        if (baseSlug.Length > AdminConstants.MaxShopSlugLength)
            baseSlug = baseSlug[..AdminConstants.MaxShopSlugLength].Trim('-');

        var candidate = baseSlug;
        var suffix = 0;
        while (await _repository.SlugExistsAsync(candidate, cancellationToken))
        {
            suffix++;
            var suffixText = $"-{suffix}";
            var maxBase = AdminConstants.MaxShopSlugLength - suffixText.Length;
            var trimmedBase = baseSlug.Length > maxBase
                ? baseSlug[..maxBase].Trim('-')
                : baseSlug;
            candidate = $"{trimmedBase}{suffixText}";
        }

        return candidate;
    }

    private static string? NormalizeStatusFilter(string? status)
    {
        if (string.IsNullOrWhiteSpace(status) ||
            string.Equals(status.Trim(), "all", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var trimmed = status.Trim();
        var match = AllowedStatuses.FirstOrDefault(s =>
            string.Equals(s, trimmed, StringComparison.OrdinalIgnoreCase));

        if (match is null)
            throw new AppException("Status filter must be Pending, Approved, Rejected, or all.");

        return match;
    }

    private static string RequireAdminNote(string? adminNote)
    {
        var trimmed = adminNote?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new AppException("Admin note is required when rejecting a seller registration.");

        if (trimmed.Length > AdminConstants.MaxSellerAdminNoteLength)
        {
            throw new AppException(
                $"Admin note must not exceed {AdminConstants.MaxSellerAdminNoteLength} characters.");
        }

        return trimmed;
    }

    private static void EnsureRequestId(Guid requestId)
    {
        if (requestId == Guid.Empty)
            throw new AppException("Request id is required.");
    }

    private static void EnsureUserId(Guid userId, string fieldName)
    {
        if (userId == Guid.Empty)
            throw new AppException($"{fieldName} is required.");
    }

    private static string Slugify(string value)
    {
        var lower = value.Trim().ToLowerInvariant();
        var slug = NonSlugChars.Replace(lower, "-").Trim('-');
        return slug;
    }

    private static string? Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private static string? NormalizeSearch(string? q)
    {
        if (string.IsNullOrWhiteSpace(q))
            return null;

        var trimmed = q.Trim();
        if (trimmed.Length > AdminConstants.MaxListSearchLength)
        {
            throw new AppException(
                $"Search query must not exceed {AdminConstants.MaxListSearchLength} characters.");
        }

        return trimmed;
    }

    private static IReadOnlyList<string> ParseDocumentUrls(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return Array.Empty<string>();

        try
        {
            var urls = JsonSerializer.Deserialize<List<string>>(json);
            return urls?
                .Where(u => !string.IsNullOrWhiteSpace(u))
                .Select(u => u.Trim())
                .ToList()
                ?? (IReadOnlyList<string>)Array.Empty<string>();
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }

    private static AdminSellerRegistrationDto Map(
        AdminSellerRegistrationRecord record,
        AIDR.Shared.Dtos.Kyc.KycVerificationDto? kyc = null,
        DuplicateIdentityWarningDto? duplicateIdentityWarning = null) => new()
    {
        Kyc = kyc,
        DuplicateIdentityWarning = duplicateIdentityWarning,
        HasIdentityCheck =
            record.KycVerificationId is not null || record.LatestKycVerificationId is not null,
        KycLinkedToApplication = record.KycVerificationId is not null,
        KycStatus = record.KycVerificationId is not null
            ? kyc?.Status
            : record.LatestKycStatus,
        RequestId = record.RequestId,
        UserId = record.UserId,
        UserEmail = record.UserEmail,
        UserFullName = record.UserFullName,
        ShopName = record.ShopName,
        BusinessInfo = record.BusinessInfo,
        DocumentUrls = ParseDocumentUrls(record.DocumentUrlsJson),
        Status = record.Status,
        AdminNote = record.AdminNote,
        ReviewedBy = record.ReviewedBy,
        ReviewerFullName = record.ReviewerFullName,
        ReviewedAt = record.ReviewedAt,
        CreatedAt = record.CreatedAt,
        ShopId = record.ShopId,
        BusinessType = record.BusinessType,
        TaxCode = record.TaxCode,
        BusinessAddress = record.BusinessAddress,
        ContactPhone = record.ContactPhone,
        ContactEmail = record.ContactEmail,
        LicenseImageUrl = record.LicenseImageUrl
    };
}
