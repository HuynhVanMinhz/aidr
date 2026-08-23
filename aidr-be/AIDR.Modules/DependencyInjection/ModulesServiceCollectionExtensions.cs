using AIDR.Modules.Auth.Abstractions;
using AIDR.Modules.Auth.Services;
using AIDR.Modules.Profile.Abstractions;
using AIDR.Modules.Profile.Services;
using Microsoft.Extensions.DependencyInjection;

namespace AIDR.Modules.DependencyInjection;

public static class ModulesServiceCollectionExtensions
{
    public static IServiceCollection AddAidrModules(this IServiceCollection services)
    {
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IProfileService, ProfileService>();
        return services;
    }
}
