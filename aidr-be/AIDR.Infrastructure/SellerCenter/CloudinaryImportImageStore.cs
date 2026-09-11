using System.Net.Http.Headers;
using System.Text.Json;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AIDR.Infrastructure.SellerCenter;

public sealed class CloudinaryOptions
{
    public const string SectionName = "Cloudinary";

    /// <summary>The account's cloud name, e.g. "demo" in res.cloudinary.com/demo/...</summary>
    public string CloudName { get; set; } = string.Empty;

    /// <summary>
    /// An UNSIGNED upload preset — the same mechanism the seller form uses from the
    /// browser, so both paths land in one account with one set of rules.
    /// </summary>
    public string UploadPreset { get; set; } = string.Empty;

    /// <summary>Keeps spreadsheet uploads apart from the ones made by hand.</summary>
    public string Folder { get; set; } = "aidr/imports";

    /// <summary>Refused above this, before anything is sent over the wire.</summary>
    public int MaxImageBytes { get; set; } = 5 * 1024 * 1024;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(CloudName) && !string.IsNullOrWhiteSpace(UploadPreset);
}

/// <summary>
/// Turns a picture pasted into a spreadsheet into a hosted URL, by unsigned upload
/// to Cloudinary.
///
/// Cloudinary is not an arbitrary choice: product photos uploaded from the seller
/// form already go there, and res.cloudinary.com is the host the catalogue's own
/// image rules trust. An import that stored files anywhere else would produce
/// products whose photos the rest of the system treats as second class.
/// </summary>
public sealed class CloudinaryImportImageStore : ISellerImportImageStore
{
    /// <summary>What Cloudinary accepts unsigned, narrowed to what a sheet realistically holds.</summary>
    private static readonly HashSet<string> Extensions =
        new(StringComparer.OrdinalIgnoreCase) { "png", "jpg", "jpeg", "webp", "gif", "bmp" };

    private readonly HttpClient _http;
    private readonly CloudinaryOptions _options;
    private readonly ILogger<CloudinaryImportImageStore> _logger;

    public CloudinaryImportImageStore(
        HttpClient http,
        IOptions<CloudinaryOptions> options,
        ILogger<CloudinaryImportImageStore> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
        // An import is a batch: one slow picture must not hold the whole file up.
        _http.Timeout = TimeSpan.FromSeconds(30);
    }

    public bool IsConfigured => _options.IsConfigured;

    public int MaxBytes => _options.MaxImageBytes;

    public IReadOnlyCollection<string> AllowedExtensions => Extensions;

    public async Task<string> SaveAsync(SheetImage image, CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            throw new AppException(
                "This server has no image host configured, so a picture pasted into the sheet " +
                "cannot be stored. Put an http(s) link in the cell instead.");
        }

        if (image.Content.Length == 0)
            throw new AppException("The picture in the sheet is empty.");

        if (image.Content.Length > MaxBytes)
        {
            throw new AppException(
                $"The picture in the sheet is {image.Content.Length / 1024 / 1024f:0.#} MB; " +
                $"the limit is {MaxBytes / 1024 / 1024} MB.");
        }

        if (!Extensions.Contains(image.Extension))
        {
            throw new AppException(
                $"Pictures of type \"{image.Extension}\" are not supported. " +
                $"Use one of: {string.Join(", ", Extensions.OrderBy(e => e))}.");
        }

        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(image.Content);
        file.Headers.ContentType = new MediaTypeHeaderValue(ContentTypeOf(image.Extension));
        form.Add(file, "file", $"sheet-image.{image.Extension}");
        form.Add(new StringContent(_options.UploadPreset), "upload_preset");
        if (!string.IsNullOrWhiteSpace(_options.Folder))
            form.Add(new StringContent(_options.Folder), "folder");

        var endpoint = $"https://api.cloudinary.com/v1_1/{_options.CloudName}/image/upload";

        HttpResponseMessage response;
        try
        {
            response = await _http.PostAsync(endpoint, form, cancellationToken);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            // Cancellation of the request itself is the caller giving up, not a failure.
            cancellationToken.ThrowIfCancellationRequested();
            _logger.LogWarning(ex, "Cloudinary upload failed for a spreadsheet picture.");
            throw new AppException("The picture could not be uploaded: the image host did not respond.");
        }

        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "Cloudinary rejected a spreadsheet picture ({Status}): {Body}",
                (int)response.StatusCode,
                body);

            throw new AppException($"The image host rejected the picture: {DescribeError(body)}");
        }

        using var json = JsonDocument.Parse(body);
        var url = json.RootElement.TryGetProperty("secure_url", out var secure)
            ? secure.GetString()
            : null;

        if (string.IsNullOrWhiteSpace(url))
            throw new AppException("The image host accepted the picture but returned no URL for it.");

        return url;
    }

    private static string ContentTypeOf(string extension) => extension.ToLowerInvariant() switch
    {
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/jpeg",
    };

    /// <summary>Cloudinary answers with {"error":{"message":"..."}}; anything else is passed through short.</summary>
    private static string DescribeError(string body)
    {
        try
        {
            using var json = JsonDocument.Parse(body);
            if (json.RootElement.TryGetProperty("error", out var error) &&
                error.TryGetProperty("message", out var message) &&
                message.GetString() is { Length: > 0 } text)
            {
                return text;
            }
        }
        catch (JsonException)
        {
            // Not JSON — fall through to the raw text.
        }

        return body.Length <= 200 ? body : body[..200];
    }
}
