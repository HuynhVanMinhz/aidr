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
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Shop> Shops => Set<Shop>();
    public DbSet<Product> Products => Set<Product>();

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

        modelBuilder.Entity<Category>(e =>
        {
            e.ToTable("Categories");
            e.HasKey(x => x.CategoryId);
            e.Property(x => x.Slug).HasMaxLength(140).IsRequired();
            e.HasIndex(x => x.Slug).IsUnique();
        });

        modelBuilder.Entity<Shop>(e =>
        {
            e.ToTable("Shops");
            e.HasKey(x => x.ShopId);
            e.Property(x => x.Slug).HasMaxLength(160).IsRequired();
            e.HasIndex(x => x.Slug).IsUnique();
            e.HasIndex(x => x.OwnerUserId).IsUnique();
        });

        modelBuilder.Entity<Product>(e =>
        {
            e.ToTable("Products");
            e.HasKey(x => x.ProductId);
            e.Property(x => x.BasePrice).HasPrecision(18, 2);
            e.Property(x => x.SalePrice).HasPrecision(18, 2);
            e.Property(x => x.LastCostPrice).HasPrecision(18, 2);
            e.Property(x => x.AvgCostPrice).HasPrecision(18, 2);
            e.HasOne(x => x.Shop).WithMany().HasForeignKey(x => x.ShopId);
            e.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId);
            e.HasIndex(x => new { x.ShopId, x.Slug }).IsUnique();
        });
    }
}
