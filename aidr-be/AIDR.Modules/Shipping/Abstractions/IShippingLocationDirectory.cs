namespace AIDR.Modules.Shipping.Abstractions;

/// <summary>
/// One administrative unit as the carrier knows it. <see cref="Id"/> is the
/// carrier's own key (province/district id, ward code) and <see cref="Name"/> is
/// the spelling the carrier accepts back - storing that exact name is what keeps
/// a booking from failing on address conversion later.
/// </summary>
public sealed class ShippingLocationDto
{
    public required string Id { get; init; }
    public required string Name { get; init; }
}

/// <summary>
/// The carrier's address book, proxied so the buyer picks from names the carrier
/// already recognises instead of typing something it will reject at booking time.
/// The carrier token stays on the server.
/// </summary>
public interface IShippingLocationDirectory
{
    Task<IReadOnlyList<ShippingLocationDto>> GetProvincesAsync(CancellationToken ct = default);

    Task<IReadOnlyList<ShippingLocationDto>> GetDistrictsAsync(
        string provinceId,
        CancellationToken ct = default);

    Task<IReadOnlyList<ShippingLocationDto>> GetWardsAsync(
        string districtId,
        CancellationToken ct = default);
}
