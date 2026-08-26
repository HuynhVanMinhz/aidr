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
}

public interface ISellerRegistrationRepository
{
    Task<bool> UserHasRoleAsync(
        Guid userId,
        string roleCode,
        CancellationToken cancellationToken = default);

    Task<bool> HasPendingAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<bool> OwnsShopAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<SellerRegistrationRecord> CreateAsync(
        Guid userId,
        string shopName,
        string? businessInfo,
        string? documentUrlsJson,
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

    Task<BuyerSellerRegistrationDto> GetMineAsync(
        Guid userId,
        CancellationToken cancellationToken = default);
}
