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

    /// <summary>Delivery point the buyer pinned on the map. Null on addresses saved before the map existed.</summary>
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

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

    /// <summary>Pickup point the seller pinned in Shop settings; the start of the tracking map.</summary>
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

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

    /* Identity + legal profile - see docs/solution-seller-onboarding-ekyc.md */
    public Guid? KycVerificationId { get; set; }
    public string? BusinessType { get; set; }
    public string? TaxCode { get; set; }
    public string? BusinessAddress { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
    public string? LicenseImageUrl { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public User User { get; set; } = null!;
    public User? Reviewer { get; set; }
    public KycVerification? KycVerification { get; set; }
}

/// <summary>One identity check attempt against the eKYC provider.</summary>
public class KycVerification
{
    public Guid KycVerificationId { get; set; }
    public Guid UserId { get; set; }
    public string Provider { get; set; } = "FPTAI";
    public string? DocumentType { get; set; }
    /// <summary>Only the last four digits stay readable.</summary>
    public string? DocumentNumberMask { get; set; }
    /// <summary>SHA-256 of the full number; used to stop one identity opening many shops.</summary>
    public string? DocumentNumberHash { get; set; }
    public string? FullName { get; set; }
    public string? DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? HomeTown { get; set; }
    public string? PermanentAddress { get; set; }
    public string? IssueDate { get; set; }
    public string? ExpiryDate { get; set; }
    public string? FrontImageUrl { get; set; }
    public string? BackImageUrl { get; set; }
    public string? SelfieImageUrl { get; set; }
    public decimal? FaceMatchSimilarity { get; set; }
    public bool FaceMatched { get; set; }
    public string Status { get; set; } = "Pending";
    public string? FailureReason { get; set; }
    public string? RawOcrJson { get; set; }
    public string? RawFaceJson { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? VerifiedAt { get; set; }

    public User User { get; set; } = null!;
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
    public ICollection<WalletTransaction> Transactions { get; set; } = new List<WalletTransaction>();
}

public class WalletTransaction
{
    public long WalletTxId { get; set; }
    public Guid WalletId { get; set; }
    public string TxType { get; set; } = null!;
    public decimal Amount { get; set; }
    public decimal BalanceAfter { get; set; }
    /// <summary>Pending balance after this movement; null on rows written before escrow existed.</summary>
    public decimal? PendingAfter { get; set; }
    public string? ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }

    public Wallet Wallet { get; set; } = null!;
}

public class ShopBankAccount
{
    public Guid ShopBankAccountId { get; set; }
    public Guid ShopId { get; set; }
    public string? BankBin { get; set; }
    public string BankName { get; set; } = null!;
    public string AccountNumber { get; set; } = null!;
    public string AccountName { get; set; } = null!;
    public string Status { get; set; } = "Unverified";
    public bool IsDefault { get; set; } = true;
    public Guid? VerifiedBy { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public string? RejectReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Shop Shop { get; set; } = null!;
}

/// <summary>One row per order: what the platform owes the shop, and when.</summary>
public class SettlementEntry
{
    public Guid SettlementEntryId { get; set; }
    public Guid OrderId { get; set; }
    public Guid ShopId { get; set; }
    public decimal GrossAmount { get; set; }
    public decimal SubsidyAmount { get; set; }
    public decimal CommissionRate { get; set; }
    public decimal CommissionAmount { get; set; }
    public decimal NetAmount { get; set; }
    public string Currency { get; set; } = "VND";
    public string Status { get; set; } = "Holding";
    public DateTime HoldUntil { get; set; }
    public DateTime? EligibleAt { get; set; }
    public Guid? PayoutBatchId { get; set; }
    public string? HoldReason { get; set; }
    public string? ReversedReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Order Order { get; set; } = null!;
    public Shop Shop { get; set; } = null!;
    public PayoutBatch? PayoutBatch { get; set; }
}

/// <summary>One admin approval = one transfer to one shop.</summary>
public class PayoutBatch
{
    public Guid PayoutBatchId { get; set; }
    public string BatchCode { get; set; } = null!;
    public Guid ShopId { get; set; }
    public Guid ShopBankAccountId { get; set; }
    public DateTime PeriodTo { get; set; }
    public int EntryCount { get; set; }
    public decimal GrossAmount { get; set; }
    public decimal CommissionAmount { get; set; }
    public decimal NetAmount { get; set; }
    public string Currency { get; set; } = "VND";
    public string Status { get; set; } = "Draft";
    public Guid? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? ProviderPayoutId { get; set; }
    public string? ProviderState { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? FailureReason { get; set; }
    public int AttemptCount { get; set; }
    public string? RawResponseJson { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Shop Shop { get; set; } = null!;
    public ShopBankAccount ShopBankAccount { get; set; } = null!;
    public ICollection<SettlementEntry> Entries { get; set; } = new List<SettlementEntry>();
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
    /// <summary>
    /// The option axes variants are built from, in the order the seller declared them:
    /// <c>[{"name":"Color","values":["Orange","White"]}]</c>. Null for a product sold
    /// as a single configuration.
    /// </summary>
    public string? VariantOptionsJson { get; set; }
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

    /// <summary>
    /// Empty for a product sold as one configuration. Once populated, a variant -
    /// not the product - is what a buyer adds to the cart, and BasePrice /
    /// StockQuantity above become rollups over these rows.
    /// </summary>
    public ICollection<ProductVariant> Variants { get; set; } = new List<ProductVariant>();
}

/// <summary>
/// One purchasable configuration of a product ("Orange / 128GB"), with its own
/// price and stock. <see cref="AttributesJson"/> holds the chosen value per axis
/// declared in <see cref="Product.VariantOptionsJson"/>.
/// </summary>
public class ProductVariant
{
    public Guid VariantId { get; set; }
    public Guid ProductId { get; set; }
    public string? Sku { get; set; }
    public string VariantName { get; set; } = null!;
    public string? AttributesJson { get; set; }
    public decimal Price { get; set; }
    public decimal? SalePrice { get; set; }
    public decimal? LastCostPrice { get; set; }
    public decimal? AvgCostPrice { get; set; }
    public int StockQuantity { get; set; }
    public int ReservedQuantity { get; set; }
    public string? ImageUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Product Product { get; set; } = null!;
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
    /// <summary>Null for a product with no variants; otherwise the configuration this lot stocks.</summary>
    public Guid? VariantId { get; set; }
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
    public ProductVariant? Variant { get; set; }
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

public class ProductPriceAlert
{
    public Guid PriceAlertId { get; set; }
    public Guid UserId { get; set; }
    public Guid ProductId { get; set; }
    public string AlertType { get; set; } = null!;
    public decimal? BaselinePrice { get; set; }
    public decimal ThresholdPct { get; set; }
    public decimal ThresholdAmount { get; set; }
    public bool IsActive { get; set; }
    public DateTime? LastTriggeredAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public Product Product { get; set; } = null!;
}

public class InventoryTransaction
{
    public long InventoryTxId { get; set; }
    public Guid ProductId { get; set; }
    public Guid? VariantId { get; set; }
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
    public ProductVariant? Variant { get; set; }
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
    public string? SentimentLabel { get; set; }
    public decimal? SentimentScore { get; set; }
    public bool IsVisible { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Product Product { get; set; } = null!;
    public User Buyer { get; set; } = null!;
    public Order? Order { get; set; }
}

public class ProductReviewDigestSnapshot
{
    public Guid ProductId { get; set; }
    public int ReviewCount { get; set; }
    public string DigestJson { get; set; } = null!;
    public string Source { get; set; } = null!;
    public DateTime GeneratedAt { get; set; }

    public Product Product { get; set; } = null!;
}

public class SellerRating
{
    public Guid SellerRatingId { get; set; }
    public Guid ShopId { get; set; }
    public Guid BuyerUserId { get; set; }
    public Guid? OrderId { get; set; }
    public byte Score { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Shop Shop { get; set; } = null!;
    public User Buyer { get; set; } = null!;
    public Order? Order { get; set; }
}

public class SellerFollow
{
    public Guid BuyerUserId { get; set; }
    public Guid ShopId { get; set; }
    public DateTime FollowedAt { get; set; }

    public User Buyer { get; set; } = null!;
    public Shop Shop { get; set; } = null!;
}

public class ProductQuestion
{
    public Guid QuestionId { get; set; }
    public Guid ProductId { get; set; }
    public Guid UserId { get; set; }
    public string Content { get; set; } = null!;
    public string Status { get; set; } = "Visible";
    public DateTime CreatedAt { get; set; }

    public Product Product { get; set; } = null!;
    public User User { get; set; } = null!;
    public ICollection<ProductAnswer> Answers { get; set; } = new List<ProductAnswer>();
}

public class ProductAnswer
{
    public Guid AnswerId { get; set; }
    public Guid QuestionId { get; set; }
    public Guid UserId { get; set; }
    public string Content { get; set; } = null!;
    public bool IsOfficial { get; set; }
    public DateTime CreatedAt { get; set; }

    public ProductQuestion Question { get; set; } = null!;
    public User User { get; set; } = null!;
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

public class ProductRecommendation
{
    public long RecommendationId { get; set; }
    public Guid UserId { get; set; }
    public Guid ProductId { get; set; }
    public decimal Score { get; set; }
    public string Strategy { get; set; } = null!;
    public DateTime GeneratedAt { get; set; }

    public User User { get; set; } = null!;
    public Product Product { get; set; } = null!;
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

public class WishlistItem
{
    public Guid WishlistItemId { get; set; }
    public Guid UserId { get; set; }
    public Guid ProductId { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public Product Product { get; set; } = null!;
}

public class Notification
{
    public Guid NotificationId { get; set; }
    public Guid UserId { get; set; }
    public string Title { get; set; } = null!;
    public string Body { get; set; } = null!;
    public string Type { get; set; } = null!;
    public string? ReferenceType { get; set; }
    public Guid? ReferenceId { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
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
    public ProductVariant? Variant { get; set; }
}

public class Order
{
    public Guid OrderId { get; set; }
    public string OrderCode { get; set; } = null!;
    public Guid BuyerUserId { get; set; }
    public Guid ShopId { get; set; }
    public Guid? ShippingAddressId { get; set; }
    public string ShippingSnapshotJson { get; set; } = null!;
    public string Status { get; set; } = "PendingPayment";
    public decimal SubtotalAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal ShippingFee { get; set; }
    public decimal TotalAmount { get; set; }
    public string Currency { get; set; } = "VND";
    public Guid? VoucherId { get; set; }
    public string? BuyerNote { get; set; }
    public string? SellerNote { get; set; }
    public string? TrackingCode { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User Buyer { get; set; } = null!;
    public Shop Shop { get; set; } = null!;
    public Address? ShippingAddress { get; set; }
    public Voucher? Voucher { get; set; }
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<OrderStatusHistory> StatusHistories { get; set; } = new List<OrderStatusHistory>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}

public class Voucher
{
    public Guid VoucherId { get; set; }
    public string Code { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string Scope { get; set; } = null!;
    public Guid? ShopId { get; set; }
    public string DiscountType { get; set; } = null!;
    public decimal DiscountValue { get; set; }
    public decimal? MaxDiscountAmount { get; set; }
    public decimal MinOrderAmount { get; set; }
    public int? UsageLimit { get; set; }
    public int PerUserLimit { get; set; } = 1;
    public int UsedCount { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Shop? Shop { get; set; }
    public User Creator { get; set; } = null!;
    public ICollection<VoucherRedemption> Redemptions { get; set; } = new List<VoucherRedemption>();
}

public class VoucherRedemption
{
    public Guid RedemptionId { get; set; }
    public Guid VoucherId { get; set; }
    public Guid UserId { get; set; }
    public Guid? OrderId { get; set; }
    public decimal DiscountAmount { get; set; }
    public DateTime RedeemedAt { get; set; }

    public Voucher Voucher { get; set; } = null!;
    public User User { get; set; } = null!;
    public Order? Order { get; set; }
}

public class OrderItem
{
    public Guid OrderItemId { get; set; }
    public Guid OrderId { get; set; }
    public Guid ProductId { get; set; }
    public Guid? VariantId { get; set; }
    public string ProductNameSnapshot { get; set; } = null!;
    /// <summary>"Orange / 128GB" as it read at checkout; variants get renamed, invoices do not.</summary>
    public string? VariantNameSnapshot { get; set; }
    public string? SkuSnapshot { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal? UnitCostAvg { get; set; }
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }

    public Order Order { get; set; } = null!;
    public Product Product { get; set; } = null!;
    public ProductVariant? Variant { get; set; }
    public ICollection<OrderItemLotAllocation> LotAllocations { get; set; } = new List<OrderItemLotAllocation>();
}

public class OrderItemLotAllocation
{
    public Guid AllocationId { get; set; }
    public Guid OrderItemId { get; set; }
    public Guid LotId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitCostSnapshot { get; set; }

    public OrderItem OrderItem { get; set; } = null!;
    public InventoryLot Lot { get; set; } = null!;
}

public class OrderStatusHistory
{
    public long HistoryId { get; set; }
    public Guid OrderId { get; set; }
    public string? FromStatus { get; set; }
    public string ToStatus { get; set; } = null!;
    public Guid? ChangedBy { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }

    public Order Order { get; set; } = null!;
}

public class Payment
{
    public Guid PaymentId { get; set; }
    public Guid OrderId { get; set; }
    public string Provider { get; set; } = "payOS";
    public string? ProviderPaymentId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "VND";
    public string Status { get; set; } = "Pending";
    public string? CheckoutUrl { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? RawResponseJson { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Order Order { get; set; } = null!;
}

public class ReturnRequest
{
    public Guid ReturnRequestId { get; set; }
    public Guid OrderId { get; set; }
    public Guid BuyerUserId { get; set; }
    public string Reason { get; set; } = null!;
    public string? Description { get; set; }
    public string? EvidenceUrls { get; set; }
    public string ResolutionType { get; set; } = "ReturnRefund";
    public string Status { get; set; } = "Pending";
    public decimal? RefundAmount { get; set; }
    public string? AdminNote { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    /// <summary>Buyer-provided bank for PayOS payout refund (Napas BIN).</summary>
    public string? RefundBankBin { get; set; }
    public string? RefundBankName { get; set; }
    public string? RefundAccountNumber { get; set; }
    public string? RefundAccountName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Order Order { get; set; } = null!;
    public User Buyer { get; set; } = null!;
    public User? Reviewer { get; set; }
    public ICollection<ReturnRequestItem> Items { get; set; } = new List<ReturnRequestItem>();
    public ICollection<ReturnEvidence> Evidences { get; set; } = new List<ReturnEvidence>();
    public ICollection<ReturnStatusHistory> StatusHistories { get; set; } = new List<ReturnStatusHistory>();
}

public class ReturnRequestItem
{
    public Guid ReturnItemId { get; set; }
    public Guid ReturnRequestId { get; set; }
    public Guid OrderItemId { get; set; }
    public int Quantity { get; set; }

    public ReturnRequest ReturnRequest { get; set; } = null!;
    public OrderItem OrderItem { get; set; } = null!;
}

public class ReturnEvidence
{
    public Guid EvidenceId { get; set; }
    public Guid ReturnRequestId { get; set; }
    public string EvidenceType { get; set; } = null!;
    public string MediaUrl { get; set; } = null!;
    public string? PublicId { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }

    public ReturnRequest ReturnRequest { get; set; } = null!;
}

public class ReturnStatusHistory
{
    public long HistoryId { get; set; }
    public Guid ReturnRequestId { get; set; }
    public string? FromStatus { get; set; }
    public string ToStatus { get; set; } = null!;
    public Guid? ChangedBy { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }

    public ReturnRequest ReturnRequest { get; set; } = null!;
}

public class ChatThread
{
    public Guid ThreadId { get; set; }
    public Guid BuyerUserId { get; set; }
    public Guid ShopId { get; set; }
    public Guid? ProductId { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public User Buyer { get; set; } = null!;
    public Shop Shop { get; set; } = null!;
    public Product? Product { get; set; }
    public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}

public class ChatMessage
{
    public Guid MessageId { get; set; }
    public Guid ThreadId { get; set; }
    public Guid SenderUserId { get; set; }
    public string Content { get; set; } = null!;
    public string? AttachmentUrl { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }

    public ChatThread Thread { get; set; } = null!;
    public User Sender { get; set; } = null!;
}

public class AiConversation
{
    public Guid ConversationId { get; set; }
    public Guid UserId { get; set; }
    public string Channel { get; set; } = "ShoppingAssistant";
    public string? Title { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
    public ICollection<AiMessage> Messages { get; set; } = new List<AiMessage>();
}

public class AiMessage
{
    public long AiMessageId { get; set; }
    public Guid ConversationId { get; set; }
    public string Role { get; set; } = null!;
    public string Content { get; set; } = null!;
    public string? MetaJson { get; set; }
    public DateTime CreatedAt { get; set; }

    public AiConversation Conversation { get; set; } = null!;
}

public class Shipment
{
    public Guid ShipmentId { get; set; }
    public Guid OrderId { get; set; }
    public string Provider { get; set; } = null!;
    public string? ProviderShipmentId { get; set; }
    public string? TrackingCode { get; set; }
    public string Status { get; set; } = "Pending";
    public string? ProviderStatus { get; set; }
    public decimal? ShippingFeeQuoted { get; set; }
    public DateTime? ExpectedDeliveryAt { get; set; }

    /// <summary>Mock: when the simulator steps forward. Real carrier: when to poll again.</summary>
    public DateTime? NextActionAt { get; set; }
    public DateTime? LastSyncedAt { get; set; }
    public int AttemptCount { get; set; }
    public string? LastError { get; set; }
    public string? RawCreateJson { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Order Order { get; set; } = null!;
    public ICollection<ShipmentEvent> Events { get; set; } = new List<ShipmentEvent>();
}

public class ShipmentEvent
{
    public Guid ShipmentEventId { get; set; }
    public Guid ShipmentId { get; set; }

    /// <summary>Idempotency key - unique per shipment, so a replayed webhook is a no-op.</summary>
    public string ExternalEventId { get; set; } = null!;
    public string ProviderStatus { get; set; } = null!;
    public string MappedStatus { get; set; } = null!;
    public string? Description { get; set; }
    public string Source { get; set; } = null!;
    public bool AppliedToOrder { get; set; }
    public DateTime OccurredAt { get; set; }
    public DateTime ReceivedAt { get; set; }
    public string? RawJson { get; set; }

    public Shipment Shipment { get; set; } = null!;
}
