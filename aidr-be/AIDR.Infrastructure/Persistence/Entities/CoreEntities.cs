namespace AIDR.Infrastructure.Persistence.Entities;

public class Role
{
    public int RoleId { get; set; }
    public string RoleCode { get; set; } = null!;
    public string RoleName { get; set; } = null!;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}

public class User
{
    public Guid UserId { get; set; }
    public string? KeycloakSub { get; set; }
    public string Email { get; set; } = null!;
    public bool EmailConfirmed { get; set; }
    public string? PasswordHash { get; set; }
    public string FullName { get; set; } = null!;
    public string? Phone { get; set; }
    public string? AvatarUrl { get; set; }
    public string Status { get; set; } = "Active";
    public int FailedLoginCount { get; set; }
    public DateTime? LockoutUntil { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public ICollection<PasswordResetToken> PasswordResetTokens { get; set; } = new List<PasswordResetToken>();
    public ICollection<Address> Addresses { get; set; } = new List<Address>();
}

public class Address
{
    public Guid AddressId { get; set; }
    public Guid UserId { get; set; }
    public string ReceiverName { get; set; } = null!;
    public string Phone { get; set; } = null!;
    public string Province { get; set; } = null!;
    public string District { get; set; } = null!;
    public string Ward { get; set; } = null!;
    public string StreetAddress { get; set; } = null!;
    public bool IsDefault { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
}

public class PasswordResetToken
{
    public Guid TokenId { get; set; }
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = null!;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
}

public class UserRole
{
    public Guid UserId { get; set; }
    public int RoleId { get; set; }
    public DateTime AssignedAt { get; set; }

