using AIDR.Modules.Kyc.Abstractions;
using Microsoft.Extensions.Options;

namespace AIDR.Infrastructure.Kyc;

/// <summary>Picks the configured eKYC provider at runtime.</summary>
public sealed class EkycClientResolver : IEkycClient
{
    private readonly EkycOptions _options;
    private readonly FptAiEkycClient _fptAi;
    private readonly GeminiEkycClient _gemini;

    public EkycClientResolver(
        IOptions<EkycOptions> options,
        FptAiEkycClient fptAi,
        GeminiEkycClient gemini)
    {
        _options = options.Value;
        _fptAi = fptAi;
        _gemini = gemini;
    }

    private IEkycClient Active => _options.IsFptAi ? _fptAi : _gemini;

    public string ProviderName => Active.ProviderName;
    public bool UseMock => Active.UseMock;
    public bool IsConfigured => Active.IsConfigured;

    public Task<IdCardOcrResult> ReadIdCardAsync(
        string frontImageUrl,
        string? backImageUrl = null,
        CancellationToken ct = default) =>
        Active.ReadIdCardAsync(frontImageUrl, backImageUrl, ct);

    public Task<FaceMatchResult> MatchFaceAsync(
        string idCardImageUrl,
        string selfieImageUrl,
        CancellationToken ct = default) =>
        Active.MatchFaceAsync(idCardImageUrl, selfieImageUrl, ct);

    public Task<EkycIdentityResult> VerifyIdentityAsync(
        string frontImageUrl,
        string? backImageUrl,
        string selfieImageUrl,
        CancellationToken ct = default) =>
        Active.VerifyIdentityAsync(frontImageUrl, backImageUrl, selfieImageUrl, ct);
}
