using AIDR.Modules.Engagement.Abstractions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Dtos.SellerCenter;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;

namespace AIDR.Modules.SellerCenter.Services;

public sealed class SellerReturnService : ISellerReturnService
{
    private readonly ISellerProductRepository _products;
    private readonly ISellerReturnRepository _returns;
    private readonly INotificationService _notifications;
    private readonly ILogger<SellerReturnService> _logger;

    public SellerReturnService(
        ISellerProductRepository products,
        ISellerReturnRepository returns,
        INotificationService notifications,
        ILogger<SellerReturnService> logger)
    {
        _products = products;
        _returns = returns;
        _notifications = notifications;
        _logger = logger;
    }

    public async Task<SellerReturnListResultDto> ListAsync(
        Guid sellerUserId,
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var shop = await RequireActiveShopAsync(sellerUserId, cancellationToken);
        var normalizedStatus = NormalizeStatusFilter(status);
        var (normalizedPage, normalizedPageSize) = ReturnConstants.NormalizePaging(page, pageSize);

        var (items, totalCount, effectivePage, summary) = await _returns.ListPagedForShopAsync(
            shop.ShopId,
            normalizedStatus,
            normalizedPage,
            normalizedPageSize,
            cancellationToken);

        return new SellerReturnListResultDto
        {
            Items = items.Select(MapListItem).ToList(),
            Page = effectivePage,
            PageSize = normalizedPageSize,
            TotalCount = totalCount,
            ApprovedCount = summary.ApprovedCount,
            SellerConfirmedCount = summary.SellerConfirmedCount,
            ReceivingCount = summary.ReceivingCount,
            AcceptedCount = summary.AcceptedCount
        };
    }

