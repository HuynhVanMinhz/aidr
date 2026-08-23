using AIDR.Api.Hubs;
using AIDR.Api.Middleware;
using AIDR.Infrastructure.DependencyInjection;
using AIDR.Modules.DependencyInjection;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, cfg) =>
    cfg.ReadFrom.Configuration(ctx.Configuration)
        .Enrich.FromLogContext()
        .WriteTo.Console());

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddSignalR();
builder.Services.AddAidrInfrastructure(builder.Configuration);
builder.Services.AddAidrModules();

var keycloakAuthority = builder.Configuration["Keycloak:Authority"];
var keycloakAudience = builder.Configuration["Keycloak:Audience"] ?? "aidr-api";

if (!string.IsNullOrWhiteSpace(keycloakAuthority))
{
    builder.Services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.Authority = keycloakAuthority;
            options.Audience = keycloakAudience;
            options.RequireHttpsMetadata = builder.Configuration.GetValue("Keycloak:RequireHttpsMetadata", false);
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateAudience = false,
                ValidateIssuer = true,
                RoleClaimType = "roles"
            };
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    var accessToken = context.Request.Query["access_token"];
                    var path = context.HttpContext.Request.Path;
                    if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                    {
                        context.Token = accessToken;
                    }
                    return Task.CompletedTask;
                }
            };
        });
}
else
{
    builder.Services.AddAuthentication();
}

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
var redisConnection = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379";

builder.Services.AddHealthChecks()
    .AddSqlServer(sqlConnection, name: "sqlserver", tags: ["ready"])
    .AddRedis(redisConnection, name: "redis", tags: ["ready"]);

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
        await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }
});

app.MapGet("/api", () => Results.Ok(new
{
    name = "AIDR API",
    version = "0.1.0",
    module = "Foundation"
}));

app.Run();

public partial class Program;
