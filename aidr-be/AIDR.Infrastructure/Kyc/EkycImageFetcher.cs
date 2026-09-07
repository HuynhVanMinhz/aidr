using AIDR.Modules.Kyc.Abstractions;
using AIDR.Shared.Exceptions;

namespace AIDR.Infrastructure.Kyc;

/// <summary>
/// Downloads uploaded images from approved hosts before forwarding to eKYC providers.
/// </summary>
internal static class EkycImageFetcher
{
    private const long MaxImageBytes = 8 * 1024 * 1024;

    public static Task<byte[]> DownloadAsync(
        HttpClient http,
        string imageUrl,
        EkycOptions options,
        CancellationToken ct) =>
        DownloadAsync(http, imageUrl, options, optimize: true, ct);

    public static async Task<byte[]> DownloadAsync(
        HttpClient http,
        string imageUrl,
        EkycOptions options,
        bool optimize,
        CancellationToken ct)
    {
        var fetchUrl = optimize ? OptimizeDeliveryUrl(imageUrl) : imageUrl;

        if (!Uri.TryCreate(fetchUrl?.Trim(), UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new AppException("Image URL must be an absolute http or https URL.");
        }

        var allowed = options.AllowedImageHosts ?? [];
        if (allowed.Length > 0
            && !allowed.Any(h => string.Equals(h, uri.Host, StringComparison.OrdinalIgnoreCase)))
        {
            throw new AppException(
                $"Images must be uploaded to an approved host ({string.Join(", ", allowed)}).");
        }

        using var response = await http.GetAsync(uri, ct);
        if (!response.IsSuccessStatusCode)
            throw new AppException("The uploaded image could not be downloaded.", 502);

        if (response.Content.Headers.ContentLength is > MaxImageBytes)
            throw new AppException("The image is too large. Use a photo under 8 MB.");

        var bytes = await response.Content.ReadAsByteArrayAsync(ct);
        if (bytes.LongLength > MaxImageBytes)
            throw new AppException("The image is too large. Use a photo under 8 MB.");

        return bytes;
    }

    /// <summary>
    /// Ask Cloudinary for a smaller JPEG so Gemini receives less data and responds faster.
    /// </summary>
    internal static string OptimizeDeliveryUrl(string imageUrl)
    {
        if (!Uri.TryCreate(imageUrl.Trim(), UriKind.Absolute, out var uri)
            || !uri.Host.Contains("cloudinary.com", StringComparison.OrdinalIgnoreCase))
        {
            return imageUrl;
        }

        const string marker = "/upload/";
        var path = uri.AbsolutePath;
        var idx = path.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (idx < 0)
            return imageUrl;

        var afterUpload = path[(idx + marker.Length)..];
        if (afterUpload.StartsWith("w_", StringComparison.OrdinalIgnoreCase)
            || afterUpload.StartsWith("c_", StringComparison.OrdinalIgnoreCase))
        {
            return imageUrl;
        }

        var optimizedPath = path[..(idx + marker.Length)] + "w_1280,q_80,f_jpg/" + afterUpload;
        return uri.GetLeftPart(UriPartial.Authority) + optimizedPath + uri.Query;
    }
}
