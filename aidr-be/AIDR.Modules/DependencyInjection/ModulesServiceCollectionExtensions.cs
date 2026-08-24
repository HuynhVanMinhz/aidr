using AIDR.Modules.Admin.Abstractions;
using AIDR.Modules.Admin.Services;
using AIDR.Modules.Auth.Abstractions;
using AIDR.Modules.Auth.Services;
using AIDR.Modules.Discovery.Abstractions;
using AIDR.Modules.Discovery.Services;
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
        services.AddScoped<IDiscoveryService, DiscoveryService>();
        services.AddScoped<IAdminCategoryService, AdminCategoryService>();
        services.AddScoped<IAdminSellerRegistrationService, AdminSellerRegistrationService>();
        return services;
    }
}
