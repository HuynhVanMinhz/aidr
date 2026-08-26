namespace AIDR.Modules.AI.Abstractions;

public interface ILlmClient
{
    bool UseMock { get; }

    /// <summary>
    /// Chat completion via Groq (OpenAI-compatible). Returns null when UseMock or when the call fails soft
    /// (caller should fall back to heuristics).
    /// </summary>
    Task<string?> ChatAsync(
        string systemPrompt,
        string userPrompt,
        bool jsonFormat,
        CancellationToken cancellationToken = default);
}
