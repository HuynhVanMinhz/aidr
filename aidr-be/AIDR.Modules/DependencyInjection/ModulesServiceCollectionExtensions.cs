namespace AIDR.Modules.DependencyInjection;

using Microsoft.Extensions.DependencyInjection;

public static class ModulesServiceCollectionExtensions
{
    /// <summary>
    /// Register application modules (Auth, Discovery, …). Foundation leaves placeholders.
    /// </summary>
    public static IServiceCollection AddAidrModules(this IServiceCollection services)
    {
        // Module services will be registered here in later plan items.
        return services;
    }
}
