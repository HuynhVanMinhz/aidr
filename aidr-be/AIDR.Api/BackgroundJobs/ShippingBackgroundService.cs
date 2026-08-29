using AIDR.Modules.Shipping.Abstractions;
using Microsoft.Extensions.Options;

namespace AIDR.Api.BackgroundJobs;

/// <summary>
/// Keeps orders moving on their own: books a GHN shipment for every paid order,
/// then asks GHN what happened for the webhooks that never arrived.
///
/// Single-instance assumption, same as <see cref="SettlementBackgroundService"/>:
/// scaling the API out needs an app lock so two hosts do not sweep together.
/// </summary>
public sealed class ShippingBackgroundService : BackgroundService
{
    private static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(20);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ShippingOptions _options;
    private readonly ILogger<ShippingBackgroundService> _logger;

    public ShippingBackgroundService(
        IServiceScopeFactory scopeFactory,
        IOptions<ShippingOptions> options,
        ILogger<ShippingBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.EnableBackgroundJob || !_options.EnableAutoFulfillment)
        {
            _logger.LogInformation(
                "Shipping sweep is disabled (job: {Job}, auto: {Auto})",
                _options.EnableBackgroundJob,
                _options.EnableAutoFulfillment);
            return;
        }

        if (!_options.Ghn.IsConfigured)
        {
            // Booting is still correct — sellers can drive orders by hand — but
            // silence here would look like the sweep is running when it is not.
            _logger.LogWarning(
                "Shipping sweep is idle: {Provider} has no credentials. Set Shipping:Ghn:Token and Shipping:Ghn:ShopId to enable automatic fulfillment.",
                _options.NormalizedProvider);
            return;
        }

        var interval = TimeSpan.FromMinutes(Math.Max(1, _options.JobIntervalMinutes));
        _logger.LogInformation(
            "Shipping sweep starting; provider {Provider}, interval {Interval}",
            _options.NormalizedProvider,
            interval);

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
            var shipping = scope.ServiceProvider.GetRequiredService<IShippingService>();

            var result = await shipping.RunSweepAsync(ct);

            if (result.HasWork)
            {
                _logger.LogInformation(
                    "Shipping sweep: {Created} shipments booked, {Events} carrier events applied, {Advanced} orders advanced, {Failures} dispatch failures",
                    result.ShipmentsCreated,
                    result.EventsApplied,
                    result.OrdersAdvanced,
                    result.DispatchFailures);
            }

            foreach (var error in result.Errors)
                _logger.LogWarning("Shipping sweep step failed: {Error}", error);
        }
        catch (OperationCanceledException)
        {
            // Shutting down.
        }
        catch (Exception ex)
        {
            // A failed sweep must never take the host down; the next tick retries.
            _logger.LogError(ex, "Shipping sweep failed");
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
