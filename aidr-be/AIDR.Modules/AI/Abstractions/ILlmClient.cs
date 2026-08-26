namespace AIDR.Modules.AI.Abstractions;

public sealed class LlmChatMessage
{
    public string Role { get; init; } = null!;
    public string Content { get; init; } = null!;
}

public interface ILlmClient
{
    bool UseMock { get; }

    /// <summary>
    /// Single-turn chat completion via Groq (OpenAI-compatible). Returns null when UseMock or when the call fails soft
    /// (caller should fall back to heuristics).
    /// </summary>
    Task<string?> ChatAsync(
        string systemPrompt,
        string userPrompt,
        bool jsonFormat,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Multi-turn chat. <paramref name="messages"/> should be user/assistant turns only
    /// (system prompt is passed separately). Returns null when UseMock or soft failure.
    /// </summary>
    Task<string?> ChatAsync(
        string systemPrompt,
        IReadOnlyList<LlmChatMessage> messages,
        bool jsonFormat,
        CancellationToken cancellationToken = default);
}
