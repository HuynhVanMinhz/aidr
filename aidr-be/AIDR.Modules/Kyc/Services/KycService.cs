using System.Security.Cryptography;
using System.Text;
using AIDR.Modules.Kyc.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Kyc;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AIDR.Modules.Kyc.Services;

public sealed class KycService : IKycService
{
    private readonly IKycRepository _repository;
    private readonly IEkycClient _client;
    private readonly EkycOptions _options;
    private readonly ILogger<KycService> _logger;

    public KycService(
        IKycRepository repository,
        IEkycClient client,
        IOptions<EkycOptions> options,
        ILogger<KycService> logger)
    {
        _repository = repository;
        _client = client;
        _options = options.Value;
        _logger = logger;
    }

    public Task<KycVerificationDto?> GetMineAsync(Guid userId, CancellationToken ct = default)
    {
        if (userId == Guid.Empty)
            throw new AppException("User id is required.");

        return _repository.GetLatestForUserAsync(userId, ct);
    }

    public async Task<KycVerificationDto> VerifyAsync(
        Guid userId,
        KycVerifyRequest request,
        CancellationToken ct = default)
    {
        if (userId == Guid.Empty)
            throw new AppException("User id is required.");
        if (request is null)
            throw new AppException("Verification images are required.");

        var frontUrl = RequireUrl(request.FrontImageUrl, "ID card front photo");
        var selfieUrl = RequireUrl(request.SelfieImageUrl, "Portrait photo");
        var backUrl = string.IsNullOrWhiteSpace(request.BackImageUrl)
            ? null
            : RequireUrl(request.BackImageUrl, "ID card back photo");

        var since = DateTime.UtcNow.AddDays(-1);
        var attempts = await _repository.CountAttemptsSinceAsync(userId, since, ct);
        if (attempts >= _options.MaxAttemptsPerDay)
        {
            throw new ConflictException(
                $"You have used all {_options.MaxAttemptsPerDay} verification attempts for today. Try again tomorrow.");
        }

        var existing = await _repository.GetLatestForUserAsync(userId, ct);
        if (existing is not null
            && string.Equals(existing.Status, KycConstants.StatusPassed, StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException("Your identity has already been verified.");
        }

        var provider = _client.UseMock ? KycConstants.ProviderMock : _client.ProviderName;

        EkycIdentityResult identity;
        try
        {
            identity = await _client.VerifyIdentityAsync(frontUrl, backUrl, selfieUrl, ct);
        }
        catch (ProviderUnavailableException ex)
        {
            return await ManualReviewAsync(userId, frontUrl, backUrl, selfieUrl, ex, ct);
        }

        var ocr = identity.Ocr;
        if (string.IsNullOrWhiteSpace(ocr.DocumentNumber))
        {
            return await FailAsync(
                userId,
                provider,
                frontUrl,
                backUrl,
                selfieUrl,
                "The ID number could not be read. Take a sharper photo with the whole card in frame.",
                ocr.RawJson,
                null,
                ct);
        }

        var documentNumber = ocr.DocumentNumber.Trim();
        var hash = Sha256(documentNumber);

        if (await _repository.DocumentUsedByAnotherUserAsync(hash, userId, ct))
        {
            return await FailAsync(
                userId,
                provider,
                frontUrl,
                backUrl,
                selfieUrl,
                "This ID document is already linked to another AIDR account.",
                ocr.RawJson,
                null,
                ct);
        }

        var face = identity.Face;

        var status = face.Similarity >= _options.FaceMatchThreshold
            ? KycConstants.StatusPassed
            : face.Similarity >= _options.ManualReviewThreshold
                ? KycConstants.StatusManualReview
                : KycConstants.StatusFailed;

        var failureReason = status switch
        {
            KycConstants.StatusFailed =>
                "Your portrait does not match the photo on the ID card. Retake it in good light, facing the camera.",
            KycConstants.StatusManualReview =>
                "The photo comparison was inconclusive, so a staff member will review it manually.",
            _ => null,
        };

        _logger.LogInformation(
            "KYC for user {UserId} via {Provider}: similarity {Similarity} -> {Status}",
            userId,
            provider,
            face.Similarity,
            status);

        return await _repository.SaveAsync(
            new KycVerificationRecord
            {
                UserId = userId,
                Provider = provider,
                DocumentType = ocr.DocumentType ?? KycConstants.DocumentTypeCccd,
                DocumentNumberMask = Mask(documentNumber),
                DocumentNumberHash = hash,
                FullName = ocr.FullName,
                DateOfBirth = ocr.DateOfBirth,
                Gender = ocr.Gender,
                HomeTown = ocr.HomeTown,
                PermanentAddress = ocr.PermanentAddress,
                IssueDate = ocr.IssueDate,
                ExpiryDate = ocr.ExpiryDate,
                FrontImageUrl = frontUrl,
                BackImageUrl = backUrl,
                SelfieImageUrl = selfieUrl,
                FaceMatchSimilarity = face.Similarity,
                FaceMatched = face.IsMatch,
                Status = status,
                FailureReason = failureReason,
                RawOcrJson = ocr.RawJson,
                RawFaceJson = face.RawJson,
            },
            ct);
    }

    private async Task<KycVerificationDto> ManualReviewAsync(
        Guid userId,
        string frontUrl,
        string? backUrl,
        string selfieUrl,
        ProviderUnavailableException ex,
        CancellationToken ct)
    {
        _logger.LogError(
            ex,
            "eKYC provider unavailable for user {UserId}; falling back to manual review",
            userId);

        var detail = string.IsNullOrWhiteSpace(ex.Message)
            ? null
            : ex.Message.Length <= 400
                ? ex.Message
                : ex.Message[..400];

        return await _repository.SaveAsync(
            new KycVerificationRecord
            {
                UserId = userId,
                Provider = KycConstants.ProviderManual,
                FrontImageUrl = frontUrl,
                BackImageUrl = backUrl,
                SelfieImageUrl = selfieUrl,
                Status = KycConstants.StatusManualReview,
                FailureReason =
                    "Automatic identity checking is unavailable right now, so a staff member "
                    + "will check your documents by hand. You can carry on with your application."
                    + (detail is null ? string.Empty : $" ({detail})"),
                RawOcrJson = null,
                RawFaceJson = null,
            },
            ct);
    }

    private Task<KycVerificationDto> FailAsync(
        Guid userId,
        string provider,
        string frontUrl,
        string? backUrl,
        string selfieUrl,
        string reason,
        string? rawOcr,
        string? rawFace,
        CancellationToken ct) =>
        _repository.SaveAsync(
            new KycVerificationRecord
            {
                UserId = userId,
                Provider = provider,
                FrontImageUrl = frontUrl,
                BackImageUrl = backUrl,
                SelfieImageUrl = selfieUrl,
                Status = KycConstants.StatusFailed,
                FailureReason = reason,
                RawOcrJson = rawOcr,
                RawFaceJson = rawFace,
            },
            ct);

    private static string RequireUrl(string? value, string label)
    {
        var url = value?.Trim();
        if (string.IsNullOrWhiteSpace(url))
            throw new AppException($"{label} is required.");
        if (url.Length > KycConstants.MaxImageUrlLength)
            throw new AppException($"{label} URL is too long.");
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new AppException($"{label} must be an absolute http or https URL.");
        }
        return url;
    }

    private static string Mask(string documentNumber)
    {
        var digits = new string(documentNumber.Where(char.IsLetterOrDigit).ToArray());
        return digits.Length <= 4
            ? digits
            : new string('*', digits.Length - 4) + digits[^4..];
    }

    private static string Sha256(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value.ToUpperInvariant()));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