    public User User { get; set; } = null!;
    public Role Role { get; set; } = null!;
}

public class Category
{
    public int CategoryId { get; set; }
    public int? ParentId { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Category? Parent { get; set; }
    public ICollection<Category> Children { get; set; } = new List<Category>();
}

public class Shop
{
    public Guid ShopId { get; set; }
    public Guid OwnerUserId { get; set; }
    public string ShopName { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string? Tagline { get; set; }
    public string? ShortDescription { get; set; }
    public string? Description { get; set; }
    public string? LogoUrl { get; set; }
    public string? BannerUrl { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Hotline { get; set; }
    public string? Province { get; set; }
    public string? District { get; set; }
    public string? Ward { get; set; }
    public string? StreetAddress { get; set; }
    public string CostingMethod { get; set; } = "FIFO";
    public string? ReturnPolicy { get; set; }
    public string? ShippingPolicy { get; set; }
    public string? OpeningHoursJson { get; set; }
    public string? WebsiteUrl { get; set; }
    public string? FacebookUrl { get; set; }
    public bool IsVerified { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public string Status { get; set; } = "Active";
    public decimal AvgRating { get; set; }
    public int RatingCount { get; set; }
    public int FollowerCount { get; set; }
    public int ProductCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class SellerRegistrationRequest
{
    public Guid RequestId { get; set; }
    public Guid UserId { get; set; }
    public string ShopName { get; set; } = null!;
    public string? BusinessInfo { get; set; }
    public string? DocumentUrls { get; set; }
    public string Status { get; set; } = "Pending";
    public string? AdminNote { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public User? Reviewer { get; set; }
}

public class Wallet
{
    public Guid WalletId { get; set; }
    public Guid ShopId { get; set; }
    public decimal AvailableBalance { get; set; }
    public decimal PendingBalance { get; set; }
    public string Currency { get; set; } = "VND";
    public DateTime UpdatedAt { get; set; }

    public Shop Shop { get; set; } = null!;
}

public class Product
{
    public Guid ProductId { get; set; }
    public Guid ShopId { get; set; }
    public int CategoryId { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string? ShortDescription { get; set; }
    public string? Description { get; set; }
    public string? Brand { get; set; }
    public string? ModelNumber { get; set; }
    public string ConditionType { get; set; } = "New";
    public decimal BasePrice { get; set; }
    public decimal? SalePrice { get; set; }
    public string Currency { get; set; } = "VND";
    public decimal? LastCostPrice { get; set; }
    public decimal? AvgCostPrice { get; set; }
    public int StockQuantity { get; set; }
    public int ReservedQuantity { get; set; }
    public int LowStockThreshold { get; set; } = 5;
    public int? WarrantyMonths { get; set; }
    public string? OriginCountry { get; set; }
    public string? TagsJson { get; set; }
    public string? SpecsJson { get; set; }
    public bool IsFeatured { get; set; }
    public DateTime? PublishedAt { get; set; }
    public string Status { get; set; } = "Pending";
    public decimal AvgRating { get; set; }
    public int ReviewCount { get; set; }
    public int SoldCount { get; set; }
    public int ViewCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Shop Shop { get; set; } = null!;
    public Category Category { get; set; } = null!;
    public ICollection<ProductImage> Images { get; set; } = new List<ProductImage>();
    public ICollection<ProductReview> Reviews { get; set; } = new List<ProductReview>();
}

public class ProductImage
{
    public Guid ProductImageId { get; set; }
    public Guid ProductId { get; set; }
    public string ImageUrl { get; set; } = null!;
    public string? PublicId { get; set; }
    public int SortOrder { get; set; }
    public bool IsPrimary { get; set; }
    public DateTime CreatedAt { get; set; }

    public Product Product { get; set; } = null!;
}

public class InventoryLot
{
    public Guid LotId { get; set; }
    public Guid ProductId { get; set; }
    public string LotCode { get; set; } = null!;
    public int QuantityReceived { get; set; }
    public int QuantityRemaining { get; set; }
    public decimal UnitCost { get; set; }
    public string Currency { get; set; } = "VND";
    public string? SupplierName { get; set; }
    public string? InvoiceNumber { get; set; }
    public DateTime ReceivedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string Status { get; set; } = "Open";
    public string? Note { get; set; }
    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }

    public Product Product { get; set; } = null!;
}

public class ProductPriceHistory
{
    public long PriceHistoryId { get; set; }
    public Guid ProductId { get; set; }
    public decimal? OldBasePrice { get; set; }
    public decimal? NewBasePrice { get; set; }
    public decimal? OldSalePrice { get; set; }
    public decimal? NewSalePrice { get; set; }
    public Guid? ChangedBy { get; set; }
    public string? Reason { get; set; }
    public DateTime ChangedAt { get; set; }

    public Product Product { get; set; } = null!;
}

public class InventoryTransaction
{
    public long InventoryTxId { get; set; }
    public Guid ProductId { get; set; }
    public Guid? LotId { get; set; }
    public int ChangeQty { get; set; }
    public decimal? UnitCost { get; set; }
    public string Reason { get; set; } = null!;
    public string? ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public string? Note { get; set; }
    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }

    public Product Product { get; set; } = null!;
    public InventoryLot? Lot { get; set; }
}

public class ProductReview
{
    public Guid ReviewId { get; set; }
    public Guid ProductId { get; set; }
    public Guid BuyerUserId { get; set; }
    public Guid? OrderId { get; set; }
    public byte Rating { get; set; }
    public string? Title { get; set; }
    public string? Content { get; set; }
    public bool IsVisible { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Product Product { get; set; } = null!;
    public User Buyer { get; set; } = null!;
}

public class ViewedProductHistory
{
    public long ViewId { get; set; }
    public Guid? UserId { get; set; }
    public string? SessionId { get; set; }
    public Guid ProductId { get; set; }
    public DateTime ViewedAt { get; set; }

    public Product Product { get; set; } = null!;
    public User? User { get; set; }
}

public class ProductModerationHistory
{
    public long ModerationId { get; set; }
    public Guid ProductId { get; set; }
    public Guid AdminUserId { get; set; }
    public string Action { get; set; } = null!;
    public string FromStatus { get; set; } = null!;
    public string ToStatus { get; set; } = null!;
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }

    public Product Product { get; set; } = null!;
    public User AdminUser { get; set; } = null!;
}

public class Cart
{
    public Guid CartId { get; set; }
    public Guid UserId { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public ICollection<CartItem> Items { get; set; } = new List<CartItem>();
}

public class CartItem
{
    public Guid CartItemId { get; set; }
    public Guid CartId { get; set; }
    public Guid ProductId { get; set; }
    public Guid? VariantId { get; set; }
    public int Quantity { get; set; } = 1;
    public decimal? UnitPriceSnapshot { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Cart Cart { get; set; } = null!;
    public Product Product { get; set; } = null!;
}
