using AIDR.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace AIDR.Infrastructure.Persistence;

public class AidrDbContext : DbContext
{
    public AidrDbContext(DbContextOptions<AidrDbContext> options) : base(options) { }

    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<Address> Addresses => Set<Address>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Shop> Shops => Set<Shop>();
    public DbSet<SellerRegistrationRequest> SellerRegistrationRequests => Set<SellerRegistrationRequest>();
    public DbSet<Wallet> Wallets => Set<Wallet>();
    public DbSet<WalletTransaction> WalletTransactions => Set<WalletTransaction>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<InventoryLot> InventoryLots => Set<InventoryLot>();
    public DbSet<ProductPriceHistory> ProductPriceHistories => Set<ProductPriceHistory>();
    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
    public DbSet<ProductReview> ProductReviews => Set<ProductReview>();
    public DbSet<SellerRating> SellerRatings => Set<SellerRating>();
    public DbSet<SellerFollow> SellerFollows => Set<SellerFollow>();
    public DbSet<ViewedProductHistory> ViewedProductHistories => Set<ViewedProductHistory>();
    public DbSet<ProductRecommendation> ProductRecommendations => Set<ProductRecommendation>();
    public DbSet<ProductModerationHistory> ProductModerationHistories => Set<ProductModerationHistory>();
    public DbSet<Cart> Carts => Set<Cart>();
    public DbSet<CartItem> CartItems => Set<CartItem>();
    public DbSet<WishlistItem> WishlistItems => Set<WishlistItem>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Voucher> Vouchers => Set<Voucher>();
    public DbSet<VoucherRedemption> VoucherRedemptions => Set<VoucherRedemption>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderItemLotAllocation> OrderItemLotAllocations => Set<OrderItemLotAllocation>();
    public DbSet<OrderStatusHistory> OrderStatusHistories => Set<OrderStatusHistory>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<ReturnRequest> ReturnRequests => Set<ReturnRequest>();
    public DbSet<ReturnRequestItem> ReturnRequestItems => Set<ReturnRequestItem>();
    public DbSet<ReturnEvidence> ReturnEvidences => Set<ReturnEvidence>();
    public DbSet<ReturnStatusHistory> ReturnStatusHistories => Set<ReturnStatusHistory>();
    public DbSet<ChatThread> ChatThreads => Set<ChatThread>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<AiConversation> AiConversations => Set<AiConversation>();
    public DbSet<AiMessage> AiMessages => Set<AiMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Role>(e =>
        {
            e.ToTable("Roles");
            e.HasKey(x => x.RoleId);
            e.Property(x => x.RoleCode).HasMaxLength(32).IsRequired();
            e.HasIndex(x => x.RoleCode).IsUnique();
        });

        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("Users");
            e.HasKey(x => x.UserId);
            e.Property(x => x.Email).HasMaxLength(256).IsRequired();
            e.Property(x => x.PasswordHash).HasMaxLength(512);
            e.Property(x => x.FullName).HasMaxLength(128).IsRequired();
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.HasIndex(x => x.Email).IsUnique();
            e.HasIndex(x => x.KeycloakSub).IsUnique();
        });

        modelBuilder.Entity<UserRole>(e =>
        {
            e.ToTable("UserRoles");
            e.HasKey(x => new { x.UserId, x.RoleId });
            e.HasOne(x => x.User).WithMany(x => x.UserRoles).HasForeignKey(x => x.UserId);
            e.HasOne(x => x.Role).WithMany(x => x.UserRoles).HasForeignKey(x => x.RoleId);
        });

        modelBuilder.Entity<PasswordResetToken>(e =>
        {
            e.ToTable("PasswordResetTokens");
            e.HasKey(x => x.TokenId);
            e.Property(x => x.TokenHash).HasMaxLength(128).IsRequired();
            e.HasOne(x => x.User).WithMany(x => x.PasswordResetTokens).HasForeignKey(x => x.UserId);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.TokenHash);
        });

        modelBuilder.Entity<Address>(e =>
        {
            e.ToTable("Addresses");
            e.HasKey(x => x.AddressId);
            e.Property(x => x.ReceiverName).HasMaxLength(128).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(20).IsRequired();
            e.Property(x => x.Province).HasMaxLength(100).IsRequired();
            e.Property(x => x.District).HasMaxLength(100).IsRequired();
            e.Property(x => x.Ward).HasMaxLength(100).IsRequired();
            e.Property(x => x.StreetAddress).HasMaxLength(256).IsRequired();
            e.HasOne(x => x.User).WithMany(x => x.Addresses).HasForeignKey(x => x.UserId);
            e.HasIndex(x => x.UserId);
        });

        modelBuilder.Entity<Category>(e =>
        {
            e.ToTable("Categories");
            e.HasKey(x => x.CategoryId);
            e.Property(x => x.Name).HasMaxLength(120).IsRequired();
            e.Property(x => x.Slug).HasMaxLength(140).IsRequired();
            e.Property(x => x.Description).HasMaxLength(500);
            e.Property(x => x.ImageUrl).HasMaxLength(512);
            e.HasIndex(x => x.Slug).IsUnique();
            e.HasOne(x => x.Parent)
                .WithMany(x => x.Children)
                .HasForeignKey(x => x.ParentId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Shop>(e =>
        {
            e.ToTable("Shops");
            e.HasKey(x => x.ShopId);
            e.Property(x => x.ShopName).HasMaxLength(150).IsRequired();
            e.Property(x => x.Slug).HasMaxLength(160).IsRequired();
            e.Property(x => x.Tagline).HasMaxLength(200);
            e.Property(x => x.ShortDescription).HasMaxLength(500);
            e.Property(x => x.LogoUrl).HasMaxLength(512);
            e.Property(x => x.BannerUrl).HasMaxLength(512);
            e.Property(x => x.Email).HasMaxLength(256);
            e.Property(x => x.Phone).HasMaxLength(20);
            e.Property(x => x.Hotline).HasMaxLength(20);
            e.Property(x => x.Province).HasMaxLength(100);
            e.Property(x => x.District).HasMaxLength(100);
            e.Property(x => x.Ward).HasMaxLength(100);
            e.Property(x => x.StreetAddress).HasMaxLength(256);
            e.Property(x => x.CostingMethod).HasMaxLength(20).IsRequired();
            e.Property(x => x.ReturnPolicy).HasMaxLength(2000);
            e.Property(x => x.ShippingPolicy).HasMaxLength(2000);
            e.Property(x => x.OpeningHoursJson).HasMaxLength(1000);
            e.Property(x => x.WebsiteUrl).HasMaxLength(512);
            e.Property(x => x.FacebookUrl).HasMaxLength(512);
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.Property(x => x.AvgRating).HasPrecision(3, 2);
            e.HasIndex(x => x.Slug).IsUnique();
            e.HasIndex(x => x.OwnerUserId).IsUnique();
        });

        modelBuilder.Entity<SellerRegistrationRequest>(e =>
        {
            e.ToTable("SellerRegistrationRequests");
            e.HasKey(x => x.RequestId);
            e.Property(x => x.ShopName).HasMaxLength(150).IsRequired();
            e.Property(x => x.BusinessInfo).HasMaxLength(1000);
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.Property(x => x.AdminNote).HasMaxLength(500);
            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Reviewer)
                .WithMany()
                .HasForeignKey(x => x.ReviewedBy)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.Status);
        });

        modelBuilder.Entity<Wallet>(e =>
        {
            e.ToTable("Wallets");
            e.HasKey(x => x.WalletId);
            e.Property(x => x.AvailableBalance).HasPrecision(18, 2);
            e.Property(x => x.PendingBalance).HasPrecision(18, 2);
            e.Property(x => x.Currency).HasMaxLength(3).IsRequired();
            e.HasOne(x => x.Shop).WithMany().HasForeignKey(x => x.ShopId);
            e.HasIndex(x => x.ShopId).IsUnique();
        });

        modelBuilder.Entity<WalletTransaction>(e =>
        {
            e.ToTable("WalletTransactions");
            e.HasKey(x => x.WalletTxId);
            e.Property(x => x.WalletTxId).ValueGeneratedOnAdd();
            e.Property(x => x.TxType).HasMaxLength(30).IsRequired();
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.BalanceAfter).HasPrecision(18, 2);
            e.Property(x => x.ReferenceType).HasMaxLength(40);
            e.Property(x => x.Note).HasMaxLength(300);
            e.HasOne(x => x.Wallet)
                .WithMany(w => w.Transactions)
                .HasForeignKey(x => x.WalletId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.ReferenceType, x.ReferenceId });
        });

        modelBuilder.Entity<Product>(e =>
        {
            e.ToTable("Products");
            e.HasKey(x => x.ProductId);
            e.Property(x => x.Name).HasMaxLength(256).IsRequired();
            e.Property(x => x.Slug).HasMaxLength(280).IsRequired();
            e.Property(x => x.ShortDescription).HasMaxLength(500);
            e.Property(x => x.Brand).HasMaxLength(100);
            e.Property(x => x.ModelNumber).HasMaxLength(100);
            e.Property(x => x.ConditionType).HasMaxLength(20).IsRequired();
            e.Property(x => x.Currency).HasMaxLength(3).IsRequired();
            e.Property(x => x.OriginCountry).HasMaxLength(80);
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.Property(x => x.BasePrice).HasPrecision(18, 2);
            e.Property(x => x.SalePrice).HasPrecision(18, 2);
            e.Property(x => x.LastCostPrice).HasPrecision(18, 2);
            e.Property(x => x.AvgCostPrice).HasPrecision(18, 2);
            e.Property(x => x.AvgRating).HasPrecision(3, 2);
            e.HasOne(x => x.Shop).WithMany().HasForeignKey(x => x.ShopId);
            e.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId);
            e.HasIndex(x => new { x.ShopId, x.Slug }).IsUnique();
            e.HasIndex(x => new { x.CategoryId, x.Status });
            e.HasIndex(x => x.Name);
        });

        modelBuilder.Entity<ProductImage>(e =>
        {
            e.ToTable("ProductImages");
            e.HasKey(x => x.ProductImageId);
            e.Property(x => x.ImageUrl).HasMaxLength(512).IsRequired();
            e.Property(x => x.PublicId).HasMaxLength(256);
            e.HasOne(x => x.Product)
                .WithMany(x => x.Images)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.ProductId);
        });

        modelBuilder.Entity<InventoryLot>(e =>
        {
            e.ToTable("InventoryLots");
            e.HasKey(x => x.LotId);
            e.Property(x => x.LotCode).HasMaxLength(40).IsRequired();
            e.Property(x => x.UnitCost).HasPrecision(18, 2);
            e.Property(x => x.Currency).HasMaxLength(3).IsRequired();
            e.Property(x => x.SupplierName).HasMaxLength(150);
            e.Property(x => x.InvoiceNumber).HasMaxLength(80);
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.Property(x => x.Note).HasMaxLength(500);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId);
            e.HasIndex(x => new { x.ProductId, x.LotCode }).IsUnique();
            e.HasIndex(x => new { x.ProductId, x.Status, x.ReceivedAt });
        });

        modelBuilder.Entity<ProductPriceHistory>(e =>
        {
            e.ToTable("ProductPriceHistories");
            e.HasKey(x => x.PriceHistoryId);
            e.Property(x => x.PriceHistoryId).ValueGeneratedOnAdd();
            e.Property(x => x.OldBasePrice).HasPrecision(18, 2);
            e.Property(x => x.NewBasePrice).HasPrecision(18, 2);
            e.Property(x => x.OldSalePrice).HasPrecision(18, 2);
            e.Property(x => x.NewSalePrice).HasPrecision(18, 2);
            e.Property(x => x.Reason).HasMaxLength(300);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId);
            e.HasIndex(x => x.ProductId);
        });

        modelBuilder.Entity<InventoryTransaction>(e =>
        {
            e.ToTable("InventoryTransactions");
            e.HasKey(x => x.InventoryTxId);
            e.Property(x => x.InventoryTxId).ValueGeneratedOnAdd();
            e.Property(x => x.UnitCost).HasPrecision(18, 2);
            e.Property(x => x.Reason).HasMaxLength(40).IsRequired();
            e.Property(x => x.ReferenceType).HasMaxLength(40);
            e.Property(x => x.Note).HasMaxLength(300);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId);
            e.HasOne(x => x.Lot).WithMany().HasForeignKey(x => x.LotId);
            e.HasIndex(x => x.ProductId);
        });

        modelBuilder.Entity<ProductReview>(e =>
        {
            e.ToTable("ProductReviews");
            e.HasKey(x => x.ReviewId);
            e.Property(x => x.Title).HasMaxLength(150);
            e.Property(x => x.Content).HasMaxLength(2000);
            e.Property(x => x.SentimentLabel).HasMaxLength(20);
            e.Property(x => x.SentimentScore).HasPrecision(5, 4);
            e.HasOne(x => x.Product)
                .WithMany(x => x.Reviews)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Buyer)
                .WithMany()
                .HasForeignKey(x => x.BuyerUserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Order)
                .WithMany()
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.ProductId);
            e.HasIndex(x => new { x.BuyerUserId, x.ProductId, x.OrderId }).IsUnique();
        });

        modelBuilder.Entity<SellerRating>(e =>
        {
            e.ToTable("SellerRatings");
            e.HasKey(x => x.SellerRatingId);
            e.Property(x => x.Comment).HasMaxLength(1000);
            e.HasOne(x => x.Shop)
                .WithMany()
                .HasForeignKey(x => x.ShopId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Buyer)
                .WithMany()
                .HasForeignKey(x => x.BuyerUserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Order)
                .WithMany()
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.ShopId);
            e.HasIndex(x => new { x.BuyerUserId, x.ShopId, x.OrderId }).IsUnique();
        });

        modelBuilder.Entity<SellerFollow>(e =>
        {
            e.ToTable("SellerFollows");
            e.HasKey(x => new { x.BuyerUserId, x.ShopId });
            e.HasOne(x => x.Buyer)
                .WithMany()
                .HasForeignKey(x => x.BuyerUserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Shop)
                .WithMany()
                .HasForeignKey(x => x.ShopId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.ShopId, x.FollowedAt });
            e.HasIndex(x => new { x.BuyerUserId, x.FollowedAt });
        });

        modelBuilder.Entity<ViewedProductHistory>(e =>
        {
            e.ToTable("ViewedProductHistories");
            e.HasKey(x => x.ViewId);
            e.Property(x => x.ViewId).ValueGeneratedOnAdd();
            e.Property(x => x.SessionId).HasMaxLength(64);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId);
            e.HasIndex(x => new { x.UserId, x.ViewedAt });
            e.HasIndex(x => new { x.ProductId, x.ViewedAt });
        });

        modelBuilder.Entity<ProductRecommendation>(e =>
        {
            e.ToTable("ProductRecommendations");
            e.HasKey(x => x.RecommendationId);
            e.Property(x => x.RecommendationId).ValueGeneratedOnAdd();
            e.Property(x => x.Score).HasPrecision(9, 6);
            e.Property(x => x.Strategy).HasMaxLength(40).IsRequired();
            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Product)
                .WithMany()
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.UserId, x.Score });
        });

        modelBuilder.Entity<ProductModerationHistory>(e =>
        {
            e.ToTable("ProductModerationHistory");
            e.HasKey(x => x.ModerationId);
            e.Property(x => x.ModerationId).ValueGeneratedOnAdd();
            e.Property(x => x.Action).HasMaxLength(20).IsRequired();
            e.Property(x => x.FromStatus).HasMaxLength(20).IsRequired();
            e.Property(x => x.ToStatus).HasMaxLength(20).IsRequired();
            e.Property(x => x.Reason).HasMaxLength(500);
            e.HasOne(x => x.Product)
                .WithMany()
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.AdminUser)
                .WithMany()
                .HasForeignKey(x => x.AdminUserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.ProductId);
        });

        modelBuilder.Entity<Cart>(e =>
        {
            e.ToTable("Carts");
            e.HasKey(x => x.CartId);
            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.UserId).IsUnique();
        });

        modelBuilder.Entity<CartItem>(e =>
        {
            e.ToTable("CartItems");
            e.HasKey(x => x.CartItemId);
            // Client-generated Guid (DB default NEWSEQUENTIALID exists but is unused by EF).
            e.Property(x => x.CartItemId).ValueGeneratedNever();
            e.Property(x => x.UnitPriceSnapshot).HasPrecision(18, 2);
            e.HasOne(x => x.Cart)
                .WithMany(x => x.Items)
                .HasForeignKey(x => x.CartId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Product)
                .WithMany()
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.CartId, x.ProductId, x.VariantId }).IsUnique();
        });

        modelBuilder.Entity<WishlistItem>(e =>
        {
            e.ToTable("WishlistItems");
            e.HasKey(x => x.WishlistItemId);
            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Product)
                .WithMany()
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.UserId, x.ProductId }).IsUnique();
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
        });

        modelBuilder.Entity<Notification>(e =>
        {
            e.ToTable("Notifications");
            e.HasKey(x => x.NotificationId);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Body).HasMaxLength(1000).IsRequired();
            e.Property(x => x.Type).HasMaxLength(40).IsRequired();
            e.Property(x => x.ReferenceType).HasMaxLength(40);
            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
        });

        modelBuilder.Entity<Order>(e =>
        {
            e.ToTable("Orders");
            e.HasKey(x => x.OrderId);
            e.Property(x => x.OrderCode).HasMaxLength(30).IsRequired();
            e.Property(x => x.ShippingSnapshotJson).IsRequired();
            e.Property(x => x.Status).HasMaxLength(30).IsRequired();
            e.Property(x => x.SubtotalAmount).HasPrecision(18, 2);
            e.Property(x => x.DiscountAmount).HasPrecision(18, 2);
            e.Property(x => x.ShippingFee).HasPrecision(18, 2);
            e.Property(x => x.TotalAmount).HasPrecision(18, 2);
            e.Property(x => x.Currency).HasMaxLength(3).IsRequired();
            e.Property(x => x.BuyerNote).HasMaxLength(500);
            e.Property(x => x.SellerNote).HasMaxLength(500);
            e.Property(x => x.TrackingCode).HasMaxLength(100);
            e.HasIndex(x => x.OrderCode).IsUnique();
            e.HasIndex(x => new { x.BuyerUserId, x.CreatedAt });
            e.HasIndex(x => new { x.ShopId, x.Status });
            e.HasOne(x => x.Buyer)
                .WithMany()
                .HasForeignKey(x => x.BuyerUserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Shop)
                .WithMany()
                .HasForeignKey(x => x.ShopId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ShippingAddress)
                .WithMany()
                .HasForeignKey(x => x.ShippingAddressId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Voucher)
                .WithMany()
                .HasForeignKey(x => x.VoucherId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Voucher>(e =>
        {
            e.ToTable("Vouchers");
            e.HasKey(x => x.VoucherId);
            e.Property(x => x.Code).HasMaxLength(40).IsRequired();
            e.Property(x => x.Name).HasMaxLength(150).IsRequired();
            e.Property(x => x.Description).HasMaxLength(500);
            e.Property(x => x.Scope).HasMaxLength(20).IsRequired();
            e.Property(x => x.DiscountType).HasMaxLength(20).IsRequired();
            e.Property(x => x.DiscountValue).HasPrecision(18, 2);
            e.Property(x => x.MaxDiscountAmount).HasPrecision(18, 2);
            e.Property(x => x.MinOrderAmount).HasPrecision(18, 2);
            e.HasIndex(x => x.Code).IsUnique();
            e.HasIndex(x => new { x.IsActive, x.StartsAt, x.EndsAt });
            e.HasOne(x => x.Shop)
                .WithMany()
                .HasForeignKey(x => x.ShopId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Creator)
                .WithMany()
                .HasForeignKey(x => x.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<VoucherRedemption>(e =>
        {
            e.ToTable("VoucherRedemptions");
            e.HasKey(x => x.RedemptionId);
            e.Property(x => x.DiscountAmount).HasPrecision(18, 2);
            e.HasOne(x => x.Voucher)
                .WithMany(x => x.Redemptions)
                .HasForeignKey(x => x.VoucherId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Order)
                .WithMany()
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.VoucherId, x.UserId });
            e.HasIndex(x => x.OrderId);
        });

        modelBuilder.Entity<OrderItem>(e =>
        {
            e.ToTable("OrderItems");
            e.HasKey(x => x.OrderItemId);
            e.Property(x => x.ProductNameSnapshot).HasMaxLength(256).IsRequired();
            e.Property(x => x.SkuSnapshot).HasMaxLength(64);
            e.Property(x => x.UnitPrice).HasPrecision(18, 2);
            e.Property(x => x.UnitCostAvg).HasPrecision(18, 2);
            e.Property(x => x.LineTotal).HasPrecision(18, 2);
            e.HasOne(x => x.Order)
                .WithMany(x => x.Items)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Product)
                .WithMany()
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<OrderItemLotAllocation>(e =>
        {
            e.ToTable("OrderItemLotAllocations");
            e.HasKey(x => x.AllocationId);
            e.Property(x => x.UnitCostSnapshot).HasPrecision(18, 2);
            e.HasOne(x => x.OrderItem)
                .WithMany(x => x.LotAllocations)
                .HasForeignKey(x => x.OrderItemId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Lot)
                .WithMany()
                .HasForeignKey(x => x.LotId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.OrderItemId);
        });

        modelBuilder.Entity<OrderStatusHistory>(e =>
        {
            e.ToTable("OrderStatusHistories");
            e.HasKey(x => x.HistoryId);
            e.Property(x => x.HistoryId).ValueGeneratedOnAdd();
            e.Property(x => x.FromStatus).HasMaxLength(30);
            e.Property(x => x.ToStatus).HasMaxLength(30).IsRequired();
            e.Property(x => x.Note).HasMaxLength(300);
            e.HasOne(x => x.Order)
                .WithMany(x => x.StatusHistories)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Payment>(e =>
        {
            e.ToTable("Payments");
            e.HasKey(x => x.PaymentId);
            e.Property(x => x.Provider).HasMaxLength(30).IsRequired();
            e.Property(x => x.ProviderPaymentId).HasMaxLength(100);
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.Currency).HasMaxLength(3).IsRequired();
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.Property(x => x.CheckoutUrl).HasMaxLength(512);
            e.HasOne(x => x.Order)
                .WithMany(x => x.Payments)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.OrderId);
        });

        modelBuilder.Entity<ReturnRequest>(e =>
        {
            e.ToTable("ReturnRequests");
            e.HasKey(x => x.ReturnRequestId);
            e.Property(x => x.Reason).HasMaxLength(500).IsRequired();
            e.Property(x => x.Description).HasMaxLength(2000);
            e.Property(x => x.ResolutionType).HasMaxLength(20).IsRequired();
            e.Property(x => x.Status).HasMaxLength(30).IsRequired();
            e.Property(x => x.RefundAmount).HasPrecision(18, 2);
            e.Property(x => x.AdminNote).HasMaxLength(500);
            e.HasOne(x => x.Order)
                .WithMany()
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Buyer)
                .WithMany()
                .HasForeignKey(x => x.BuyerUserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Reviewer)
                .WithMany()
                .HasForeignKey(x => x.ReviewedBy)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.OrderId);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.BuyerUserId);
        });

        modelBuilder.Entity<ReturnRequestItem>(e =>
        {
            e.ToTable("ReturnRequestItems");
            e.HasKey(x => x.ReturnItemId);
            e.HasOne(x => x.ReturnRequest)
                .WithMany(x => x.Items)
                .HasForeignKey(x => x.ReturnRequestId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.OrderItem)
                .WithMany()
                .HasForeignKey(x => x.OrderItemId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.ReturnRequestId);
        });

        modelBuilder.Entity<ReturnEvidence>(e =>
        {
            e.ToTable("ReturnEvidences");
            e.HasKey(x => x.EvidenceId);
            e.Property(x => x.EvidenceType).HasMaxLength(20).IsRequired();
            e.Property(x => x.MediaUrl).HasMaxLength(512).IsRequired();
            e.Property(x => x.PublicId).HasMaxLength(256);
            e.HasOne(x => x.ReturnRequest)
                .WithMany(x => x.Evidences)
                .HasForeignKey(x => x.ReturnRequestId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.ReturnRequestId, x.EvidenceType });
        });

        modelBuilder.Entity<ReturnStatusHistory>(e =>
        {
            e.ToTable("ReturnStatusHistories");
            e.HasKey(x => x.HistoryId);
            e.Property(x => x.HistoryId).ValueGeneratedOnAdd();
            e.Property(x => x.FromStatus).HasMaxLength(30);
            e.Property(x => x.ToStatus).HasMaxLength(30).IsRequired();
            e.Property(x => x.Note).HasMaxLength(300);
            e.HasOne(x => x.ReturnRequest)
                .WithMany(x => x.StatusHistories)
                .HasForeignKey(x => x.ReturnRequestId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.ReturnRequestId);
        });

        modelBuilder.Entity<ChatThread>(e =>
        {
            e.ToTable("ChatThreads");
            e.HasKey(x => x.ThreadId);
            e.HasOne(x => x.Buyer)
                .WithMany()
                .HasForeignKey(x => x.BuyerUserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Shop)
                .WithMany()
                .HasForeignKey(x => x.ShopId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Product)
                .WithMany()
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.BuyerUserId, x.ShopId }).IsUnique();
            e.HasIndex(x => x.LastMessageAt);
        });

        modelBuilder.Entity<ChatMessage>(e =>
        {
            e.ToTable("ChatMessages");
            e.HasKey(x => x.MessageId);
            e.Property(x => x.Content).HasMaxLength(2000).IsRequired();
            e.Property(x => x.AttachmentUrl).HasMaxLength(512);
            e.HasOne(x => x.Thread)
                .WithMany(x => x.Messages)
                .HasForeignKey(x => x.ThreadId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Sender)
                .WithMany()
                .HasForeignKey(x => x.SenderUserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.ThreadId, x.CreatedAt });
        });

        modelBuilder.Entity<AiConversation>(e =>
        {
            e.ToTable("AiConversations");
            e.HasKey(x => x.ConversationId);
            e.Property(x => x.Channel).HasMaxLength(30).IsRequired();
            e.Property(x => x.Title).HasMaxLength(200);
            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.UserId, x.UpdatedAt });
        });

        modelBuilder.Entity<AiMessage>(e =>
        {
            e.ToTable("AiMessages");
            e.HasKey(x => x.AiMessageId);
            e.Property(x => x.AiMessageId).ValueGeneratedOnAdd();
            e.Property(x => x.Role).HasMaxLength(20).IsRequired();
            e.Property(x => x.Content).IsRequired();
            e.HasOne(x => x.Conversation)
                .WithMany(x => x.Messages)
                .HasForeignKey(x => x.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.ConversationId, x.CreatedAt });
        });
    }
}
