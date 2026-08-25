using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Exceptions;

namespace AIDR.Modules.Order.Services;

public sealed class ReturnService : IReturnService
{
    private readonly IReturnRepository _returns;

    public ReturnService(IReturnRepository returns) => _returns = returns;

    public async Task<BuyerReturnRequestDto> CreateAsync(
        Guid buyerUserId,
        Guid orderId,
        CreateReturnRequest request,
        CancellationToken cancellationToken = default)
    {
        if (buyerUserId == Guid.Empty)
            throw new AppException("Buyer user id is required.");
        if (orderId == Guid.Empty)
            throw new AppException("Order id is required.");
        if (request is null)
            throw new AppException("Return request body is required.");

        var reason = RequireText(request.Reason, "Reason", ReturnConstants.MaxReasonLength);

        string? description = null;
        if (!string.IsNullOrWhiteSpace(request.Description))
        {
            description = request.Description.Trim();
            if (description.Length > ReturnConstants.MaxDescriptionLength)
            {
                throw new AppException(
                    $"Description must not exceed {ReturnConstants.MaxDescriptionLength} characters.");
            }
        }

        var items = NormalizeItems(request.Items);
        var evidences = NormalizeEvidences(request.Evidences);

        EnsureRequiredEvidence(evidences, ReturnConstants.EvidenceTypeUnboxing);
        EnsureRequiredEvidence(evidences, ReturnConstants.EvidenceTypeTesting);

        return await _returns.CreateAsync(
            buyerUserId,
            orderId,
            reason,
            description,
            items,
            evidences,
            cancellationToken);
    }

    public async Task<BuyerReturnRequestDto> GetByOrderAsync(
        Guid buyerUserId,
        Guid orderId,
        CancellationToken cancellationToken = default)
    {
        if (buyerUserId == Guid.Empty)
            throw new AppException("Buyer user id is required.");
        if (orderId == Guid.Empty)
            throw new AppException("Order id is required.");

        return await _returns.GetByOrderForBuyerAsync(buyerUserId, orderId, cancellationToken)
            ?? throw new NotFoundException("Return request not found for this order.");
    }

    private static IReadOnlyList<(Guid OrderItemId, int Quantity)> NormalizeItems(
        IReadOnlyList<CreateReturnItemRequest>? items)
    {
        if (items is null || items.Count == 0)
            return Array.Empty<(Guid, int)>();

        var map = new Dictionary<Guid, int>();
        foreach (var item in items)
        {
            if (item.OrderItemId == Guid.Empty)
                throw new AppException("Order item id is required.");
            if (item.Quantity < 1)
                throw new AppException("Return quantity must be at least 1.");

            if (map.ContainsKey(item.OrderItemId))
                throw new AppException("Duplicate order item in return request.");

            map[item.OrderItemId] = item.Quantity;
        }

        return map.Select(kv => (kv.Key, kv.Value)).ToList();
    }

    private static IReadOnlyList<(string EvidenceType, string MediaUrl, string? PublicId)> NormalizeEvidences(
        IReadOnlyList<CreateReturnEvidenceRequest>? evidences)
    {
        if (evidences is null || evidences.Count == 0)
            throw new AppException("At least one Unboxing and one Testing evidence video are required.");

        if (evidences.Count > ReturnConstants.MaxEvidences)
        {
            throw new AppException(
                $"A return request can include at most {ReturnConstants.MaxEvidences} evidence files.");
        }

        var result = new List<(string, string, string?)>(evidences.Count);
        foreach (var evidence in evidences)
        {
            var type = evidence.EvidenceType?.Trim() ?? string.Empty;
            if (!ReturnConstants.EvidenceTypes.Contains(type))
                throw new AppException("Evidence type must be Unboxing, Testing, or Other.");

            var mediaUrl = RequireText(evidence.MediaUrl, "Evidence media URL", ReturnConstants.MaxMediaUrlLength);
            if (!Uri.TryCreate(mediaUrl, UriKind.Absolute, out var uri)
                || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                throw new AppException("Evidence media URL must be an absolute http or https URL.");
            }

            string? publicId = null;
            if (!string.IsNullOrWhiteSpace(evidence.PublicId))
            {
                publicId = evidence.PublicId.Trim();
                if (publicId.Length > ReturnConstants.MaxPublicIdLength)
                {
                    throw new AppException(
                        $"Evidence public id must not exceed {ReturnConstants.MaxPublicIdLength} characters.");
                }
            }

            var canonicalType = ReturnConstants.EvidenceTypes.First(t =>
                string.Equals(t, type, StringComparison.OrdinalIgnoreCase));

            result.Add((canonicalType, mediaUrl, publicId));
        }

        return result;
    }

    private static void EnsureRequiredEvidence(
        IReadOnlyList<(string EvidenceType, string MediaUrl, string? PublicId)> evidences,
        string requiredType)
    {
        if (!evidences.Any(e =>
                string.Equals(e.EvidenceType, requiredType, StringComparison.OrdinalIgnoreCase)))
        {
            throw new AppException($"At least one {requiredType} evidence video is required.");
        }
    }

    private static string RequireText(string? value, string fieldName, int maxLength)
    {
        var trimmed = value?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new AppException($"{fieldName} is required.");
        if (trimmed.Length > maxLength)
            throw new AppException($"{fieldName} must not exceed {maxLength} characters.");
        return trimmed;
    }
}
