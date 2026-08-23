using AIDR.Modules.Auth.Abstractions;
using AIDR.Modules.Auth.Services;
using Microsoft.Extensions.DependencyInjection;

namespace AIDR.Modules.DependencyInjection;

public static class ModulesServiceCollectionExtensions
{
    public static IServiceCollection AddAidrModules(this IServiceCollection services)
    {
        services.AddScoped<IAuthService, AuthService>();
        return services;
    }
}
