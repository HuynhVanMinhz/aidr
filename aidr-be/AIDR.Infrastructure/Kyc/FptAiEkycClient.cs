using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using AIDR.Modules.Kyc.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AIDR.Infrastructure.Kyc;

/// <summary>
/// FPT.AI eKYC: ID-card OCR (/vision/idr/vnm) and face matching (/dmp/checkface/v1).
/// </summary>
public sealed class FptAiEkycClient : IEkycClient
{
    private const string OcrKeyHeader = "api-key";
    private const string FaceKeyHeader = "api_key";

    private readonly HttpClient _http;
    private readonly FptAiOptions _fptOptions;
    private readonly EkycOptions _ekycOptions;
    private readonly ILogger<FptAiEkycClient> _logger;

    public FptAiEkycClient(
        HttpClient http,
        IOptions<FptAiOptions> fptOptions,
        IOptions<EkycOptions> ekycOptions,
        ILogger<FptAiEkycClient> logger)
    {
        _fptOptions = fptOptions.Value;
        _ekycOptions = ekycOptions.Value;
        _logger = logger;
        _http = http;
        _http.Timeout = TimeSpan.FromSeconds(Math.Max(5, _ekycOptions.TimeoutSeconds));
    }

    public string ProviderName => KycConstants.ProviderFptAi;

    public bool UseMock => _ekycOptions.UseMock;

    public bool IsConfigured => _fptOptions.IsConfigured;

    public async Task<IdCardOcrResult> ReadIdCardAsync(
        string frontImageUrl,
        string? backImageUrl = null,
        CancellationToken ct = default)
    {
        if (UseMock)
            return MockOcr();

        RequireConfigured();

        var front = await ReadSideAsync(frontImageUrl, ct);

        if (string.IsNullOrWhiteSpace(backImageUrl))
            return front;

        try
        {
            var back = await ReadSideAsync(backImageUrl, ct);
            return front with
            {
                IssueDate = front.IssueDate ?? back.IssueDate,
                IssuePlace = front.IssuePlace ?? back.IssuePlace,
            };
        }
        catch (Exception ex)
        {
            _logger.LogInformation(ex, "Could not read the back of the ID card; continuing with the front only");
            return front;
        }
    }

    private async Task<IdCardOcrResult> ReadSideAsync(string imageUrl, CancellationToken ct)
    {
        var bytes = await EkycImageFetcher.DownloadAsync(_http, imageUrl, _ekycOptions, ct);

        using var content = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        content.Add(file, "image", "id.jpg");

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"{_fptOptions.BaseUrl.TrimEnd('/')}/vision/idr/vnm")
        {
            Content = content,
        };
        request.Headers.TryAddWithoutValidation(OcrKeyHeader, _fptOptions.ApiKey.Trim());

        using var response = await _http.SendAsync(request, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("FPT.AI OCR failed {Status}: {Body}", response.StatusCode, Trim(raw));
            ThrowIfProviderProblem(response.StatusCode, raw);
            throw new AppException(
                "That photo could not be processed. Use a sharper picture with the whole card in frame.",
                422);
        }

        return ParseOcr(raw);
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
                RawJson = JsonSerializer.Serialize(new { mock = true, similarity = 0.96 }),
            };
        }

        RequireConfigured();

        var idBytes = await EkycImageFetcher.DownloadAsync(_http, idCardImageUrl, _ekycOptions, ct);
        var selfieBytes = await EkycImageFetcher.DownloadAsync(_http, selfieImageUrl, _ekycOptions, ct);

        using var content = new MultipartFormDataContent();
        var idPart = new ByteArrayContent(idBytes);
        idPart.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        content.Add(idPart, "file[]", "id.jpg");

        var selfiePart = new ByteArrayContent(selfieBytes);
        selfiePart.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        content.Add(selfiePart, "file[]", "selfie.jpg");

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"{_fptOptions.BaseUrl.TrimEnd('/')}/dmp/checkface/v1")
        {
            Content = content,
        };
        request.Headers.TryAddWithoutValidation(FaceKeyHeader, _fptOptions.ApiKey.Trim());

        using var response = await _http.SendAsync(request, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("FPT.AI face match failed {Status}: {Body}", response.StatusCode, Trim(raw));
            ThrowIfProviderProblem(response.StatusCode, raw);
            throw new AppException(
                "Those photos could not be compared. Retake the portrait facing the camera in good light.",
                422);
        }

        return ParseFaceMatch(raw);
    }

    private static IdCardOcrResult ParseOcr(string raw)
    {
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        if (root.TryGetProperty("errorCode", out var errorCode)
            && errorCode.ValueKind == JsonValueKind.Number
            && errorCode.GetInt32() != 0)
        {
            var message = root.TryGetProperty("errorMessage", out var m)
                ? m.GetString()
                : null;
            throw new AppException(
                $"The ID card could not be read: {message ?? "unknown error"}.", 422);
        }

        if (!root.TryGetProperty("data", out var data)
            || data.ValueKind != JsonValueKind.Array
            || data.GetArrayLength() == 0)
        {
            throw new AppException("No ID card was detected in that image.", 422);
        }

        var first = data[0];

        return new IdCardOcrResult
        {
            DocumentNumber = Str(first, "id"),
            DocumentType = NormalizeType(Str(first, "type")),
            FullName = Str(first, "name"),
            DateOfBirth = Str(first, "dob"),
            Gender = Str(first, "sex"),
            HomeTown = Str(first, "home"),
            PermanentAddress = Str(first, "address"),
            IssueDate = Str(first, "issue_date"),
            IssuePlace = Str(first, "issue_loc"),
            ExpiryDate = Str(first, "doe"),
            RawJson = raw,
            IsMock = false,
        };
    }

    private static FaceMatchResult ParseFaceMatch(string raw)
    {
        using var doc = JsonDocument.Parse(raw);
        if (!doc.RootElement.TryGetProperty("data", out var data))
            throw new AppException("The face comparison returned an unexpected response.", 502);

        var similarity = 0m;
        if (data.TryGetProperty("similarity", out var sim))
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

        var isMatch = data.TryGetProperty("isMatch", out var match)
                      && match.ValueKind == JsonValueKind.True;

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
            HttpStatusCode.Forbidden => "the account is not subscribed to this service",
            HttpStatusCode.TooManyRequests => "the API quota or rate limit is exhausted",
            _ when (int)status >= 500 => "the provider is down",
            _ => null,
        };

        if (ours is null) return;

        throw new ProviderUnavailableException(
            $"FPT.AI is unusable - {ours} (HTTP {(int)status}): {Trim(raw)}");
    }

    private void RequireConfigured()
    {
        if (!IsConfigured)
        {
            throw new ProviderUnavailableException("FptAi:ApiKey is not set.");
        }
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

    public async Task<EkycIdentityResult> VerifyIdentityAsync(
        string frontImageUrl,
        string? backImageUrl,
        string selfieImageUrl,
        CancellationToken ct = default)
    {
        var ocr = await ReadIdCardAsync(frontImageUrl, backImageUrl, ct);
        var face = await MatchFaceAsync(frontImageUrl, selfieImageUrl, ct);
        return new EkycIdentityResult(ocr, face);
    }
}
