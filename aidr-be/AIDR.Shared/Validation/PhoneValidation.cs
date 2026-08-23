using System.Text.RegularExpressions;
using AIDR.Shared.Exceptions;

namespace AIDR.Shared.Validation;

public static class PhoneValidation
{
    /// <summary>
    /// VN mobile: 0[35789]xxxxxxxx or +84[35789]xxxxxxxx (10 digits national).
    /// </summary>
    private static readonly Regex VnMobileRegex = new(
        @"^(0|\+84)(3|5|7|8|9)\d{8}$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static string RequireValidVnPhone(string? phone, string fieldLabel = "Phone")
    {
        if (string.IsNullOrWhiteSpace(phone))
            throw new AppException($"{fieldLabel} is required.");

        var normalized = Normalize(phone);
        if (!VnMobileRegex.IsMatch(normalized))
            throw new AppException($"{fieldLabel} must be a valid Vietnamese mobile number (e.g. 0912345678).");

        // Persist as 0xxxxxxxxx
        return normalized.StartsWith("+84", StringComparison.Ordinal)
            ? "0" + normalized[3..]
            : normalized;
    }

    public static string Normalize(string phone)
    {
        var trimmed = phone.Trim();
        var chars = trimmed.Where(c => c != ' ' && c != '.' && c != '-' && c != '(' && c != ')').ToArray();
        return new string(chars);
    }
}
