namespace AIDR.Modules.Kyc.Abstractions;

/// <summary>Shared eKYC settings - provider-agnostic thresholds and safety limits.</summary>
public sealed class EkycOptions
{
    public const string SectionName = "Ekyc";

    /// <summary>Active provider: <c>Gemini</c> or <c>FptAi</c>.</summary>
    public string Provider { get; set; } = "Gemini";

    /// <summary>
    /// Skip the live API and return a canned pass. Development only - startup
    /// refuses to boot with this on outside Development.
    /// </summary>
    public bool UseMock { get; set; }

    /// <summary>Face similarity at or above this passes automatically.</summary>
    public decimal FaceMatchThreshold { get; set; } = 0.80m;

    /// <summary>Between this and the pass threshold, a human decides.</summary>
    public decimal ManualReviewThreshold { get; set; } = 0.60m;

    public int MaxAttemptsPerDay { get; set; } = 5;
    public int TimeoutSeconds { get; set; } = 120;

    /// <summary>
    /// Hosts the server will fetch images from. Without this the endpoint becomes
    /// an SSRF proxy into the internal network.
    /// </summary>
    public string[] AllowedImageHosts { get; set; } = ["res.cloudinary.com"];

    public bool IsGemini =>
        string.Equals(Provider, "Gemini", StringComparison.OrdinalIgnoreCase);

    public bool IsFptAi =>
        string.Equals(Provider, "FptAi", StringComparison.OrdinalIgnoreCase)
        || string.Equals(Provider, "FPTAI", StringComparison.OrdinalIgnoreCase);
}

public sealed class FptAiOptions
{
    public const string SectionName = "FptAi";

    public string BaseUrl { get; set; } = "https://api.fpt.ai";
    public string ApiKey { get; set; } = string.Empty;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);
}

public sealed class GeminiEkycOptions
{
    public const string SectionName = "Gemini";

    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta";
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Vision-capable model for OCR and face comparison.</summary>
    public string Model { get; set; } = "gemini-3.5-flash-lite";

    /// <summary>Used when the primary model returns 404 (deprecated / unavailable).</summary>
    public string FallbackModel { get; set; } = "gemini-3.5-flash-lite";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);
}

/// <summary>Fields read off a Vietnamese ID card.</summary>
public sealed record IdCardOcrResult
{
    public string? DocumentNumber { get; init; }
    public string? DocumentType { get; init; }
    public string? FullName { get; init; }
    public string? DateOfBirth { get; init; }
    public string? Gender { get; init; }
    public string? HomeTown { get; init; }
    public string? PermanentAddress { get; init; }
    public string? IssueDate { get; init; }
    public string? IssuePlace { get; init; }
    public string? ExpiryDate { get; init; }
    public string? RawJson { get; init; }
    public bool IsMock { get; init; }
}

public sealed class FaceMatchResult
{
    public bool IsMatch { get; init; }
    public decimal Similarity { get; init; }
    public string? RawJson { get; init; }
    public bool IsMock { get; init; }
}

public sealed record EkycIdentityResult(IdCardOcrResult Ocr, FaceMatchResult Face);

public interface IEkycClient
{
    /// <summary>Provider code stored on <c>KycVerifications.Provider</c>.</summary>
    string ProviderName { get; }

    bool UseMock { get; }
    bool IsConfigured { get; }

    /// <summary>
    /// Read a Vietnamese ID card. The back is optional; it only adds the issue
    /// date and place, which are not present on the front.
    /// </summary>
    Task<IdCardOcrResult> ReadIdCardAsync(
        string frontImageUrl,
        string? backImageUrl = null,
        CancellationToken ct = default);

    Task<FaceMatchResult> MatchFaceAsync(
        string idCardImageUrl,
        string selfieImageUrl,
        CancellationToken ct = default);

    /// <summary>OCR + face match in as few provider round-trips as possible.</summary>
    Task<EkycIdentityResult> VerifyIdentityAsync(
        string frontImageUrl,
        string? backImageUrl,
        string selfieImageUrl,
        CancellationToken ct = default);
}
