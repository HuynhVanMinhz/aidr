namespace AIDR.Shared.Serialization;

/// <summary>
/// Normalize inbound DateTime values for UTC storage. Unspecified is treated as UTC
/// (not local), matching API payloads that omit a timezone suffix.
/// </summary>
public static class UtcDateTime
{
    public static DateTime Normalize(DateTime value) =>
        value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

    public static DateTime? Normalize(DateTime? value) =>
        value is null ? null : Normalize(value.Value);
}
