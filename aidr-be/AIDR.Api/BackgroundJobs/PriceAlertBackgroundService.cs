using AIDR.Modules.Engagement.Abstractions;
using AIDR.Modules.Engagement.Services;
using Microsoft.Extensions.Options;

namespace AIDR.Api.BackgroundJobs;

/// <summary>
/// Evaluates active price alerts and sends promo notifications when thresholds are met.
/// </summary>
public sealed class PriceAlertBackgroundService : BackgroundService
{
    private static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(20);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly PriceAlertOptions _options;
    private readonly ILogger<PriceAlertBackgroundService> _logger;

    public PriceAlertBackgroundService(
        IServiceScopeFactory scopeFactory,
        IOptions<PriceAlertOptions> options,
        ILogger<PriceAlertBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.EnableBackgroundJob)
        {
            _logger.LogInformation("Price alert background job is disabled by configuration.");
            return;
        }

        var interval = TimeSpan.FromMinutes(Math.Max(1, _options.JobIntervalMinutes));
        _logger.LogInformation("Price alert sweep starting; interval {Interval}", interval);

        try
        {
            await Task.Delay(StartupDelay, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        using var timer = new PeriodicTimer(interval);

        do
        {
            await RunOnceAsync(stoppingToken);
        }
        while (await SafeWaitAsync(timer, stoppingToken));
    }

    private async Task RunOnceAsync(CancellationToken stoppingToken)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var service = scope.ServiceProvider.GetRequiredService<IPriceAlertService>();
            var triggered = await service.RunSweepAsync(stoppingToken);
            if (triggered > 0)
                _logger.LogInformation("Price alert sweep sent {Count} notification(s).", triggered);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Price alert sweep failed.");
        }
    }

    private static async Task<bool> SafeWaitAsync(PeriodicTimer timer, CancellationToken stoppingToken)
    {
        try
        {
            return await timer.WaitForNextTickAsync(stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }
}