    public async Task<SellerReturnDetailDto> GetByIdAsync(
        Guid sellerUserId,
        Guid returnRequestId,
        CancellationToken cancellationToken = default)
    {
        EnsureReturnId(returnRequestId);
        var shop = await RequireActiveShopAsync(sellerUserId, cancellationToken);
        return await _returns.GetDetailForShopAsync(shop.ShopId, returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");
    }

    public async Task<SellerReturnDetailDto> ConfirmAsync(
        Guid sellerUserId,
        Guid returnRequestId,
        ConfirmSellerReturnRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureReturnId(returnRequestId);
        EnsureUserId(sellerUserId);
        if (request is null)
            throw new AppException("Confirm request body is required.");

        var shop = await RequireActiveShopAsync(sellerUserId, cancellationToken);
        var existing = await _returns.GetDetailForShopAsync(shop.ShopId, returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        if (!string.Equals(existing.Status, ReturnConstants.StatusApproved, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Only approved return requests can be confirmed by the seller.");

        var resolutionType = string.IsNullOrWhiteSpace(request.ResolutionType)
            ? existing.ResolutionType
            : ReturnConstants.CanonicalResolutionType(request.ResolutionType.Trim());

        string? note = null;
        if (!string.IsNullOrWhiteSpace(request.Note))
        {
            note = request.Note.Trim();
            if (note.Length > ReturnConstants.MaxStatusNoteLength)
            {
                throw new AppException(
                    $"Note must not exceed {ReturnConstants.MaxStatusNoteLength} characters.");
            }
        }

        var result = await _returns.ConfirmAsync(
            shop.ShopId,
            returnRequestId,
            sellerUserId,
            resolutionType,
            note,
            cancellationToken);

        await NotifyBuyerAsync(
            result,
            "Return handling confirmed",
            $"The seller confirmed your {(FormatResolution(result.ResolutionType))} for order {result.OrderCode}. Please ship the item back.",
            cancellationToken);

        return result;
    }

    public async Task<SellerReturnDetailDto> MarkReceivingAsync(
        Guid sellerUserId,
        Guid returnRequestId,
        SellerReturnActionRequest? request,
        CancellationToken cancellationToken = default)
    {
        EnsureReturnId(returnRequestId);
        EnsureUserId(sellerUserId);
        var shop = await RequireActiveShopAsync(sellerUserId, cancellationToken);

        var existing = await _returns.GetDetailForShopAsync(shop.ShopId, returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        if (!string.Equals(existing.Status, ReturnConstants.StatusSellerConfirmed, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Only seller-confirmed returns can move to receiving.");

        var note = NormalizeOptionalNote(request?.Note);
        var result = await _returns.AdvanceAsync(
            shop.ShopId,
            returnRequestId,
            sellerUserId,
            ReturnConstants.StatusReceiving,
            note,
            cancellationToken);

        await NotifyBuyerAsync(
            result,
            "Returned item received",
            $"The seller marked the returned item for order {result.OrderCode} as received and is inspecting it.",
            cancellationToken);

        return result;
    }

    public async Task<SellerReturnDetailDto> AcceptGoodsAsync(
        Guid sellerUserId,
        Guid returnRequestId,
        SellerReturnActionRequest? request,
        CancellationToken cancellationToken = default)
    {
        EnsureReturnId(returnRequestId);
        EnsureUserId(sellerUserId);
        var shop = await RequireActiveShopAsync(sellerUserId, cancellationToken);

        var existing = await _returns.GetDetailForShopAsync(shop.ShopId, returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        if (!string.Equals(existing.Status, ReturnConstants.StatusReceiving, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Only receiving returns can be accepted after inspection.");

        var note = NormalizeOptionalNote(request?.Note);
        var result = await _returns.AdvanceAsync(
            shop.ShopId,
            returnRequestId,
            sellerUserId,
            ReturnConstants.StatusAccepted,
            note ?? "Seller accepted returned goods after inspection",
            cancellationToken);

        await NotifyBuyerAsync(
            result,
            "Returned item accepted",
            $"The seller accepted the returned item for order {result.OrderCode}. AIDR support will complete your {(FormatResolution(result.ResolutionType))}.",
            cancellationToken);

        await NotifyAdminsAcceptedAsync(result, cancellationToken);
        return result;
    }

    public async Task<SellerReturnDetailDto> RejectAsync(
        Guid sellerUserId,
        Guid returnRequestId,
        RejectSellerReturnRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureReturnId(returnRequestId);
        EnsureUserId(sellerUserId);
        if (request is null)
            throw new AppException("Reject request body is required.");

        var note = RequireNote(request.Note);
        var shop = await RequireActiveShopAsync(sellerUserId, cancellationToken);

        var existing = await _returns.GetDetailForShopAsync(shop.ShopId, returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        if (!ReturnConstants.SellerRejectableStatuses.Contains(existing.Status))
        {
            throw new ConflictException(
                "Seller can only reject returns that are approved or receiving.");
        }

        var result = await _returns.RejectAsync(
            shop.ShopId,
            returnRequestId,
            sellerUserId,
            note,
            cancellationToken);

        await NotifyBuyerAsync(
            result,
            "Return request rejected by seller",
            $"Your return request for order {result.OrderCode} was rejected by the seller. Note: {note}",
            cancellationToken);

        return result;
    }

    private async Task NotifyAdminsAcceptedAsync(
        SellerReturnDetailDto detail,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Guid> adminIds;
        try
        {
            adminIds = await _returns.ListAdminUserIdsAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load admin users for return {ReturnRequestId}", detail.ReturnRequestId);
            return;
        }

        var title = "Return goods accepted by seller";
        var body =
            $"Seller accepted returned goods for order {detail.OrderCode} ({FormatResolution(detail.ResolutionType)}). Please complete the request.";

        foreach (var adminId in adminIds)
        {
            try
            {
                await _notifications.CreateAsync(
                    new CreateNotificationRequest
                    {
                        UserId = adminId,
                        Title = title,
                        Body = body.Length <= NotificationConstants.MaxBodyLength
                            ? body
                            : body[..NotificationConstants.MaxBodyLength],
                        Type = NotificationConstants.TypeReturn,
                        ReferenceType = NotificationConstants.RefReturnRequest,
                        ReferenceId = detail.ReturnRequestId
                    },
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Failed to notify admin {AdminId} about accepted return {ReturnRequestId}",
                    adminId,
                    detail.ReturnRequestId);
            }
        }
    }

    private async Task NotifyBuyerAsync(
        SellerReturnDetailDto detail,
        string title,
        string body,
        CancellationToken cancellationToken)
    {
        if (detail.BuyerUserId == Guid.Empty)
            return;

        try
        {
            await _notifications.CreateAsync(
                new CreateNotificationRequest
                {
                    UserId = detail.BuyerUserId,
                    Title = title,
                    Body = body.Length <= NotificationConstants.MaxBodyLength
                        ? body
                        : body[..NotificationConstants.MaxBodyLength],
                    Type = NotificationConstants.TypeReturn,
                    ReferenceType = NotificationConstants.RefReturnRequest,
                    ReferenceId = detail.ReturnRequestId
                },
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to notify buyer {BuyerId} about return {ReturnRequestId}",
                detail.BuyerUserId,
                detail.ReturnRequestId);
        }
    }

    private async Task<SellerShopRecord> RequireActiveShopAsync(
        Guid ownerUserId,
        CancellationToken cancellationToken)
    {
        if (ownerUserId == Guid.Empty)
            throw new AppException("Seller user id is required.");

        return await _products.GetActiveShopByOwnerAsync(ownerUserId, cancellationToken)
            ?? throw new ForbiddenAppException("Active shop not found for the current seller.");
    }

    private static SellerReturnListItemDto MapListItem(SellerReturnListRecord record) =>
        new()
        {
            ReturnRequestId = record.ReturnRequestId,
            OrderId = record.OrderId,
            OrderCode = record.OrderCode,
            BuyerUserId = record.BuyerUserId,
            BuyerEmail = record.BuyerEmail,
            BuyerFullName = record.BuyerFullName,
            Reason = record.Reason,
            Status = record.Status,
            ResolutionType = record.ResolutionType,
            RefundAmount = record.RefundAmount,
            OrderTotalAmount = record.OrderTotalAmount,
            EvidenceCount = record.EvidenceCount,
            CreatedAt = record.CreatedAt,
            UpdatedAt = record.UpdatedAt
        };

    private static string? NormalizeStatusFilter(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)
            || string.Equals(status.Trim(), "all", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var trimmed = status.Trim();
        var match = ReturnConstants.AllStatuses.FirstOrDefault(s =>
            string.Equals(s, trimmed, StringComparison.OrdinalIgnoreCase));

        if (match is null)
            throw new AppException("Status filter must be a known return status or all.");

        return match;
    }

    private static string? NormalizeOptionalNote(string? note)
    {
        if (string.IsNullOrWhiteSpace(note))
            return null;

        var trimmed = note.Trim();
        if (trimmed.Length > ReturnConstants.MaxStatusNoteLength)
        {
            throw new AppException(
                $"Note must not exceed {ReturnConstants.MaxStatusNoteLength} characters.");
        }

        return trimmed;
    }

    private static string RequireNote(string? note)
    {
        var trimmed = note?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new AppException("Note is required when rejecting a return request.");

        if (trimmed.Length > ReturnConstants.MaxAdminNoteLength)
        {
            throw new AppException(
                $"Note must not exceed {ReturnConstants.MaxAdminNoteLength} characters.");
        }

        return trimmed;
    }

    private static string FormatResolution(string resolutionType) =>
        string.Equals(resolutionType, ReturnConstants.ResolutionExchange, StringComparison.OrdinalIgnoreCase)
            ? "exchange"
            : "return and refund";

    private static void EnsureReturnId(Guid returnRequestId)
    {
        if (returnRequestId == Guid.Empty)
            throw new AppException("Return request id is required.");
    }

    private static void EnsureUserId(Guid userId)
    {
        if (userId == Guid.Empty)
            throw new AppException("Seller user id is required.");
    }
}
