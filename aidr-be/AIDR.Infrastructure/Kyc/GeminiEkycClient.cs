using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using AIDR.Modules.Kyc.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AIDR.Infrastructure.Kyc;

/// <summary>
/// Google Gemini Vision eKYC: structured OCR and face comparison via a single API.
/// </summary>
public sealed class GeminiEkycClient : IEkycClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private const string OcrPromptSingle = """
        You are an OCR engine for Vietnamese national ID cards (CCCD/CMND).
        Read the attached image and return ONLY valid JSON with these keys:
        {
          "documentNumber": "12-digit ID number or empty string if unreadable",
          "documentType": "CCCD or CMND or Passport",
          "fullName": "name in Vietnamese as printed",
          "dateOfBirth": "DD/MM/YYYY",
          "gender": "Nam or Nu",
          "homeTown": "place of origin",
          "permanentAddress": "permanent residence",
          "issueDate": "DD/MM/YYYY or empty",
          "issuePlace": "issuing authority or empty",
          "expiryDate": "DD/MM/YYYY or empty"
        }
        Do not guess values. Use empty string for fields you cannot read.
        Preserve Vietnamese diacritics exactly as printed.
        """;

    private const string OcrPromptBothSides = """
        You are an OCR engine for Vietnamese national ID cards (CCCD/CMND).
        Image 1 is the FRONT, image 2 is the BACK.
        Merge both sides and return ONLY valid JSON with these keys:
        {
          "documentNumber": "12-digit ID number or empty string if unreadable",
          "documentType": "CCCD or CMND or Passport",
          "fullName": "name in Vietnamese as printed",
          "dateOfBirth": "DD/MM/YYYY",
          "gender": "Nam or Nu",
          "homeTown": "place of origin",
          "permanentAddress": "permanent residence",
          "issueDate": "DD/MM/YYYY or empty (usually on the back)",
          "issuePlace": "issuing authority or empty (usually on the back)",
          "expiryDate": "DD/MM/YYYY or empty"
        }
        Do not guess values. Use empty string for fields you cannot read.
        Preserve Vietnamese diacritics exactly as printed.
        """;

    private readonly HttpClient _http;
    private readonly GeminiEkycOptions _geminiOptions;
    private readonly EkycOptions _ekycOptions;
    private readonly ILogger<GeminiEkycClient> _logger;

    public GeminiEkycClient(
        HttpClient http,
        IOptions<GeminiEkycOptions> geminiOptions,
        IOptions<EkycOptions> ekycOptions,
        ILogger<GeminiEkycClient> logger)
    {
        _geminiOptions = geminiOptions.Value;
        _ekycOptions = ekycOptions.Value;
        _logger = logger;
        _http = http;
        _http.Timeout = TimeSpan.FromSeconds(Math.Clamp(_ekycOptions.TimeoutSeconds, 30, 300));
    }

    public string ProviderName => KycConstants.ProviderGemini;

    public bool UseMock => _ekycOptions.UseMock;

    public bool IsConfigured => _geminiOptions.IsConfigured;

    public async Task<IdCardOcrResult> ReadIdCardAsync(
        string frontImageUrl,
        string? backImageUrl = null,
        CancellationToken ct = default)
    {
        if (UseMock)
            return MockOcr();

        RequireConfigured();

        var frontBytes = await EkycImageFetcher.DownloadAsync(_http, frontImageUrl, _ekycOptions, ct);

        if (string.IsNullOrWhiteSpace(backImageUrl))
        {
            var raw = await GenerateJsonAsync(OcrPromptSingle, [frontBytes], ct);
            return ParseOcr(raw, "front");
        }

        try
        {
            var backBytes = await EkycImageFetcher.DownloadAsync(_http, backImageUrl, _ekycOptions, ct);
            var raw = await GenerateJsonAsync(OcrPromptBothSides, [frontBytes, backBytes], ct);
            return ParseOcr(raw, "front+back");
        }
        catch (Exception ex) when (ex is not ProviderUnavailableException and not AppException)
        {
            _logger.LogInformation(ex, "Could not read both sides; falling back to front only");
            var raw = await GenerateJsonAsync(OcrPromptSingle, [frontBytes], ct);
            return ParseOcr(raw, "front");
        }
    }

    public async Task<FaceMatchResult> MatchFaceAsync(
        string idCardImageUrl,
        string selfieImageUrl,
        CancellationToken ct = default)
    {
        if (UseMock)
        {
            return new FaceMatchResult
            {
                IsMatch = true,
                Similarity = 0.96m,
                IsMock = true,
                RawJson = JsonSerializer.Serialize(new { mock = true, similarity = 96 }),
            };
        }

        RequireConfigured();

        var idBytes = await EkycImageFetcher.DownloadAsync(_http, idCardImageUrl, _ekycOptions, ct);
        var selfieBytes = await EkycImageFetcher.DownloadAsync(_http, selfieImageUrl, _ekycOptions, ct);

        const string prompt = """
            Compare the portrait on the Vietnamese ID card (first image) with the live selfie (second image).
            Return ONLY valid JSON:
            {
              "isMatch": true or false,
              "similarity": number from 0 to 100 indicating how likely the same person is shown,
              "reason": "one short English sentence"
            }
            Be conservative: different people should score below 60.
            """;

        var raw = await GenerateJsonAsync(prompt, [idBytes, selfieBytes], ct);
        return ParseFaceMatch(raw);
    }

    public async Task<EkycIdentityResult> VerifyIdentityAsync(
        string frontImageUrl,
        string? backImageUrl,
        string selfieImageUrl,
        CancellationToken ct = default)
    {
        if (UseMock)
        {
            var ocr = MockOcr();
            return new EkycIdentityResult(
                ocr,
                new FaceMatchResult
                {
                    IsMatch = true,
                    Similarity = 0.96m,
                    IsMock = true,
                    RawJson = JsonSerializer.Serialize(new { mock = true, similarity = 96 }),
                });
        }

        RequireConfigured();

        var frontTask = EkycImageFetcher.DownloadAsync(_http, frontImageUrl, _ekycOptions, ct);
        var selfieTask = EkycImageFetcher.DownloadAsync(_http, selfieImageUrl, _ekycOptions, ct);
        Task<byte[]>? backTask = string.IsNullOrWhiteSpace(backImageUrl)
            ? null
            : EkycImageFetcher.DownloadAsync(_http, backImageUrl, _ekycOptions, ct);

        var frontBytes = await frontTask;
        var selfieBytes = await selfieTask;
        byte[]? backBytes = backTask is null ? null : await backTask;

        var images = backBytes is null
            ? new[] { frontBytes, selfieBytes }
            : new[] { frontBytes, backBytes, selfieBytes };

        const string promptBoth = """
            You verify Vietnamese national ID (CCCD/CMND) for eKYC.
            Image order: (1) ID front, (2) ID back, (3) live selfie.
            Return ONLY valid JSON:
            {
              "documentNumber": "12-digit ID or empty",
              "documentType": "CCCD or CMND or Passport",
              "fullName": "Vietnamese name as printed",
              "dateOfBirth": "DD/MM/YYYY or empty",
              "gender": "Nam or Nu or empty",
              "homeTown": "place of origin or empty",
              "permanentAddress": "address or empty",
              "issueDate": "DD/MM/YYYY or empty",
              "issuePlace": "issuing authority or empty",
              "expiryDate": "DD/MM/YYYY or empty",
              "isMatch": true or false,
              "similarity": 0-100,
              "faceReason": "one short English sentence"
            }
            Compare the portrait on the ID front with the selfie. Be conservative on similarity.
            Do not guess OCR fields — use empty string when unreadable.
            """;

        const string promptNoBack = """
            You verify Vietnamese national ID (CCCD/CMND) for eKYC.
            Image order: (1) ID front, (2) live selfie.
            Return ONLY valid JSON:
            {
              "documentNumber": "12-digit ID or empty",
              "documentType": "CCCD or CMND or Passport",
              "fullName": "Vietnamese name as printed",
              "dateOfBirth": "DD/MM/YYYY or empty",
              "gender": "Nam or Nu or empty",
              "homeTown": "place of origin or empty",
              "permanentAddress": "address or empty",
              "issueDate": "DD/MM/YYYY or empty",
              "issuePlace": "issuing authority or empty",
              "expiryDate": "DD/MM/YYYY or empty",
              "isMatch": true or false,
              "similarity": 0-100,
              "faceReason": "one short English sentence"
            }
            Compare the portrait on the ID front with the selfie. Be conservative on similarity.
            Do not guess OCR fields — use empty string when unreadable.
            """;

        var raw = await GenerateJsonAsync(
            backBytes is null ? promptNoBack : promptBoth,
            images,
            ct);

        return ParseCombined(raw, backBytes is null ? "front+selfie" : "front+back+selfie");
    }

    private static EkycIdentityResult ParseCombined(string raw, string side)
    {
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        var ocr = new IdCardOcrResult
        {
            DocumentNumber = EmptyToNull(Str(root, "documentNumber")),
            DocumentType = NormalizeType(EmptyToNull(Str(root, "documentType"))),
            FullName = EmptyToNull(Str(root, "fullName")),
            DateOfBirth = EmptyToNull(Str(root, "dateOfBirth")),
            Gender = EmptyToNull(Str(root, "gender")),
            HomeTown = EmptyToNull(Str(root, "homeTown")),
            PermanentAddress = EmptyToNull(Str(root, "permanentAddress")),
            IssueDate = EmptyToNull(Str(root, "issueDate")),
            IssuePlace = EmptyToNull(Str(root, "issuePlace")),
            ExpiryDate = EmptyToNull(Str(root, "expiryDate")),
            RawJson = JsonSerializer.Serialize(new { side, data = root }),
            IsMock = false,
        };

        return new EkycIdentityResult(ocr, ParseFaceFromRoot(root, raw));
    }

    private static FaceMatchResult ParseFaceFromRoot(JsonElement root, string raw)
    {
        var similarity = 0m;
        if (root.TryGetProperty("similarity", out var sim))
        {
            similarity = sim.ValueKind switch
            {
                JsonValueKind.Number => sim.GetDecimal(),
                JsonValueKind.String when decimal.TryParse(
                    sim.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
                    => parsed,
                _ => 0m,
            };
        }

        similarity = Math.Clamp(similarity / 100m, 0m, 1m);

        var isMatch = root.TryGetProperty("isMatch", out var match)
                      && match.ValueKind is JsonValueKind.True;

        return new FaceMatchResult
        {
            IsMatch = isMatch,
            Similarity = decimal.Round(similarity, 4, MidpointRounding.AwayFromZero),
            RawJson = raw,
            IsMock = false,
        };
    }

    private async Task<string> GenerateJsonAsync(
        string prompt,
        IReadOnlyList<byte[]> images,
        CancellationToken ct)
    {
        var parts = new List<GeminiPart> { new(prompt, null) };
        foreach (var bytes in images)
        {
            parts.Add(new(null, new GeminiInlineData("image/jpeg", Convert.ToBase64String(bytes))));
        }

        var payload = new GeminiGenerateRequest(
            [new GeminiContent(parts.ToArray())],
            new GeminiGenerationConfig("application/json", 0.1));

        var models = ResolveModels();
        string? lastBody = null;
        HttpStatusCode lastStatus = 0;

        foreach (var model in models)
        {
            try
            {
                var url = BuildUrl(model);
                using var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(
                        JsonSerializer.Serialize(payload, JsonOptions),
                        Encoding.UTF8,
                        "application/json"),
                };

                using var response = await _http.SendAsync(request, ct);
                var raw = await response.Content.ReadAsStringAsync(ct);

                if (response.IsSuccessStatusCode)
                    return ExtractModelText(raw);

                lastBody = raw;
                lastStatus = response.StatusCode;
                _logger.LogWarning(
                    "Gemini eKYC model {Model} failed {Status}: {Body}",
                    model,
                    response.StatusCode,
                    Trim(raw));

                if (response.StatusCode != HttpStatusCode.NotFound)
                    break;
            }
            catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Gemini eKYC model {Model} timed out after {Seconds}s", model, _http.Timeout.TotalSeconds);
                throw new ProviderUnavailableException(
                    $"Gemini timed out after {_http.Timeout.TotalSeconds:0} seconds while processing the image.");
            }
        }

        _logger.LogWarning("Gemini eKYC failed {Status}: {Body}", lastStatus, Trim(lastBody ?? string.Empty));
        ThrowIfProviderProblem(lastStatus, lastBody ?? string.Empty);
        throw new AppException(
            "That photo could not be processed. Use a sharper picture with the whole card in frame.",
            422);
    }

    private string BuildUrl(string model) =>
        $"{_geminiOptions.BaseUrl.TrimEnd('/')}/models/{Uri.EscapeDataString(model)}:generateContent?key={Uri.EscapeDataString(_geminiOptions.ApiKey.Trim())}";

    private IEnumerable<string> ResolveModels()
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var model in new[]
                 {
                     _geminiOptions.Model.Trim(),
                     _geminiOptions.FallbackModel.Trim(),
                 })
        {
            if (string.IsNullOrWhiteSpace(model) || !seen.Add(model))
                continue;
            yield return model;
        }
    }

    private static string ExtractModelText(string raw)
    {
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        if (root.TryGetProperty("error", out var error))
        {
            var message = error.TryGetProperty("message", out var msg)
                ? msg.GetString()
                : "unknown error";
            throw new ProviderUnavailableException($"Gemini returned an error: {message}");
        }

        if (root.TryGetProperty("candidates", out var candidates)
            && candidates.ValueKind == JsonValueKind.Array
            && candidates.GetArrayLength() > 0)
        {
            var first = candidates[0];
            if (first.TryGetProperty("content", out var content)
                && content.TryGetProperty("parts", out var parts)
                && parts.ValueKind == JsonValueKind.Array
                && parts.GetArrayLength() > 0
                && parts[0].TryGetProperty("text", out var text))
            {
                var value = text.GetString();
                if (!string.IsNullOrWhiteSpace(value))
                    return value;
            }
        }

        throw new AppException("The identity provider returned an unexpected response.", 502);
    }

    private static IdCardOcrResult ParseOcr(string raw, string side)
    {
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        return new IdCardOcrResult
        {
            DocumentNumber = EmptyToNull(Str(root, "documentNumber")),
            DocumentType = NormalizeType(EmptyToNull(Str(root, "documentType"))),
            FullName = EmptyToNull(Str(root, "fullName")),
            DateOfBirth = EmptyToNull(Str(root, "dateOfBirth")),
            Gender = EmptyToNull(Str(root, "gender")),
            HomeTown = EmptyToNull(Str(root, "homeTown")),
            PermanentAddress = EmptyToNull(Str(root, "permanentAddress")),
            IssueDate = EmptyToNull(Str(root, "issueDate")),
            IssuePlace = EmptyToNull(Str(root, "issuePlace")),
            ExpiryDate = EmptyToNull(Str(root, "expiryDate")),
            RawJson = JsonSerializer.Serialize(new { side, data = root }),
            IsMock = false,
        };
    }

    private static FaceMatchResult ParseFaceMatch(string raw)
    {
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        var similarity = 0m;
        if (root.TryGetProperty("similarity", out var sim))
        {
            similarity = sim.ValueKind switch
            {
                JsonValueKind.Number => sim.GetDecimal(),
                JsonValueKind.String when decimal.TryParse(
                    sim.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
                    => parsed,
                _ => 0m,
            };
        }

        similarity = Math.Clamp(similarity / 100m, 0m, 1m);

        var isMatch = root.TryGetProperty("isMatch", out var match)
                      && match.ValueKind is JsonValueKind.True;

        return new FaceMatchResult
        {
            IsMatch = isMatch,
            Similarity = decimal.Round(similarity, 4, MidpointRounding.AwayFromZero),
            RawJson = raw,
            IsMock = false,
        };
    }

    private static void ThrowIfProviderProblem(HttpStatusCode status, string raw)
    {
        var ours = status switch
        {
            HttpStatusCode.Unauthorized => "the API key was rejected",
            HttpStatusCode.Forbidden => "the API key lacks permission for this model",
            HttpStatusCode.NotFound => "the configured model is unavailable",
            HttpStatusCode.TooManyRequests => "the API quota or rate limit is exhausted",
            _ when (int)status >= 500 => "the provider is down",
            _ => null,
        };

        if (ours is null) return;

        throw new ProviderUnavailableException(
            $"Gemini is unusable — {ours} (HTTP {(int)status}): {Trim(raw)}");
    }

    private void RequireConfigured()
    {
        if (!IsConfigured)
            throw new ProviderUnavailableException("Gemini:ApiKey is not set.");
    }

    private static IdCardOcrResult MockOcr() => new()
    {
        DocumentNumber = "079203001234",
        DocumentType = "CCCD",
        FullName = "NGUYEN VAN DEMO",
        DateOfBirth = "01/01/1995",
        Gender = "NAM",
        HomeTown = "Quan 1, TP Ho Chi Minh",
        PermanentAddress = "88 Xuan Thuy, Dich Vong, Cau Giay, Ha Noi",
        IssueDate = "01/01/2021",
        ExpiryDate = "01/01/2035",
        IsMock = true,
        RawJson = JsonSerializer.Serialize(new { mock = true }),
    };

    private static string? Str(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static string? EmptyToNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? NormalizeType(string? type)
    {
        if (string.IsNullOrWhiteSpace(type)) return null;
        var t = type.ToLowerInvariant();
        if (t.Contains("chip") || t.Contains("cccd")) return "CCCD";
        if (t.Contains("cmnd") || t.Contains("old")) return "CMND";
        if (t.Contains("passport")) return "Passport";
        return type;
    }

    private static string Trim(string value) =>
        value.Length <= 500 ? value : value[..500];

    private sealed record GeminiGenerateRequest(
        GeminiContent[] Contents,
        GeminiGenerationConfig GenerationConfig);

    private sealed record GeminiContent(GeminiPart[] Parts);

    private sealed record GeminiPart(string? Text, GeminiInlineData? InlineData);

    private sealed record GeminiInlineData(string MimeType, string Data);

    private sealed record GeminiGenerationConfig(string ResponseMimeType, double Temperature);
}
