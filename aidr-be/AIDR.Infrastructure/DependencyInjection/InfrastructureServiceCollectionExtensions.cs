using System.Text;
using AIDR.Infrastructure.Admin;
using AIDR.Infrastructure.Auth;
using AIDR.Infrastructure.Caching;
using AIDR.Infrastructure.Discovery;
using AIDR.Infrastructure.Ordering;
using AIDR.Infrastructure.PayOs;
using AIDR.Infrastructure.Persistence;
using AIDR.Infrastructure.Profile;
using AIDR.Infrastructure.SellerCenter;
using AIDR.Modules.Admin.Abstractions;
using AIDR.Modules.Auth.Abstractions;
using AIDR.Modules.Auth.Services;
using AIDR.Modules.Discovery.Abstractions;
using AIDR.Modules.Order.Abstractions;
using AIDR.Modules.Payment.Abstractions;
using AIDR.Modules.Payment.Services;
using AIDR.Modules.Profile.Abstractions;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Shared.Caching;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace AIDR.Infrastructure.DependencyInjection;

public static class InfrastructureServiceCollectionExtensions
{
    public static IServiceCollection AddAidrInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("AidrDb")
            ?? throw new InvalidOperationException("Connection string 'AidrDb' is missing.");

        services.AddDbContext<AidrDbContext>(options =>
            options.UseSqlServer(connectionString));

        var useInMemoryCache = configuration.GetValue("Caching:UseInMemory", false);
        if (useInMemoryCache)
        {
            services.AddDistributedMemoryCache();
        }
        else
        {
            var redisConnection = configuration.GetConnectionString("Redis") ?? "localhost:6379";
            services.AddStackExchangeRedisCache(options =>
            {
                options.Configuration = redisConnection;
                options.InstanceName = "aidr:";
            });
        }

        services.AddSingleton<ICacheService, RedisCacheService>();

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<KeycloakOptions>(configuration.GetSection(KeycloakOptions.SectionName));
        services.Configure<AuthOptions>(configuration.GetSection(AuthOptions.SectionName));
        services.Configure<SmtpOptions>(configuration.GetSection(SmtpOptions.SectionName));
        services.Configure<PayOsOptions>(configuration.GetSection(PayOsOptions.SectionName));

        services.AddScoped<IAuthUserRepository, AuthUserRepository>();
        services.AddScoped<IProfileRepository, ProfileRepository>();
        services.AddScoped<IDiscoveryRepository, DiscoveryRepository>();
        services.AddScoped<IAdminCategoryRepository, AdminCategoryRepository>();
        services.AddScoped<IAdminSellerRegistrationRepository, AdminSellerRegistrationRepository>();
        services.AddScoped<IAdminProductModerationRepository, AdminProductModerationRepository>();
        services.AddScoped<ISellerProductRepository, SellerProductRepository>();
        services.AddScoped<ISellerInventoryRepository, SellerInventoryRepository>();
        services.AddScoped<ISellerOrderRepository, SellerOrderRepository>();
        services.AddScoped<ICartRepository, CartRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IPaymentRepository, PaymentRepository>();
        services.AddSingleton<IPayOsClient, PayOsClient>();
        services.AddScoped<IPasswordResetTokenStore, PasswordResetTokenStore>();
        services.AddScoped<ITokenService, JwtTokenService>();
        services.AddSingleton<IPasswordHasher, AspNetPasswordHasher>();
        services.AddSingleton<IEmailSender, LoggingEmailSender>();
        services.AddHttpClient<IKeycloakOidcClient, KeycloakOidcClient>();

        return services;
    }

    public static IServiceCollection AddAidrJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var jwt = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
            ?? throw new InvalidOperationException("Jwt configuration is missing.");

        if (string.IsNullOrWhiteSpace(jwt.SigningKey) || jwt.SigningKey.Length < 32)
            throw new InvalidOperationException("Jwt:SigningKey must be at least 32 characters.");

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwt.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromMinutes(1),
                    RoleClaimType = System.Security.Claims.ClaimTypes.Role
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

        return services;
    }
}
