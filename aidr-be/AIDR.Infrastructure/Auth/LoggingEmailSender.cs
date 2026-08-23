using System.Net;
using System.Net.Mail;
using AIDR.Modules.Auth.Abstractions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AIDR.Infrastructure.Auth;

public sealed class SmtpOptions
{
    public const string SectionName = "Smtp";

    public bool Enabled { get; set; }
    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 25;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public bool EnableSsl { get; set; }
    public string From { get; set; } = "noreply@aidr.local";
    public string FromDisplayName { get; set; } = "AIDR";
}

public sealed class LoggingEmailSender : IEmailSender
{
    private readonly ILogger<LoggingEmailSender> _logger;
    private readonly SmtpOptions _smtp;

    public LoggingEmailSender(ILogger<LoggingEmailSender> logger, IOptions<SmtpOptions> smtp)
    {
        _logger = logger;
        _smtp = smtp.Value;
    }

    public async Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        if (!_smtp.Enabled)
        {
            _logger.LogInformation(
                "Email (dev/log) To={To} Subject={Subject} Body={Body}",
                toEmail,
                subject,
                htmlBody);
            return;
        }

        using var message = new MailMessage
        {
            From = new MailAddress(_smtp.From, _smtp.FromDisplayName),
            Subject = subject,
            Body = htmlBody,
            IsBodyHtml = true
        };
        message.To.Add(toEmail);

        using var client = new SmtpClient(_smtp.Host, _smtp.Port)
        {
            EnableSsl = _smtp.EnableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network
        };

        if (!string.IsNullOrWhiteSpace(_smtp.Username))
            client.Credentials = new NetworkCredential(_smtp.Username, _smtp.Password);

        await client.SendMailAsync(message, cancellationToken);
    }
}
