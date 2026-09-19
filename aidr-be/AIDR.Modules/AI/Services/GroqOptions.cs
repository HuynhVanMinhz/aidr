using AIDR.Shared.Constants;

namespace AIDR.Modules.AI.Services;

public sealed class GroqOptions
{
    public const string SectionName = AiConstants.OptionsSectionName;

    /// <summary>Groq OpenAI-compatible base URL.</summary>
    public string BaseUrl { get; set; } = "https://api.groq.com/openai/v1";

    /// <summary>Groq API key (Bearer). Prefer user-secrets / env - do not commit real keys.</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Chat model id (e.g. llama-3.3-70b-versatile, llama-3.1-8b-instant).</summary>
    public string Model { get; set; } = "llama-3.3-70b-versatile";

    /// <summary>
    /// When true, skip live Groq and use deterministic heuristic responses (local/dev).
    /// </summary>
    public bool UseMock { get; set; }

    /// <summary>HTTP timeout for chat calls (seconds).</summary>
    public int TimeoutSeconds { get; set; } = 60;
}
