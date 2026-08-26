using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AIDR.Modules.AI.Abstractions;
using AIDR.Modules.AI.Services;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AIDR.Infrastructure.AI;

public sealed class GroqClient : ILlmClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly HttpClient _http;
    private readonly GroqOptions _options;
    private readonly ILogger<GroqClient> _logger;

    public GroqClient(HttpClient http, IOptions<GroqOptions> options, ILogger<GroqClient> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;

        var baseUrl = string.IsNullOrWhiteSpace(_options.BaseUrl)
            ? "https://api.groq.com/openai/v1"
            : _options.BaseUrl.TrimEnd('/');
        _http.BaseAddress = new Uri(baseUrl + "/");
        _http.Timeout = TimeSpan.FromSeconds(Math.Clamp(_options.TimeoutSeconds, 5, 300));

        if (!string.IsNullOrWhiteSpace(_options.ApiKey))
            _http.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", _options.ApiKey.Trim());
    }

    public bool UseMock => _options.UseMock;

    public async Task<string?> ChatAsync(
        string systemPrompt,
        string userPrompt,
        bool jsonFormat,
        CancellationToken cancellationToken = default)
    {
        if (UseMock)
            return null;

        if (string.IsNullOrWhiteSpace(_options.ApiKey))
            throw new AppException("Groq API key is missing. Set Groq:ApiKey or enable UseMock.", 503);

        if (string.IsNullOrWhiteSpace(_options.Model))
            throw new AppException("Groq model is not configured.", 503);

        var payload = new GroqChatRequest
        {
            Model = _options.Model,
            Temperature = 0.2,
            Messages =
            [
                new GroqChatMessage { Role = "system", Content = systemPrompt },
                new GroqChatMessage { Role = "user", Content = userPrompt }
            ],
            ResponseFormat = jsonFormat
                ? new GroqResponseFormat { Type = "json_object" }
                : null
        };

        try
        {
            using var response = await _http.PostAsJsonAsync(
                "chat/completions",
                payload,
                JsonOptions,
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning(
                    "Groq chat failed: {Status} {Body}",
                    response.StatusCode,
                    Truncate(body, 500));
                return null;
            }

            var parsed = await response.Content.ReadFromJsonAsync<GroqChatResponse>(
                JsonOptions,
                cancellationToken);
            var content = parsed?.Choices?.FirstOrDefault()?.Message?.Content?.Trim();
            return string.IsNullOrWhiteSpace(content) ? null : content;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Groq chat timed out after {Timeout}s", _options.TimeoutSeconds);
            return null;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Groq chat HTTP error");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Groq chat unexpected error");
            return null;
        }
    }

    private static string Truncate(string value, int max)
        => value.Length <= max ? value : value[..max] + "…";

    private sealed class GroqChatRequest
    {
        public string Model { get; set; } = null!;
        public double Temperature { get; set; }
        public List<GroqChatMessage> Messages { get; set; } = new();
        public GroqResponseFormat? ResponseFormat { get; set; }
    }

    private sealed class GroqChatMessage
    {
        public string Role { get; set; } = null!;
        public string Content { get; set; } = null!;
    }

    private sealed class GroqResponseFormat
    {
        public string Type { get; set; } = "json_object";
    }

    private sealed class GroqChatResponse
    {
        public List<GroqChoice>? Choices { get; set; }
    }

    private sealed class GroqChoice
    {
        public GroqChatMessage? Message { get; set; }
    }
}
