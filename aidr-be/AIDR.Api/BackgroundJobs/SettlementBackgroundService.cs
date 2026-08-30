using AIDR.Modules.Settlement.Abstractions;
using Microsoft.Extensions.Options;

namespace AIDR.Api.BackgroundJobs;

/// <summary>
/// Moves the settlement pipeline forward without anyone clicking: auto-completes
/// delivered orders the buyer forgot to confirm, makes held settlements eligible
/// once their hold window is over, and polls payouts payOS has not finalised.
///
/// Single-instance assumption: if the API is ever scaled out, this needs an app
/// lock so two instances do not sweep at the same time.
/// </summary>
public sealed class SettlementBackgroundService : BackgroundService
{
    private static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(30);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly SettlementOptions _options;
    private readonly ILogger<SettlementBackgroundService> _logger;

    public SettlementBackgroundService(
        IServiceScopeFactory scopeFactory,
        IOptions<SettlementOptions> options,
        ILogger<SettlementBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.EnableBackgroundJob)
        {
            _logger.LogInformation("Settlement background job is disabled by configuration.");
            return;
        }

        var interval = TimeSpan.FromMinutes(Math.Max(1, _options.JobIntervalMinutes));
        _logger.LogInformation("Settlement sweep starting; interval {Interval}", interval);

        // Let the app finish booting before touching the database.
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

    private async Task RunOnceAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var settlements = scope.ServiceProvider.GetRequiredService<ISettlementService>();

            var result = await settlements.RunSweepAsync(ct);

            if (result.AutoCompletedOrders > 0 || result.EntriesMadeEligible > 0 || result.BatchesPolled > 0)
            {
                _logger.LogInformation(
                    "Settlement sweep: {Completed} orders auto-completed, {Eligible} settlements now eligible, {Polled} payouts polled",
                    result.AutoCompletedOrders,
                    result.EntriesMadeEligible,
                    result.BatchesPolled);
            }

            foreach (var error in result.Errors)
                _logger.LogWarning("Settlement sweep step failed: {Error}", error);
        }
        catch (OperationCanceledException)
        {
            // Shutting down.
        }
        catch (Exception ex)
        {
            // A failed sweep must never take the host down; the next tick retries.
            _logger.LogError(ex, "Settlement sweep failed");
        }
    }

    private static async Task<bool> SafeWaitAsync(PeriodicTimer timer, CancellationToken ct)
    {
        try
        {
            return await timer.WaitForNextTickAsync(ct);
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }
}
