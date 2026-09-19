using AIDR.Api.BackgroundJobs;
using AIDR.Api.Hubs;
using AIDR.Api.Middleware;
using AIDR.Api.Realtime;
using AIDR.Infrastructure.DependencyInjection;
using AIDR.Modules.DependencyInjection;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Shared.Serialization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Serilog;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, cfg) =>
    cfg.ReadFrom.Configuration(ctx.Configuration)
        .Enrich.FromLogContext()
        .WriteTo.Console());

static void ConfigureUtcJson(JsonSerializerOptions options)
{
    options.Converters.Add(new UtcDateTimeJsonConverter());
    options.Converters.Add(new UtcNullableDateTimeJsonConverter());
}

builder.Services.AddControllers().AddJsonOptions(o => ConfigureUtcJson(o.JsonSerializerOptions));
builder.Services.AddOpenApi();
builder.Services.AddSignalR().AddJsonProtocol(o => ConfigureUtcJson(o.PayloadSerializerOptions));
builder.Services.AddAidrInfrastructure(builder.Configuration);
builder.Services.AddAidrModules();

// Escrow pipeline: auto-complete delivered orders, release held settlements, poll payouts.
builder.Services.AddHostedService<SettlementBackgroundService>();

// Fulfillment pipeline: book a shipment per paid order, then let the carrier's
// events carry it through Confirmed -> Shipping -> Delivered.
builder.Services.AddHostedService<ShippingBackgroundService>();
builder.Services.AddHostedService<PriceAlertBackgroundService>();
builder.Services.AddAidrJwtAuthentication(builder.Configuration);
builder.Services.AddScoped<INotificationRealtimePublisher, SignalRNotificationRealtimePublisher>();
builder.Services.AddScoped<IChatRealtimePublisher, SignalRChatRealtimePublisher>();

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Buyer", p => p.RequireRole("BUYER", "Buyer"));
    options.AddPolicy("Seller", p => p.RequireRole("SELLER", "Seller"));
    options.AddPolicy("Admin", p => p.RequireRole("ADMIN", "Admin"));
});

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
    ?? ["http://localhost:5173"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("AidrCors", policy =>
        policy.WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

var sqlConnection = builder.Configuration.GetConnectionString("AidrDb")!;
var useInMemoryCache = builder.Configuration.GetValue("Caching:UseInMemory", false);

var healthChecks = builder.Services.AddHealthChecks()
    .AddSqlServer(sqlConnection, name: "sqlserver", tags: ["ready"]);

if (!useInMemoryCache)
{
    var redisConnection = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379";
    healthChecks.AddRedis(redisConnection, name: "redis", tags: ["ready"]);
}

// A mock identity check that looks real is worse than no check at all - refuse
// to start with it enabled anywhere but Development.
if (!builder.Environment.IsDevelopment()
    && builder.Configuration.GetValue("Ekyc:UseMock", false))
{
    throw new InvalidOperationException(
        "Ekyc:UseMock must be false outside Development. Configure a real eKYC provider API key.");
}

var app = builder.Build();

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AidrCors");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<NotificationHub>("/hubs/notifications");
app.MapHub<ChatHub>("/hubs/chat");

app.MapGet("/api/health/live", () => Results.Json(new
{
    status = "Healthy",
    timestampUtc = DateTime.UtcNow
}));

app.MapHealthChecks("/api/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        var payload = new
        {
            status = report.Status.ToString(),
            checks = report.Entries.ToDictionary(
                e => e.Key,
                e => e.Value.Status.ToString()),
            timestampUtc = DateTime.UtcNow
        };
        await context.Response.WriteAsync(JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            Converters =
            {
                new UtcDateTimeJsonConverter(),
                new UtcNullableDateTimeJsonConverter(),
            }
        }));
    }
});

app.MapGet("/api", () => Results.Ok(new
{
    name = "AIDR API",
    version = "0.4.0",
    module = "Auth, Profile, Discovery, Admin, SellerCenter, Order, Payment, Engagement, Chat"
}));

app.Run();

public partial class Program;
