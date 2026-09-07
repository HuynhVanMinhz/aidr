using System.Globalization;
using System.Net;
using System.Text;
using AIDR.Modules.Auth.Abstractions;
using AIDR.Modules.Order.Abstractions;
using AIDR.Shared.Dtos.Order;
using AIDR.Shared.Dtos.Payment;
using Microsoft.Extensions.Logging;

namespace AIDR.Modules.Payment.Services;

/// <summary>
/// Builds and sends an HTML sales invoice email after a payment first becomes Paid.
/// </summary>
public sealed class OrderInvoiceMailer
{
    private readonly IOrderRepository _orders;
    private readonly IAuthUserRepository _users;
    private readonly IEmailSender _email;
    private readonly ILogger<OrderInvoiceMailer> _logger;

    public OrderInvoiceMailer(
        IOrderRepository orders,
        IAuthUserRepository users,
        IEmailSender email,
        ILogger<OrderInvoiceMailer> logger)
    {
        _orders = orders;
        _users = users;
        _email = email;
        _logger = logger;
    }

    public async Task TrySendAfterPaidAsync(
        PayOsWebhookResult result,
        CancellationToken cancellationToken = default)
    {
        if (result.OrderId is not { } orderId || orderId == Guid.Empty)
            return;
        if (result.BuyerUserId is not { } buyerId || buyerId == Guid.Empty)
            return;

        try
        {
            var buyer = await _users.FindByIdAsync(buyerId, cancellationToken);
            if (buyer is null || string.IsNullOrWhiteSpace(buyer.Email))
            {
                _logger.LogWarning(
                    "Skipping invoice email for order {OrderId}: buyer email missing",
                    orderId);
                return;
            }

            var order = await _orders.GetBuyerOrderAsync(buyerId, orderId, cancellationToken);
            if (order is null)
            {
                _logger.LogWarning(
                    "Skipping invoice email for order {OrderId}: order detail not found",
                    orderId);
                return;
            }

            var subject = $"AIDR invoice — {order.OrderCode}";
            var html = BuildHtml(order, buyer.FullName);
            await _email.SendAsync(buyer.Email, subject, html, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to send invoice email for order {OrderId}",
                orderId);
        }
    }

    internal static string BuildHtml(BuyerOrderDetailDto order, string buyerName)
    {
        var sb = new StringBuilder();
        sb.Append("<!DOCTYPE html><html><body style=\"font-family:Segoe UI,Arial,sans-serif;color:#16181d;\">");
        sb.Append("<div style=\"max-width:640px;margin:0 auto;padding:24px;\">");
        sb.Append("<h1 style=\"font-size:22px;margin:0 0 8px;\">AIDR Invoice</h1>");
        sb.Append("<p style=\"margin:0 0 20px;color:#555;\">Thank you for your purchase.</p>");

        sb.Append("<table style=\"width:100%;border-collapse:collapse;margin-bottom:20px;\">");
        AppendMeta(sb, "Invoice / Order", Encode(order.OrderCode));
        AppendMeta(sb, "Paid at", Encode(FormatDate(order.PaidAt ?? order.UpdatedAt)));
        AppendMeta(sb, "Shop", Encode(order.ShopName));
        AppendMeta(sb, "Buyer", Encode(string.IsNullOrWhiteSpace(buyerName) ? "Customer" : buyerName));
        sb.Append("</table>");

        sb.Append("<h2 style=\"font-size:16px;margin:0 0 8px;\">Ship to</h2>");
        sb.Append("<p style=\"margin:0 0 20px;line-height:1.5;\">");
        sb.Append(Encode(order.Shipping.ReceiverName)).Append("<br/>");
        sb.Append(Encode(order.Shipping.Phone)).Append("<br/>");
        sb.Append(Encode(FormatAddress(order.Shipping)));
        sb.Append("</p>");

        sb.Append("<h2 style=\"font-size:16px;margin:0 0 8px;\">Items</h2>");
        sb.Append("<table style=\"width:100%;border-collapse:collapse;margin-bottom:16px;\">");
        sb.Append("<thead><tr>");
        sb.Append("<th style=\"text-align:left;border-bottom:1px solid #ddd;padding:8px 4px;\">Product</th>");
        sb.Append("<th style=\"text-align:right;border-bottom:1px solid #ddd;padding:8px 4px;\">Qty</th>");
        sb.Append("<th style=\"text-align:right;border-bottom:1px solid #ddd;padding:8px 4px;\">Amount</th>");
        sb.Append("</tr></thead><tbody>");

        foreach (var item in order.Items)
        {
            var name = item.ProductName;
            if (!string.IsNullOrWhiteSpace(item.VariantName))
                name = $"{name} ({item.VariantName})";

            sb.Append("<tr>");
            sb.Append("<td style=\"padding:8px 4px;border-bottom:1px solid #eee;\">").Append(Encode(name)).Append("</td>");
            sb.Append("<td style=\"padding:8px 4px;border-bottom:1px solid #eee;text-align:right;\">")
                .Append(item.Quantity).Append("</td>");
            sb.Append("<td style=\"padding:8px 4px;border-bottom:1px solid #eee;text-align:right;\">")
                .Append(Encode(FormatMoney(item.LineTotal, order.Currency))).Append("</td>");
            sb.Append("</tr>");
        }

        sb.Append("</tbody></table>");

        sb.Append("<table style=\"width:100%;border-collapse:collapse;margin-bottom:24px;\">");
        AppendTotal(sb, "Subtotal", FormatMoney(order.SubtotalAmount, order.Currency));
        if (order.DiscountAmount > 0)
            AppendTotal(sb, "Discount", $"-{FormatMoney(order.DiscountAmount, order.Currency)}");
        AppendTotal(sb, "Shipping", order.ShippingFee > 0 ? FormatMoney(order.ShippingFee, order.Currency) : "Free");
        AppendTotal(sb, "Total", FormatMoney(order.TotalAmount, order.Currency), bold: true);
        sb.Append("</table>");

        sb.Append("<p style=\"font-size:12px;color:#888;margin:0;\">This is an automated receipt from AIDR.</p>");
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

    private static void AppendTotal(StringBuilder sb, string label, string value, bool bold = false)
    {
        var weight = bold ? "700" : "400";
        sb.Append("<tr><td style=\"padding:4px 0;font-weight:")
            .Append(weight)
            .Append(";\">")
            .Append(Encode(label))
            .Append("</td><td style=\"padding:4px 0;text-align:right;font-weight:")
            .Append(weight)
            .Append(";\">")
            .Append(Encode(value))
            .Append("</td></tr>");
    }

    private static string FormatAddress(BuyerOrderShippingDto s) =>
        $"{s.StreetAddress}, {s.Ward}, {s.District}, {s.Province}";

    private static string FormatDate(DateTime value) =>
        value.ToString("yyyy-MM-dd HH:mm 'UTC'", CultureInfo.InvariantCulture);

    private static string FormatMoney(decimal amount, string currency) =>
        string.Equals(currency, "VND", StringComparison.OrdinalIgnoreCase)
            ? $"{amount.ToString("N0", CultureInfo.InvariantCulture)} VND"
            : $"{amount.ToString("N2", CultureInfo.InvariantCulture)} {currency}";

    private static string Encode(string? value) =>
        WebUtility.HtmlEncode(value ?? string.Empty);
}
