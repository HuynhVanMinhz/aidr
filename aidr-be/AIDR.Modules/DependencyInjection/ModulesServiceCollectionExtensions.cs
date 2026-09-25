using AIDR.Modules.Admin.Abstractions;
using AIDR.Modules.Admin.Services;
using AIDR.Modules.AI.Abstractions;
using AIDR.Modules.AI.Services;
using AIDR.Modules.Auth.Abstractions;
using AIDR.Modules.Auth.Services;
using AIDR.Modules.Discovery.Abstractions;
using AIDR.Modules.Discovery.Services;
using AIDR.Modules.Engagement.Abstractions;
using AIDR.Modules.Kyc.Abstractions;
using AIDR.Modules.Discovery.Services;
using AIDR.Modules.Engagement.Services;
using AIDR.Modules.Kyc.Services;
using AIDR.Modules.Order.Abstractions;
using AIDR.Modules.Order.Services;
using AIDR.Modules.Payment.Abstractions;
using AIDR.Modules.Payment.Services;
using AIDR.Modules.Profile.Abstractions;
using AIDR.Modules.Profile.Services;
using AIDR.Modules.SellerCenter.Abstractions;
using AIDR.Modules.SellerCenter.Services;
using AIDR.Modules.Settlement.Abstractions;
using AIDR.Modules.Settlement.Services;
using AIDR.Modules.Shipping.Abstractions;
using AIDR.Modules.Shipping.Services;
using Microsoft.Extensions.DependencyInjection;

namespace AIDR.Modules.DependencyInjection;

public static class ModulesServiceCollectionExtensions
{
    public static IServiceCollection AddAidrModules(this IServiceCollection services)
    {
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IProfileService, ProfileService>();
        services.AddScoped<ISellerRegistrationService, SellerRegistrationService>();
        services.AddScoped<IDiscoveryService, DiscoveryService>();
        services.AddScoped<IRecommendationService, RecommendationService>();
        services.AddScoped<IAiNlFilterService, AiNlFilterService>();
        services.AddScoped<IAiCompareService, AiCompareService>();
        services.AddScoped<IAiAnalyticsService, AiAnalyticsService>();
        services.AddScoped<IAiShoppingAssistantService, AiShoppingAssistantService>();
        services.AddSingleton<AccessoryRulesProvider>();
        services.AddScoped<IProductBundleService, ProductBundleService>();
        services.AddScoped<ICompatibilityService, CompatibilityService>();
        services.AddScoped<IAdminCategoryService, AdminCategoryService>();
        services.AddScoped<IAdminSellerRegistrationService, AdminSellerRegistrationService>();
        services.AddScoped<IAdminProductModerationService, AdminProductModerationService>();
        services.AddScoped<IAdminSystemVoucherService, AdminSystemVoucherService>();
        services.AddScoped<IAdminReturnService, AdminReturnService>();
        services.AddScoped<ReturnRefundMailer>();
        services.AddScoped<IAdminAccountService, AdminAccountService>();
        services.AddScoped<IAdminCustomerInsightService, AdminCustomerInsightService>();
        services.AddScoped<IAdminDashboardService, AdminDashboardService>();
        services.AddScoped<IAdminOrderService, AdminOrderService>();
        services.AddScoped<ISellerProductService, SellerProductService>();
        services.AddScoped<ISellerProductExcelService, SellerProductExcelService>();
        services.AddScoped<ISellerInventoryService, SellerInventoryService>();
        services.AddScoped<ISellerOrderService, SellerOrderService>();
        services.AddScoped<ISellerReturnService, SellerReturnService>();
        services.AddScoped<ISellerShopVoucherService, SellerShopVoucherService>();
        services.AddScoped<ISellerFinanceService, SellerFinanceService>();
        services.AddScoped<ISellerShopService, SellerShopService>();
        services.AddScoped<ICartService, CartService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<IReturnService, ReturnService>();
        services.AddScoped<IReturnShipmentService, ReturnShipmentService>();
        services.AddScoped<IVoucherService, VoucherService>();
        services.AddScoped<OrderInvoiceMailer>();
        services.AddScoped<IPaymentService, PaymentService>();
        services.AddScoped<ISettlementService, SettlementService>();
        services.AddScoped<IShippingService, ShippingService>();
        services.AddScoped<IKycService, KycService>();
        services.AddScoped<IWishlistService, WishlistService>();
        services.AddScoped<IPriceAlertService, PriceAlertService>();
        services.AddScoped<IBuyerProtectionTimelineService, BuyerProtectionTimelineService>();
        services.AddScoped<IReviewDigestService, ReviewDigestService>();
        services.AddScoped<IProductReviewService, ProductReviewService>();
        services.AddScoped<ISellerRatingService, SellerRatingService>();
        services.AddScoped<IFollowService, FollowService>();
        services.AddScoped<IFollowFeedService, FollowFeedService>();
        services.AddScoped<IProductQaService, ProductQaService>();
        services.AddScoped<IShopTrustBadgeService, ShopTrustBadgeService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IChatService, ChatService>();
        return services;
    }
}
