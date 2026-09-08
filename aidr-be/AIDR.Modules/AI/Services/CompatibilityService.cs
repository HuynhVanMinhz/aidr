using System.Text.Json;
using System.Text.RegularExpressions;
using AIDR.Modules.AI.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.AI;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;

namespace AIDR.Modules.AI.Services;

public sealed class CompatibilityService : ICompatibilityService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private static readonly (string Key, string Label)[] CompatibilitySpecKeys =
    [
        ("ram_type", "RAM type"),
        ("ram_speed", "RAM speed"),
        ("max_ram", "Max RAM"),
        ("form_factor", "Form factor"),
        ("max_watt", "Max wattage"),
        ("connector", "Connector"),
        ("model", "Model"),
        ("compatible_models", "Compatible models")
    ];

    private readonly IAiCatalogRepository _catalog;
    private readonly ILlmClient _llm;
    private readonly ILogger<CompatibilityService> _logger;

    public CompatibilityService(
        IAiCatalogRepository catalog,
        ILlmClient llm,
        ILogger<CompatibilityService> logger)
    {
        _catalog = catalog;
        _llm = llm;
        _logger = logger;
    }

    public async Task<CompatibilityResultDto> CheckAsync(
        CompatibilityCheckRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.PrimaryProductId == Guid.Empty)
            throw new AppException("Primary product id is required.");

        if (request.SecondaryProductId is null && string.IsNullOrWhiteSpace(request.FreeTextDevice))
            throw new AppException("Provide a secondary product or describe your device.");

        if (request.SecondaryProductId is Guid secondaryId && secondaryId == request.PrimaryProductId)
            throw new AppException("Primary and secondary products must be different.");

        var freeText = string.IsNullOrWhiteSpace(request.FreeTextDevice)
            ? null
            : request.FreeTextDevice.Trim();
        if (freeText is not null && freeText.Length > CompatibilityConstants.MaxFreeTextLength)
            throw new AppException($"Device description must not exceed {CompatibilityConstants.MaxFreeTextLength} characters.");

        var primaryProducts = await _catalog.GetApprovedProductsByIdsAsync(
            [request.PrimaryProductId],
            cancellationToken);
        var primary = primaryProducts.FirstOrDefault()
            ?? throw new NotFoundException("Primary product not found or not available.");

        Dictionary<string, string> secondarySpecs;
        string secondaryLabel;

        if (request.SecondaryProductId is Guid secondaryProductId)
        {
            var secondaryProducts = await _catalog.GetApprovedProductsByIdsAsync(
                [secondaryProductId],
                cancellationToken);
            var secondary = secondaryProducts.FirstOrDefault()
                ?? throw new NotFoundException("Secondary product not found or not available.");

            secondarySpecs = ParseSpecs(secondary.SpecsJson);
            secondaryLabel = secondary.Name;
        }
        else
        {
            secondarySpecs = ParseFreeTextSpecs(freeText!);
            secondaryLabel = freeText!;
        }

        var primarySpecs = ParseSpecs(primary.SpecsJson);
        var ruleResult = EvaluateRules(primarySpecs, secondarySpecs, primary.Name, secondaryLabel);

        if (ruleResult.Verdict != CompatibilityConstants.VerdictUnknown || _llm.UseMock)
            return ruleResult;

        var llmResult = await TryLlmAsync(primary, primarySpecs, secondaryLabel, secondarySpecs, cancellationToken);
        return llmResult ?? ruleResult;
    }

    private CompatibilityResultDto EvaluateRules(
        IReadOnlyDictionary<string, string> primarySpecs,
        IReadOnlyDictionary<string, string> secondarySpecs,
        string primaryName,
        string secondaryLabel)
    {
        var matched = new List<MatchedSpecDto>();
        var reasons = new List<string>();
        var verdict = CompatibilityConstants.VerdictUnknown;
        var hasComparableSpec = false;

        foreach (var (key, label) in CompatibilitySpecKeys)
        {
            var hasPrimary = primarySpecs.TryGetValue(key, out var primaryValue);
            var hasSecondary = secondarySpecs.TryGetValue(key, out var secondaryValue);
            if (!hasPrimary && !hasSecondary)
                continue;

            hasComparableSpec = true;
            matched.Add(new MatchedSpecDto
            {
                Label = label,
                Primary = hasPrimary ? primaryValue : null,
                Secondary = hasSecondary ? secondaryValue : null
            });

            if (!hasPrimary || !hasSecondary)
            {
                reasons.Add($"{label} is missing on one side — unable to confirm compatibility.");
                continue;
            }

            switch (key)
            {
                case "ram_type":
                    if (!RamTypesEqual(primaryValue!, secondaryValue!))
                    {
                        verdict = CompatibilityConstants.VerdictIncompatible;
                        reasons.Add($"Primary supports {primaryValue}; selected item uses {secondaryValue}.");
                    }
                    else
                    {
                        reasons.Add($"Both sides use {primaryValue}.");
                    }
                    break;

                case "form_factor":
                    if (!ValuesEqual(primaryValue!, secondaryValue!))
                    {
                        verdict = CompatibilityConstants.VerdictIncompatible;
                        reasons.Add($"Form factor mismatch: {primaryValue} vs {secondaryValue}.");
                    }
                    break;

                case "max_watt" when TryParseWatts(primaryValue!, out var primaryWatts)
                                   && TryParseWatts(secondaryValue!, out var secondaryWatts):
                    if (secondaryWatts > primaryWatts)
                    {
                        if (verdict != CompatibilityConstants.VerdictIncompatible)
                            verdict = CompatibilityConstants.VerdictWarning;
                        reasons.Add(
                            $"Charger/output is {secondaryWatts}W while device supports up to {primaryWatts}W.");
                    }
                    break;

                case "connector":
                    if (!ConnectorsCompatible(primaryValue!, secondaryValue!))
                    {
                        verdict = CompatibilityConstants.VerdictIncompatible;
                        reasons.Add($"Connector mismatch: {primaryValue} vs {secondaryValue}.");
                    }
                    break;

                case "model":
                case "compatible_models":
                    if (!ModelCompatible(primarySpecs, secondarySpecs, secondaryLabel))
                    {
                        verdict = CompatibilityConstants.VerdictIncompatible;
                        reasons.Add("The accessory does not list this model as compatible.");
                    }
                    break;
            }
        }

        if (!hasComparableSpec)
        {
            return new CompatibilityResultDto
            {
                Verdict = CompatibilityConstants.VerdictUnknown,
                Headline = "Not enough specification data to confirm compatibility.",
                Reasons =
                [
                    "Neither product exposes enough structured specs for an automatic check.",
                    "Ask the seller or check the manufacturer compatibility list."
                ],
                MatchedSpecs = matched,
                Source = CompatibilityConstants.SourceRule
            };
        }

        if (verdict == CompatibilityConstants.VerdictUnknown
            && reasons.All(r => r.Contains("missing", StringComparison.OrdinalIgnoreCase)))
        {
            return new CompatibilityResultDto
            {
                Verdict = CompatibilityConstants.VerdictUnknown,
                Headline = "Compatibility could not be confirmed.",
                Reasons = reasons,
                MatchedSpecs = matched,
                Source = CompatibilityConstants.SourceRule
            };
        }

        if (verdict == CompatibilityConstants.VerdictUnknown && reasons.Count > 0)
        {
            verdict = CompatibilityConstants.VerdictCompatible;
        }

        return new CompatibilityResultDto
        {
            Verdict = verdict,
            Headline = BuildHeadline(verdict),
            Reasons = reasons.Count > 0 ? reasons : ["No blocking incompatibilities were detected from available specs."],
            MatchedSpecs = matched,
            Source = CompatibilityConstants.SourceRule
        };
    }

    private async Task<CompatibilityResultDto?> TryLlmAsync(
        AiCompareProductRecord primary,
        IReadOnlyDictionary<string, string> primarySpecs,
        string secondaryLabel,
        IReadOnlyDictionary<string, string> secondarySpecs,
        CancellationToken cancellationToken)
    {
        var systemPrompt =
            """
            You assess hardware compatibility for AIDR marketplace buyers.
            Use ONLY provided specification fields. Do not invent missing specs.
            Return strict JSON:
            {
              "verdict": "Compatible|Incompatible|Unknown|Warning",
              "headline": "string",
              "reasons": ["string"]
            }
            Prefer Unknown when data is insufficient.
            """;
        var userPrompt =
            $"""
            Primary product: {primary.Name}
            Primary specs: {JsonSerializer.Serialize(primarySpecs)}
            Secondary item: {secondaryLabel}
            Secondary specs: {JsonSerializer.Serialize(secondarySpecs)}
            """;

        var raw = await _llm.ChatAsync(systemPrompt, userPrompt, jsonFormat: true, cancellationToken);
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        try
        {
            var payload = JsonSerializer.Deserialize<CompatibilityLlmPayload>(ExtractJsonObject(raw), JsonOptions);
            if (payload is null || string.IsNullOrWhiteSpace(payload.Verdict))
                return null;

            var verdict = NormalizeVerdict(payload.Verdict);
            return new CompatibilityResultDto
            {
                Verdict = verdict,
                Headline = string.IsNullOrWhiteSpace(payload.Headline)
                    ? BuildHeadline(verdict)
                    : payload.Headline.Trim(),
                Reasons = (payload.Reasons ?? Array.Empty<string>())
                    .Where(r => !string.IsNullOrWhiteSpace(r))
                    .Select(r => r.Trim())
                    .Take(6)
                    .ToList(),
                MatchedSpecs = CompatibilitySpecKeys
                    .Select(k => new MatchedSpecDto
                    {
                        Label = k.Label,
                        Primary = primarySpecs.GetValueOrDefault(k.Key),
                        Secondary = secondarySpecs.GetValueOrDefault(k.Key)
                    })
                    .Where(m => m.Primary is not null || m.Secondary is not null)
                    .ToList(),
                Source = CompatibilityConstants.SourceGroq
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse Groq compatibility JSON.");
            return null;
        }
    }

    private static Dictionary<string, string> ParseSpecs(string? specsJson)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(specsJson))
            return result;

        try
        {
            using var doc = JsonDocument.Parse(specsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return result;

            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                var value = prop.Value.ValueKind switch
                {
                    JsonValueKind.String => prop.Value.GetString(),
                    JsonValueKind.Number => prop.Value.ToString(),
                    JsonValueKind.Array => string.Join(", ", prop.Value.EnumerateArray()
                        .Select(el => el.ValueKind == JsonValueKind.String ? el.GetString() : el.ToString())
                        .Where(v => !string.IsNullOrWhiteSpace(v))),
                    _ => prop.Value.ToString()
                };

                if (!string.IsNullOrWhiteSpace(value))
                    result[prop.Name] = value!;
            }
        }
        catch (JsonException)
        {
            // ignore malformed specs
        }

        return result;
    }

    private static Dictionary<string, string> ParseFreeTextSpecs(string freeText)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var text = freeText.ToLowerInvariant();

        var ramMatch = Regex.Match(text, @"\b(ddr[3454])\b", RegexOptions.IgnoreCase);
        if (ramMatch.Success)
            result["ram_type"] = ramMatch.Groups[1].Value.ToUpperInvariant();

        if (text.Contains("so-dimm", StringComparison.OrdinalIgnoreCase)
            || text.Contains("sodimm", StringComparison.OrdinalIgnoreCase))
            result["form_factor"] = "SO-DIMM";

        if (text.Contains("dimm", StringComparison.OrdinalIgnoreCase) && !result.ContainsKey("form_factor"))
            result["form_factor"] = "DIMM";

        var wattMatch = Regex.Match(text, @"(\d+)\s*w", RegexOptions.IgnoreCase);
        if (wattMatch.Success)
            result["max_watt"] = $"{wattMatch.Groups[1].Value}W";

        if (text.Contains("usb-c", StringComparison.OrdinalIgnoreCase))
            result["connector"] = "USB-C";

        result["model"] = freeText.Trim();
        return result;
    }

    private static bool RamTypesEqual(string left, string right)
        => NormalizeToken(left).Contains(NormalizeToken(right), StringComparison.OrdinalIgnoreCase)
           || NormalizeToken(right).Contains(NormalizeToken(left), StringComparison.OrdinalIgnoreCase);

    private static bool ValuesEqual(string left, string right)
        => string.Equals(NormalizeToken(left), NormalizeToken(right), StringComparison.OrdinalIgnoreCase);

    private static bool ConnectorsCompatible(string left, string right)
    {
        var a = NormalizeToken(left);
        var b = NormalizeToken(right);
        return a.Contains(b, StringComparison.OrdinalIgnoreCase)
               || b.Contains(a, StringComparison.OrdinalIgnoreCase);
    }

    private static bool ModelCompatible(
        IReadOnlyDictionary<string, string> primarySpecs,
        IReadOnlyDictionary<string, string> secondarySpecs,
        string secondaryLabel)
    {
        if (!primarySpecs.TryGetValue("model", out var primaryModel))
            return true;

        if (secondarySpecs.TryGetValue("compatible_models", out var models))
        {
            return models.Contains(primaryModel, StringComparison.OrdinalIgnoreCase)
                   || models.Contains(secondaryLabel, StringComparison.OrdinalIgnoreCase);
        }

        if (secondarySpecs.TryGetValue("model", out var secondaryModel))
            return primaryModel.Contains(secondaryModel, StringComparison.OrdinalIgnoreCase)
                   || secondaryModel.Contains(primaryModel, StringComparison.OrdinalIgnoreCase);

        return true;
    }

    private static bool TryParseWatts(string value, out int watts)
    {
        var match = Regex.Match(value, @"(\d+)");
        if (!match.Success)
        {
            watts = 0;
            return false;
        }

        watts = int.Parse(match.Groups[1].Value);
        return true;
    }

    private static string NormalizeToken(string value)
        => value.Trim().Replace("-", string.Empty, StringComparison.Ordinal);

    private static string NormalizeVerdict(string verdict)
    {
        if (verdict.Equals(CompatibilityConstants.VerdictCompatible, StringComparison.OrdinalIgnoreCase))
            return CompatibilityConstants.VerdictCompatible;
        if (verdict.Equals(CompatibilityConstants.VerdictIncompatible, StringComparison.OrdinalIgnoreCase))
            return CompatibilityConstants.VerdictIncompatible;
        if (verdict.Equals(CompatibilityConstants.VerdictWarning, StringComparison.OrdinalIgnoreCase))
            return CompatibilityConstants.VerdictWarning;
        return CompatibilityConstants.VerdictUnknown;
    }

    private static string BuildHeadline(string verdict) =>
        verdict switch
        {
            CompatibilityConstants.VerdictCompatible => "These products appear compatible based on available specs.",
            CompatibilityConstants.VerdictIncompatible => "These products are likely not compatible.",
            CompatibilityConstants.VerdictWarning => "These products may work, but there are caveats.",
            _ => "Compatibility could not be confirmed."
        };

    private static string ExtractJsonObject(string raw)
    {
        var start = raw.IndexOf('{');
        var end = raw.LastIndexOf('}');
        if (start >= 0 && end > start)
            return raw[start..(end + 1)];
        return raw;
    }

    private sealed class CompatibilityLlmPayload
    {
        public string? Verdict { get; set; }
        public string? Headline { get; set; }
        public string[]? Reasons { get; set; }
    }
}
