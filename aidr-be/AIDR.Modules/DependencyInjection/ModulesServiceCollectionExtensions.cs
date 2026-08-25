using AIDR.Modules.Admin.Abstractions;
using AIDR.Modules.Admin.Services;
using AIDR.Modules.Auth.Abstractions;
using AIDR.Modules.Auth.Services;
using AIDR.Modules.Discovery.Abstractions;
using AIDR.Modules.Discovery.Services;
using AIDR.Modules.Order.Abstractions;
using AIDR.Modules.Order.Services;
using AIDR.Modules.Payment.Abstractions;
using AIDR.Modules.Payment.Services;
using AIDR.Modules.Profile.Abstractions;
using AIDR.Modules.Profile.Services;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Modules.SellerCenter.Services;
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
        services.AddScoped<IAdminProductModerationService, AdminProductModerationService>();
        services.AddScoped<IAdminSystemVoucherService, AdminSystemVoucherService>();
        services.AddScoped<ISellerProductService, SellerProductService>();
        services.AddScoped<ISellerInventoryService, SellerInventoryService>();
        services.AddScoped<ISellerOrderService, SellerOrderService>();
        services.AddScoped<ICartService, CartService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<IVoucherService, VoucherService>();
        services.AddScoped<IPaymentService, PaymentService>();
        return services;
    }
}
