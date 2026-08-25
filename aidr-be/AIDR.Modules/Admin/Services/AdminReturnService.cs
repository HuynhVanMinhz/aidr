using AIDR.Modules.Admin.Abstractions;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Constants;
using AIDR.Shared.Dtos.Admin;
using AIDR.Shared.Dtos.Engagement;
using AIDR.Shared.Exceptions;
using Microsoft.Extensions.Logging;

namespace AIDR.Modules.Admin.Services;

public sealed class AdminReturnService : IAdminReturnService
{
    private readonly IAdminReturnRepository _repository;
    private readonly INotificationService _notifications;
    private readonly ILogger<AdminReturnService> _logger;

    public AdminReturnService(
        IAdminReturnRepository repository,
        INotificationService notifications,
        ILogger<AdminReturnService> logger)
    {
        _repository = repository;
        _notifications = notifications;
        _logger = logger;
    }

    public async Task<AdminReturnRequestListResultDto> ListAsync(
        string? status,
        string? q,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeStatusFilter(status);
        var (normalizedPage, normalizedPageSize) = ReturnConstants.NormalizePaging(page, pageSize);
        var keyword = NormalizeSearch(q);

        var (items, totalCount, effectivePage, summary) = await _repository.ListPagedAsync(
            normalized,
            keyword,
            normalizedPage,
            normalizedPageSize,
            cancellationToken);

        return new AdminReturnRequestListResultDto
        {
            Items = items.Select(MapListItem).ToList(),
            Page = effectivePage,
            PageSize = normalizedPageSize,
            TotalCount = totalCount,
            PendingCount = summary.PendingCount,
            ApprovedCount = summary.ApprovedCount,
            RejectedCount = summary.RejectedCount,
            ReceivingCount = summary.ReceivingCount,
            RefundedCount = summary.RefundedCount,
            ClosedCount = summary.ClosedCount
        };
    }

