using System.Globalization;
using System.Net;
using System.Text;
using AIDR.Modules.Auth.Abstractions;
using Microsoft.Extensions.Logging;

namespace AIDR.Modules.Admin.Services;

/// <summary>
/// Emails the buyer after an admin marks a return as Refunded, including the transfer proof image.
/// </summary>
public sealed class ReturnRefundMailer
{
    private readonly IEmailSender _email;
    private readonly ILogger<ReturnRefundMailer> _logger;

    public ReturnRefundMailer(IEmailSender email, ILogger<ReturnRefundMailer> logger)
    {
        _email = email;
        _logger = logger;
    }

    public async Task TrySendAfterRefundedAsync(
        string? buyerEmail,
        string? buyerFullName,
        string orderCode,
        decimal refundAmount,
        string proofImageUrl,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(buyerEmail))
        {
            _logger.LogWarning(
                "Skipping refund email for order {OrderCode}: buyer email missing",
                orderCode);
            return;
        }

        if (string.IsNullOrWhiteSpace(proofImageUrl))
        {
            _logger.LogWarning(
                "Skipping refund email for order {OrderCode}: proof image missing",
                orderCode);
            return;
        }

        try
        {
            var subject = $"AIDR refund completed - {orderCode}";
            var html = BuildHtml(
                string.IsNullOrWhiteSpace(buyerFullName) ? "Customer" : buyerFullName.Trim(),
                orderCode,
                refundAmount,
                proofImageUrl.Trim());
            await _email.SendAsync(buyerEmail.Trim(), subject, html, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to send refund email for order {OrderCode}",
                orderCode);
        }
    }

    internal static string BuildHtml(
        string buyerName,
        string orderCode,
        decimal refundAmount,
        string proofImageUrl)
    {
        var sb = new StringBuilder();
        sb.Append("<!DOCTYPE html><html><body style=\"font-family:Segoe UI,Arial,sans-serif;color:#16181d;\">");
        sb.Append("<div style=\"max-width:640px;margin:0 auto;padding:24px;\">");
        sb.Append("<h1 style=\"font-size:22px;margin:0 0 8px;\">Refund completed</h1>");
        sb.Append("<p style=\"margin:0 0 20px;color:#555;\">Hi ")
            .Append(Encode(buyerName))
            .Append(", your refund for order <strong>")
            .Append(Encode(orderCode))
            .Append("</strong> has been transferred to your bank account.</p>");

        sb.Append("<table style=\"width:100%;border-collapse:collapse;margin-bottom:20px;\">");
        AppendMeta(sb, "Order", Encode(orderCode));
        AppendMeta(sb, "Refund amount", Encode(FormatMoney(refundAmount)));
        sb.Append("</table>");

        sb.Append("<h2 style=\"font-size:16px;margin:0 0 8px;\">Transfer proof</h2>");
        sb.Append("<p style=\"margin:0 0 12px;color:#555;\">A screenshot of the bank transfer is attached below.</p>");
        sb.Append("<p style=\"margin:0 0 20px;\">");
        sb.Append("<img src=\"")
            .Append(Encode(proofImageUrl))
            .Append("\" alt=\"Refund transfer proof\" style=\"max-width:100%;height:auto;border:1px solid #ddd;border-radius:8px;\" />");
        sb.Append("</p>");
        sb.Append("<p style=\"margin:0 0 20px;font-size:13px;\">");
        sb.Append("<a href=\"")
            .Append(Encode(proofImageUrl))
            .Append("\" style=\"color:#16181d;\">Open full-size image</a>");
        sb.Append("</p>");

        sb.Append("<p style=\"font-size:12px;color:#888;margin:0;\">This is an automated message from AIDR.</p>");
        sb.Append("</div></body></html>");
        return sb.ToString();
    }

    private static void AppendMeta(StringBuilder sb, string label, string value)
    {
        sb.Append("<tr><td style=\"padding:4px 0;color:#666;width:140px;\">")
            .Append(Encode(label))
            .Append("</td><td style=\"padding:4px 0;\">")
            .Append(value)
            .Append("</td></tr>");
    }

    private static string FormatMoney(decimal amount) =>
        $"{amount.ToString("N0", CultureInfo.InvariantCulture)} VND";

    private static string Encode(string? value) =>
        WebUtility.HtmlEncode(value ?? string.Empty);
}
