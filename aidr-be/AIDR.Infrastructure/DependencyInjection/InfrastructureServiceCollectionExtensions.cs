using AIDR.Infrastructure.Caching;
using AIDR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AIDR.Infrastructure.DependencyInjection;

public static class InfrastructureServiceCollectionExtensions
{
    public static IServiceCollection AddAidrInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("AidrDb")
            ?? throw new InvalidOperationException("Connection string 'AidrDb' is missing.");

        services.AddDbContext<AidrDbContext>(options =>
            options.UseSqlServer(connectionString));

        var redisConnection = configuration.GetConnectionString("Redis") ?? "localhost:6379";
        services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = redisConnection;
            options.InstanceName = "aidr:";
        });
        services.AddSingleton<ICacheService, RedisCacheService>();

        return services;
    }
}