    public async Task<AdminReturnRequestDetailDto> GetByIdAsync(
        Guid returnRequestId,
        CancellationToken cancellationToken = default)
    {
        EnsureReturnId(returnRequestId);

        return await _repository.GetDetailAsync(returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");
    }

    public async Task<AdminReturnRequestDetailDto> ApproveAsync(
        Guid returnRequestId,
        Guid adminUserId,
        CancellationToken cancellationToken = default)
    {
        EnsureReturnId(returnRequestId);
        EnsureUserId(adminUserId);

        var existing = await _repository.GetDetailAsync(returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        if (!string.Equals(existing.Status, ReturnConstants.StatusPending, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Only pending return requests can be approved.");

        var result = await _repository.ApproveAsync(returnRequestId, adminUserId, cancellationToken);
        await NotifyBuyerReturnAsync(
            result,
            "Return request approved",
            $"Your return request for order {result.OrderCode} was approved.",
            cancellationToken);
        return result;
    }

    public async Task<AdminReturnRequestDetailDto> RejectAsync(
        Guid returnRequestId,
        Guid adminUserId,
        RejectReturnRequestRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureReturnId(returnRequestId);
        EnsureUserId(adminUserId);

        if (request is null)
            throw new AppException("Reject request body is required.");

        var adminNote = RequireAdminNote(request.AdminNote);

        var existing = await _repository.GetDetailAsync(returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        if (!string.Equals(existing.Status, ReturnConstants.StatusPending, StringComparison.OrdinalIgnoreCase))
            throw new ConflictException("Only pending return requests can be rejected.");

        var result = await _repository.RejectAsync(returnRequestId, adminUserId, adminNote, cancellationToken);
        await NotifyBuyerReturnAsync(
            result,
            "Return request rejected",
            $"Your return request for order {result.OrderCode} was rejected. Note: {adminNote}",
            cancellationToken);
        return result;
    }

    public async Task<AdminReturnRequestDetailDto> UpdateStatusAsync(
        Guid returnRequestId,
        Guid adminUserId,
        UpdateReturnStatusRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureReturnId(returnRequestId);
        EnsureUserId(adminUserId);

        if (request is null)
            throw new AppException("Status update body is required.");

        var toStatus = request.Status?.Trim() ?? string.Empty;
        var canonical = ReturnConstants.StatusTransitions.Values
            .Concat(ReturnConstants.StatusTransitions.Keys)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(s => string.Equals(s, toStatus, StringComparison.OrdinalIgnoreCase));

        if (canonical is null
            || (!string.Equals(canonical, ReturnConstants.StatusReceiving, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(canonical, ReturnConstants.StatusRefunded, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(canonical, ReturnConstants.StatusClosed, StringComparison.OrdinalIgnoreCase)))
        {
            throw new AppException("Status must be Receiving, Refunded, or Closed.");
        }

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

        var existing = await _repository.GetDetailAsync(returnRequestId, cancellationToken)
            ?? throw new NotFoundException("Return request not found.");

        if (!ReturnConstants.StatusTransitions.TryGetValue(existing.Status, out var expected)
            || !string.Equals(expected, canonical, StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException(
                $"Cannot transition return request from {existing.Status} to {canonical}.");
        }

        string? refundToBin = null;
        string? refundToAccountNumber = null;
        if (string.Equals(canonical, ReturnConstants.StatusRefunded, StringComparison.OrdinalIgnoreCase))
        {
            refundToBin = string.IsNullOrWhiteSpace(request.RefundToBin)
                ? null
                : request.RefundToBin.Trim();
            refundToAccountNumber = string.IsNullOrWhiteSpace(request.RefundToAccountNumber)
                ? null
                : request.RefundToAccountNumber.Trim();

            if (refundToBin is { Length: > 20 })
                throw new AppException("Refund bank BIN must not exceed 20 characters.");
            if (refundToAccountNumber is { Length: > 30 })
                throw new AppException("Refund bank account number must not exceed 30 characters.");
        }

        var result = await _repository.UpdateStatusAsync(
            returnRequestId,
            adminUserId,
            canonical,
            note,
            refundToBin,
            refundToAccountNumber,
            cancellationToken);

        if (string.Equals(canonical, ReturnConstants.StatusRefunded, StringComparison.OrdinalIgnoreCase))
        {
            await NotifyBuyerReturnAsync(
                result,
                "Refund completed",
                $"Your refund for order {result.OrderCode} has been completed.",
                cancellationToken);
        }

        return result;
    }

    private async Task NotifyBuyerReturnAsync(
        AdminReturnRequestDetailDto detail,
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

    private static AdminReturnRequestListItemDto MapListItem(AdminReturnListRecord record) =>
        new()
        {
            ReturnRequestId = record.ReturnRequestId,
            OrderId = record.OrderId,
            OrderCode = record.OrderCode,
            ShopId = record.ShopId,
            ShopName = record.ShopName,
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
        {
            throw new AppException(
                "Status filter must be Pending, Approved, Rejected, Receiving, Refunded, Closed, or all.");
        }

        return match;
    }

    private static string? NormalizeSearch(string? q)
    {
        if (string.IsNullOrWhiteSpace(q))
            return null;

        var trimmed = q.Trim();
        if (trimmed.Length > ReturnConstants.MaxListSearchLength)
        {
            throw new AppException(
                $"Search keyword must not exceed {ReturnConstants.MaxListSearchLength} characters.");
        }

        return trimmed;
    }

    private static string RequireAdminNote(string? adminNote)
    {
        var trimmed = adminNote?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new AppException("Admin note is required when rejecting a return request.");

        if (trimmed.Length > ReturnConstants.MaxAdminNoteLength)
        {
            throw new AppException(
                $"Admin note must not exceed {ReturnConstants.MaxAdminNoteLength} characters.");
        }

        return trimmed;
    }

    private static void EnsureReturnId(Guid returnRequestId)
    {
        if (returnRequestId == Guid.Empty)
            throw new AppException("Return request id is required.");
    }

    private static void EnsureUserId(Guid adminUserId)
    {
        if (adminUserId == Guid.Empty)
            throw new AppException("Admin user id is required.");
    }
}
