using System.Text.Json;
using AIDR.Shared.Dtos.Kyc;

namespace AIDR.Shared.Dtos.Seller;

public sealed class CreateSellerRegistrationRequest
{
    public string ShopName { get; set; } = null!;
    public string? BusinessInfo { get; set; }

    /// <summary>Individual | Household | Company.</summary>
    public string BusinessType { get; set; } = null!;

    /// <summary>Required for Household and Company.</summary>
    public string? TaxCode { get; set; }

    public string? BusinessAddress { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }

    /// <summary>Business licence scan - required for Household and Company.</summary>
    public string? LicenseImageUrl { get; set; }

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
    public string? BusinessType { get; init; }
    public string? TaxCode { get; init; }
    public string? BusinessAddress { get; init; }
    public string? ContactPhone { get; init; }
    public string? ContactEmail { get; init; }
    public string? LicenseImageUrl { get; init; }
    public IReadOnlyList<string> DocumentUrls { get; init; } = Array.Empty<string>();
    public string Status { get; init; } = null!;
    public string? AdminNote { get; init; }
    public DateTime? ReviewedAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }

    /// <summary>Identity check backing this application.</summary>
    public KycVerificationDto? Kyc { get; init; }

    /// <summary>True while the applicant may still edit and resubmit.</summary>
    public bool CanEdit { get; init; }
}
