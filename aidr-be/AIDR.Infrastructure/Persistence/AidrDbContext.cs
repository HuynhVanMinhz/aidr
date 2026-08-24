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
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<ProductReview> ProductReviews => Set<ProductReview>();
    public DbSet<ViewedProductHistory> ViewedProductHistories => Set<ViewedProductHistory>();

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
            e.Property(x => x.CostingMethod).HasMaxLength(20).IsRequired();
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

        modelBuilder.Entity<ProductReview>(e =>
        {
            e.ToTable("ProductReviews");
            e.HasKey(x => x.ReviewId);
            e.Property(x => x.Title).HasMaxLength(150);
            e.Property(x => x.Content).HasMaxLength(2000);
            e.HasOne(x => x.Product)
                .WithMany(x => x.Reviews)
                .HasForeignKey(x => x.ProductId);
            e.HasOne(x => x.Buyer)
                .WithMany()
                .HasForeignKey(x => x.BuyerUserId);
            e.HasIndex(x => x.ProductId);
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
    }
}
