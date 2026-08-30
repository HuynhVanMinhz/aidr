using AIDR.Shared.Dtos.Seller;

namespace AIDR.Modules.Profile.Abstractions;

public sealed class SellerRegistrationRecord
{
    public Guid RequestId { get; init; }
    public Guid UserId { get; init; }
    public string ShopName { get; init; } = null!;
    public string? BusinessInfo { get; init; }
    public string? DocumentUrlsJson { get; init; }
    public string Status { get; init; } = null!;
    public string? AdminNote { get; init; }
    public DateTime? ReviewedAt { get; init; }
    public DateTime CreatedAt { get; init; }

    public Guid? KycVerificationId { get; init; }
    public string? BusinessType { get; init; }
    public string? TaxCode { get; init; }
    public string? BusinessAddress { get; init; }
    public string? ContactPhone { get; init; }
    public string? ContactEmail { get; init; }
    public string? LicenseImageUrl { get; init; }
    public DateTime? UpdatedAt { get; init; }
}

/// <summary>Everything the repository needs to write one application.</summary>
public sealed class SellerRegistrationWriteModel
{
    public required string ShopName { get; init; }
    public string? BusinessInfo { get; init; }
    public string? DocumentUrlsJson { get; init; }
    public required Guid KycVerificationId { get; init; }
    public required string BusinessType { get; init; }
    public string? TaxCode { get; init; }
    public string? BusinessAddress { get; init; }
    public string? ContactPhone { get; init; }
    public string? ContactEmail { get; init; }
    public string? LicenseImageUrl { get; init; }
}

public interface ISellerRegistrationRepository
{
    Task<bool> UserHasRoleAsync(
        Guid userId,
        string roleCode,
        CancellationToken cancellationToken = default);

    Task<bool> HasPendingAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<bool> OwnsShopAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<bool> ShopNameTakenAsync(
        string shopName,
        Guid? excludeRequestId = null,
        CancellationToken cancellationToken = default);

    Task<SellerRegistrationRecord> CreateAsync(
        Guid userId,
        SellerRegistrationWriteModel model,
        CancellationToken cancellationToken = default);

    /// <summary>Update an application the applicant is still allowed to change.</summary>
    Task<SellerRegistrationRecord> UpdateAsync(
        Guid requestId,
        SellerRegistrationWriteModel model,
        CancellationToken cancellationToken = default);

    Task<SellerRegistrationRecord?> GetLatestForUserAsync(
        Guid userId,
        CancellationToken cancellationToken = default);
}

public interface ISellerRegistrationService
{
    Task<BuyerSellerRegistrationDto> CreateAsync(
        Guid userId,
        CreateSellerRegistrationRequest request,
        CancellationToken cancellationToken = default);

    Task<BuyerSellerRegistrationDto> UpdateMineAsync(
        Guid userId,
        CreateSellerRegistrationRequest request,
        CancellationToken cancellationToken = default);

    Task<BuyerSellerRegistrationDto> GetMineAsync(
        Guid userId,
        CancellationToken cancellationToken = default);
}
