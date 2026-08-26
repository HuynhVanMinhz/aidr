using System.Text.Json;

namespace AIDR.Shared.Dtos.Seller;

public sealed class CreateSellerRegistrationRequest
{
    public string ShopName { get; set; } = null!;
    public string? BusinessInfo { get; set; }

    /// <summary>
    /// Accepts a JSON string array, a JSON array, or a single URL string.
    /// </summary>
    public JsonElement? DocumentUrls { get; set; }
}

public sealed class BuyerSellerRegistrationDto
{
    public Guid RequestId { get; init; }
    public string ShopName { get; init; } = null!;
    public string? BusinessInfo { get; init; }
    public IReadOnlyList<string> DocumentUrls { get; init; } = Array.Empty<string>();
    public string Status { get; init; } = null!;
    public string? AdminNote { get; init; }
    public DateTime? ReviewedAt { get; init; }
    public DateTime CreatedAt { get; init; }
}
