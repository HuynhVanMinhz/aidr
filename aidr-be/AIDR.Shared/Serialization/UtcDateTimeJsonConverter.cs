using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AIDR.Shared.Serialization;

/// <summary>
/// SQL datetime2 strips DateTimeKind, so values round-trip as Unspecified and
/// System.Text.Json omits the trailing Z. Clients then parse them as local time.
/// Always emit UTC with Z; treat offset-less input as UTC.
/// </summary>
public sealed class UtcDateTimeJsonConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.String)
            throw new JsonException("Expected a string DateTime value.");

        var raw = reader.GetString();
        if (string.IsNullOrWhiteSpace(raw))
            throw new JsonException("DateTime value is empty.");

        if (DateTimeOffset.TryParse(
                raw,
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind,
                out var dto))
        {
            return dto.UtcDateTime;
        }

        if (DateTime.TryParse(
                raw,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                out var dt))
        {
            return DateTime.SpecifyKind(dt, DateTimeKind.Utc);
        }

        throw new JsonException($"Invalid DateTime value '{raw}'.");
    }

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        var utc = value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
        writer.WriteStringValue(utc.ToString("yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'", CultureInfo.InvariantCulture));
    }
}

public sealed class UtcNullableDateTimeJsonConverter : JsonConverter<DateTime?>
{
    private static readonly UtcDateTimeJsonConverter Inner = new();

    public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null)
            return null;
        return Inner.Read(ref reader, typeof(DateTime), options);
    }

    public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
    {
        if (value is null)
        {
            writer.WriteNullValue();
            return;
        }

        Inner.Write(writer, value.Value, options);
    }
}
