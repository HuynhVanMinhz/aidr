using System.Text.Json;

namespace AIDR.Shared.Serialization;

/// <summary>
/// The on-disk shape of the two variant JSON columns, in one place so the seller side that
/// writes them and the storefront that reads them cannot drift apart:
///
///   Products.VariantOptionsJson  [{"name":"Color","values":["Orange","White"]}]
///   ProductVariants.AttributesJson  {"Color":"Orange","Storage":"128GB"}
///
/// Both readers degrade to empty rather than throwing. The data is written by this
/// application, so malformed JSON means it was hand-edited — and failing a whole product
/// page over that is worse than showing it without its variant picker.
/// </summary>
public static class ProductVariantJson
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public sealed class OptionAxis
    {
        public string Name { get; set; } = null!;
        public List<string> Values { get; set; } = new();
    }

    public static string SerializeOptions(IEnumerable<OptionAxis> axes) =>
        JsonSerializer.Serialize(axes.ToList(), Options);

    public static string SerializeAttributes(IReadOnlyDictionary<string, string> attributes) =>
        JsonSerializer.Serialize(attributes, Options);

    public static IReadOnlyList<OptionAxis> ParseOptions(string? optionsJson)
    {
        if (string.IsNullOrWhiteSpace(optionsJson))
            return Array.Empty<OptionAxis>();

        try
        {
            var parsed = JsonSerializer.Deserialize<List<OptionAxis>>(optionsJson, Options);
            if (parsed is null)
                return Array.Empty<OptionAxis>();

            return parsed
                .Where(o => !string.IsNullOrWhiteSpace(o.Name))
                .Select(o => new OptionAxis { Name = o.Name, Values = o.Values ?? new List<string>() })
                .ToList();
        }
        catch (JsonException)
        {
            return Array.Empty<OptionAxis>();
        }
    }

    public static IReadOnlyDictionary<string, string> ParseAttributes(string? attributesJson)
    {
        if (string.IsNullOrWhiteSpace(attributesJson))
            return new Dictionary<string, string>();

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(attributesJson, Options)
                   ?? new Dictionary<string, string>();
        }
        catch (JsonException)
        {
            return new Dictionary<string, string>();
        }
    }
}
