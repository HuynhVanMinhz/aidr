/*
================================================================================
  AIDR - Database Schema (Microsoft SQL Server)
  Rebuilt from Report7 entities + Use Cases (UC-01..UC-90)
  + UC-91 Import Stock Lot (giá nhập theo lô)
  + UC-92 Update Selling Price (giá bán catalog)
  Hosting note: SQL Server on Aiven (or equivalent managed SQL Server)
================================================================================
  Design principles vs. old schema:
  - Drop out-of-scope: posts, support tickets, product_likes (wishlist covers)
  - Add: shops, seller registration, vouchers, wallet, moderation, chat,
         follows, seller ratings, inventory lots (cost), AI conversation
  - Keycloak owns credentials; app DB stores profile + business data

  ---------------------------------------------------------------------------
  GIÁ NHẬP vs GIÁ BÁN (quan trọng)
  ---------------------------------------------------------------------------
  - Giá BÁN (BasePrice / SalePrice trên Products): giá khách thấy trên web.
    Đổi lúc nào cũng được → ghi ProductPriceHistories. KHÔNG đụng lô cũ.
  - Giá NHẬP (UnitCost trên InventoryLots): gắn với từng LÔ nhập.
    Ví dụ: Lô A 10 máy @ 10.000.000; sau này nhập Lô B @ 12.000.000.
    Lô A giữ nguyên UnitCost=10tr; Lô B = 12tr. Không overwrite lô cũ.
  - Products.StockQuantity = tổng QuantityRemaining của các lô còn hàng.
  - Products.AvgCostPrice = trung bình gia quyền tồn (cho báo cáo lãi).
  - Khi bán: FIFO trừ QuantityRemaining từ lô cũ nhất; snapshot cost vào
    OrderItemLotAllocations (COGS). OrderItems.UnitPrice = giá bán lúc checkout.
  - Đơn đã bán KHÔNG sửa giá / cost lịch sử.
  ---------------------------------------------------------------------------
*/

USE master;
GO

IF DB_ID(N'AIDR') IS NULL
    CREATE DATABASE AIDR;
GO

USE AIDR;
GO

/* -------------------------------------------------------------------------- */
/* 0. Helper: drop in dependency-safe order (idempotent rebuild)              */
/* -------------------------------------------------------------------------- */
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id))
    + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id))
    + N' DROP CONSTRAINT ' + QUOTENAME(name) + N';'
FROM sys.foreign_keys;
EXEC sp_executesql @sql;

DECLARE @drop NVARCHAR(MAX) = N'';
SELECT @drop += N'DROP TABLE IF EXISTS ' + QUOTENAME(SCHEMA_NAME(schema_id))
    + N'.' + QUOTENAME(name) + N';'
FROM sys.tables WHERE type = 'U';
EXEC sp_executesql @drop;
GO

/* -------------------------------------------------------------------------- */
/* 1. Identity & Access                                                       */
/* -------------------------------------------------------------------------- */

CREATE TABLE dbo.Roles (
    RoleId          INT             NOT NULL IDENTITY(1,1) CONSTRAINT PK_Roles PRIMARY KEY,
    RoleCode        NVARCHAR(32)    NOT NULL,          -- BUYER | SELLER | ADMIN
    RoleName        NVARCHAR(64)    NOT NULL,
    Description     NVARCHAR(256)   NULL,
    CreatedAt       DATETIME2(3)    NOT NULL CONSTRAINT DF_Roles_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Roles_RoleCode UNIQUE (RoleCode)
);
GO

CREATE TABLE dbo.Users (
    UserId              UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Users PRIMARY KEY
                        CONSTRAINT DF_Users_UserId DEFAULT (NEWSEQUENTIALID()),
    KeycloakSub         NVARCHAR(64)    NULL,           -- IdP subject (Keycloak)
    Email               NVARCHAR(256)   NOT NULL,
    EmailConfirmed      BIT             NOT NULL CONSTRAINT DF_Users_EmailConfirmed DEFAULT (0),
    PasswordHash        NVARCHAR(512)   NULL,           -- optional if Keycloak-only
    FullName            NVARCHAR(128)   NOT NULL,
    Phone               NVARCHAR(20)    NULL,
    AvatarUrl           NVARCHAR(512)   NULL,           -- Cloudinary URL
    Gender              NVARCHAR(16)    NULL,
    DateOfBirth         DATE            NULL,
    Status              NVARCHAR(20)    NOT NULL CONSTRAINT DF_Users_Status DEFAULT (N'Active'),
        -- Active | Locked | PendingDeletion
    FailedLoginCount    INT             NOT NULL CONSTRAINT DF_Users_FailedLogin DEFAULT (0),
    LockoutUntil        DATETIME2(3)    NULL,
    LastLoginAt         DATETIME2(3)    NULL,
    CreatedAt           DATETIME2(3)    NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt           DATETIME2(3)    NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Users_Email UNIQUE (Email),
    CONSTRAINT UQ_Users_KeycloakSub UNIQUE (KeycloakSub),
    CONSTRAINT CK_Users_Status CHECK (Status IN (N'Active', N'Locked', N'PendingDeletion'))
);
GO

CREATE INDEX IX_Users_Status ON dbo.Users (Status);
GO

CREATE TABLE dbo.UserRoles (
    UserId      UNIQUEIDENTIFIER NOT NULL,
    RoleId      INT              NOT NULL,
    AssignedAt  DATETIME2(3)     NOT NULL CONSTRAINT DF_UserRoles_AssignedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),
    CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles (RoleId)
);
GO

CREATE TABLE dbo.Addresses (
    AddressId       UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Addresses PRIMARY KEY
                    CONSTRAINT DF_Addresses_AddressId DEFAULT (NEWSEQUENTIALID()),
    UserId          UNIQUEIDENTIFIER NOT NULL,
    ReceiverName    NVARCHAR(128)    NOT NULL,
    Phone           NVARCHAR(20)     NOT NULL,
    Province        NVARCHAR(100)    NOT NULL,
    District        NVARCHAR(100)    NOT NULL,
    Ward            NVARCHAR(100)    NOT NULL,
    StreetAddress   NVARCHAR(256)    NOT NULL,
    IsDefault       BIT              NOT NULL CONSTRAINT DF_Addresses_IsDefault DEFAULT (0),
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Addresses_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Addresses_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Addresses_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId)
);
GO

CREATE INDEX IX_Addresses_UserId ON dbo.Addresses (UserId);
GO

CREATE TABLE dbo.PasswordResetTokens (
    TokenId         UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_PasswordResetTokens PRIMARY KEY
                    CONSTRAINT DF_PRT_TokenId DEFAULT (NEWSEQUENTIALID()),
    UserId          UNIQUEIDENTIFIER NOT NULL,
    TokenHash       NVARCHAR(128)    NOT NULL,
    ExpiresAt       DATETIME2(3)     NOT NULL,
    UsedAt          DATETIME2(3)     NULL,
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_PRT_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_PRT_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId)
);
GO

CREATE INDEX IX_PRT_UserId ON dbo.PasswordResetTokens (UserId);
GO

/* -------------------------------------------------------------------------- */
/* 2. Seller / Shop                                                           */
/* -------------------------------------------------------------------------- */

CREATE TABLE dbo.Shops (
    ShopId          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Shops PRIMARY KEY
                    CONSTRAINT DF_Shops_ShopId DEFAULT (NEWSEQUENTIALID()),
    OwnerUserId     UNIQUEIDENTIFIER NOT NULL,
    ShopName        NVARCHAR(150)    NOT NULL,
    Slug            NVARCHAR(160)    NOT NULL,
    Tagline         NVARCHAR(200)    NULL,
    ShortDescription NVARCHAR(500)   NULL,
    Description     NVARCHAR(MAX)    NULL,
    LogoUrl         NVARCHAR(512)    NULL,
    BannerUrl       NVARCHAR(512)    NULL,
    -- Liên hệ & địa chỉ cửa hàng
    Email           NVARCHAR(256)    NULL,
    Phone           NVARCHAR(20)     NULL,
    Hotline         NVARCHAR(20)     NULL,
    Province        NVARCHAR(100)    NULL,
    District        NVARCHAR(100)    NULL,
    Ward            NVARCHAR(100)    NULL,
    StreetAddress   NVARCHAR(256)    NULL,
    -- Pháp lý / vận hành
    TaxCode         NVARCHAR(32)     NULL,
    BusinessLicenseNo NVARCHAR(64)   NULL,
    CostingMethod   NVARCHAR(20)     NOT NULL CONSTRAINT DF_Shops_CostingMethod DEFAULT (N'FIFO'),
        -- FIFO | WeightedAverage  (áp dụng khi trừ tồn & tính COGS)
    ReturnPolicy    NVARCHAR(2000)   NULL,
    ShippingPolicy  NVARCHAR(2000)   NULL,
    OpeningHoursJson NVARCHAR(1000)  NULL,           -- {"mon":"9-18",...}
    WebsiteUrl      NVARCHAR(512)    NULL,
    FacebookUrl     NVARCHAR(512)    NULL,
    IsVerified      BIT              NOT NULL CONSTRAINT DF_Shops_IsVerified DEFAULT (0),
    VerifiedAt      DATETIME2(3)     NULL,
    Status          NVARCHAR(20)     NOT NULL CONSTRAINT DF_Shops_Status DEFAULT (N'Active'),
        -- Active | Suspended | Closed
    AvgRating       DECIMAL(3,2)     NOT NULL CONSTRAINT DF_Shops_AvgRating DEFAULT (0),
    RatingCount     INT              NOT NULL CONSTRAINT DF_Shops_RatingCount DEFAULT (0),
    FollowerCount   INT              NOT NULL CONSTRAINT DF_Shops_FollowerCount DEFAULT (0),
    ProductCount    INT              NOT NULL CONSTRAINT DF_Shops_ProductCount DEFAULT (0),
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Shops_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Shops_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Shops_OwnerUserId UNIQUE (OwnerUserId),
    CONSTRAINT UQ_Shops_Slug UNIQUE (Slug),
    CONSTRAINT FK_Shops_Users FOREIGN KEY (OwnerUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Shops_Status CHECK (Status IN (N'Active', N'Suspended', N'Closed')),
    CONSTRAINT CK_Shops_CostingMethod CHECK (CostingMethod IN (N'FIFO', N'WeightedAverage'))
);
GO

CREATE TABLE dbo.SellerRegistrationRequests (
    RequestId       UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SellerReg PRIMARY KEY
                    CONSTRAINT DF_SellerReg_RequestId DEFAULT (NEWSEQUENTIALID()),
    UserId          UNIQUEIDENTIFIER NOT NULL,
    ShopName        NVARCHAR(150)    NOT NULL,
    BusinessInfo    NVARCHAR(1000)   NULL,
    DocumentUrls    NVARCHAR(MAX)    NULL,           -- JSON array of Cloudinary URLs
    Status          NVARCHAR(20)     NOT NULL CONSTRAINT DF_SellerReg_Status DEFAULT (N'Pending'),
        -- Pending | Approved | Rejected
    AdminNote       NVARCHAR(500)    NULL,
    ReviewedBy      UNIQUEIDENTIFIER NULL,
    ReviewedAt      DATETIME2(3)     NULL,
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_SellerReg_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_SellerReg_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_SellerReg_Reviewer FOREIGN KEY (ReviewedBy) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_SellerReg_Status CHECK (Status IN (N'Pending', N'Approved', N'Rejected'))
);
GO

CREATE INDEX IX_SellerReg_Status ON dbo.SellerRegistrationRequests (Status);
GO

CREATE TABLE dbo.SellerFollows (
    BuyerUserId     UNIQUEIDENTIFIER NOT NULL,
    ShopId          UNIQUEIDENTIFIER NOT NULL,
    FollowedAt      DATETIME2(3)     NOT NULL CONSTRAINT DF_SellerFollows_FollowedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_SellerFollows PRIMARY KEY (BuyerUserId, ShopId),
    CONSTRAINT FK_SellerFollows_Buyer FOREIGN KEY (BuyerUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_SellerFollows_Shop FOREIGN KEY (ShopId) REFERENCES dbo.Shops (ShopId)
);
GO

CREATE TABLE dbo.SellerRatings (
    SellerRatingId  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SellerRatings PRIMARY KEY
                    CONSTRAINT DF_SellerRatings_Id DEFAULT (NEWSEQUENTIALID()),
    ShopId          UNIQUEIDENTIFIER NOT NULL,
    BuyerUserId     UNIQUEIDENTIFIER NOT NULL,
    OrderId         UNIQUEIDENTIFIER NULL,            -- FK added after Orders
    Score           TINYINT          NOT NULL,         -- 1..5
    Comment         NVARCHAR(1000)   NULL,
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_SellerRatings_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_SellerRatings_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_SellerRatings_Shop FOREIGN KEY (ShopId) REFERENCES dbo.Shops (ShopId),
    CONSTRAINT FK_SellerRatings_Buyer FOREIGN KEY (BuyerUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_SellerRatings_Score CHECK (Score BETWEEN 1 AND 5),
    CONSTRAINT UQ_SellerRatings_Buyer_Shop_Order UNIQUE (BuyerUserId, ShopId, OrderId)
);
GO

/* -------------------------------------------------------------------------- */
/* 3. Catalog                                                                 */
/* -------------------------------------------------------------------------- */

CREATE TABLE dbo.Categories (
    CategoryId      INT              NOT NULL IDENTITY(1,1) CONSTRAINT PK_Categories PRIMARY KEY,
    ParentId        INT              NULL,
    Name            NVARCHAR(120)    NOT NULL,
    Slug            NVARCHAR(140)    NOT NULL,
    Description     NVARCHAR(500)    NULL,
    ImageUrl        NVARCHAR(512)    NULL,
    SortOrder       INT              NOT NULL CONSTRAINT DF_Categories_SortOrder DEFAULT (0),
    IsActive        BIT              NOT NULL CONSTRAINT DF_Categories_IsActive DEFAULT (1),
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Categories_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Categories_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Categories_Slug UNIQUE (Slug),
    CONSTRAINT FK_Categories_Parent FOREIGN KEY (ParentId) REFERENCES dbo.Categories (CategoryId)
);
GO

CREATE TABLE dbo.Products (
    ProductId       UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Products PRIMARY KEY
                    CONSTRAINT DF_Products_ProductId DEFAULT (NEWSEQUENTIALID()),
    ShopId          UNIQUEIDENTIFIER NOT NULL,
    CategoryId      INT              NOT NULL,
    Name            NVARCHAR(256)    NOT NULL,
    Slug            NVARCHAR(280)    NOT NULL,
    ShortDescription NVARCHAR(500)   NULL,
    Description     NVARCHAR(MAX)    NULL,           -- HTML / markdown mô tả dài
    Brand           NVARCHAR(100)    NULL,
    ModelNumber     NVARCHAR(100)    NULL,           -- mã model (VD: SM-S928B)
    Sku             NVARCHAR(64)     NULL,
    Barcode         NVARCHAR(64)     NULL,
    ConditionType   NVARCHAR(20)     NOT NULL CONSTRAINT DF_Products_Condition DEFAULT (N'New'),
        -- New | LikeNew | Refurbished | Used
    -- Giá BÁN (catalog) - độc lập với giá nhập theo lô
    BasePrice       DECIMAL(18,2)    NOT NULL,         -- giá niêm yết
    SalePrice       DECIMAL(18,2)    NULL,             -- giá khuyến mãi (nullable)
    Currency        CHAR(3)          NOT NULL CONSTRAINT DF_Products_Currency DEFAULT ('VND'),
    -- Giá NHẬP tổng hợp (denormalized từ InventoryLots - chỉ để báo cáo)
    LastCostPrice   DECIMAL(18,2)    NULL,             -- UnitCost của lô nhập gần nhất
    AvgCostPrice    DECIMAL(18,2)    NULL,             -- TB gia quyền tồn hiện tại
    -- Tồn kho tổng ( = SUM InventoryLots.QuantityRemaining )
    StockQuantity   INT              NOT NULL CONSTRAINT DF_Products_Stock DEFAULT (0),
    ReservedQuantity INT             NOT NULL CONSTRAINT DF_Products_Reserved DEFAULT (0),
    LowStockThreshold INT            NOT NULL CONSTRAINT DF_Products_LowStock DEFAULT (5),
    WarrantyMonths  INT              NULL,
    WeightGrams     INT              NULL,
    LengthCm        DECIMAL(8,2)     NULL,
    WidthCm         DECIMAL(8,2)     NULL,
    HeightCm        DECIMAL(8,2)     NULL,
    OriginCountry   NVARCHAR(80)     NULL,
    TagsJson        NVARCHAR(MAX)    NULL,             -- ["flagship","5g"]
    SpecsJson       NVARCHAR(MAX)    NULL,             -- attrs cho filter / AI compare
    -- Trục cấu hình sinh ra ProductVariants, giữ đúng thứ tự seller khai báo:
    -- [{"name":"Color","values":["Orange","White"]},{"name":"Storage","values":["128GB","256GB"]}]
    VariantOptionsJson NVARCHAR(MAX) NULL,
    MetaTitle       NVARCHAR(160)    NULL,
    MetaDescription NVARCHAR(320)    NULL,
    IsFeatured      BIT              NOT NULL CONSTRAINT DF_Products_IsFeatured DEFAULT (0),
    PublishedAt     DATETIME2(3)     NULL,
    Status          NVARCHAR(20)     NOT NULL CONSTRAINT DF_Products_Status DEFAULT (N'Pending'),
        -- Draft | Pending | Approved | Rejected | Inactive | Deleted
    AvgRating       DECIMAL(3,2)     NOT NULL CONSTRAINT DF_Products_AvgRating DEFAULT (0),
    ReviewCount     INT              NOT NULL CONSTRAINT DF_Products_ReviewCount DEFAULT (0),
    SoldCount       INT              NOT NULL CONSTRAINT DF_Products_SoldCount DEFAULT (0),
    ViewCount       INT              NOT NULL CONSTRAINT DF_Products_ViewCount DEFAULT (0),
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Products_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Products_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Products_Shop FOREIGN KEY (ShopId) REFERENCES dbo.Shops (ShopId),
    CONSTRAINT FK_Products_Category FOREIGN KEY (CategoryId) REFERENCES dbo.Categories (CategoryId),
    CONSTRAINT CK_Products_Status CHECK (Status IN (N'Draft', N'Pending', N'Approved', N'Rejected', N'Inactive', N'Deleted')),
    CONSTRAINT CK_Products_Condition CHECK (ConditionType IN (N'New', N'LikeNew', N'Refurbished', N'Used')),
    CONSTRAINT CK_Products_Price CHECK (BasePrice >= 0 AND (SalePrice IS NULL OR SalePrice >= 0)),
    CONSTRAINT CK_Products_Stock CHECK (StockQuantity >= 0 AND ReservedQuantity >= 0)
);
GO

CREATE UNIQUE INDEX UQ_Products_Shop_Slug ON dbo.Products (ShopId, Slug);
CREATE INDEX IX_Products_Category_Status ON dbo.Products (CategoryId, Status);
CREATE INDEX IX_Products_Shop_Status ON dbo.Products (ShopId, Status);
CREATE INDEX IX_Products_Name ON dbo.Products (Name);
GO

CREATE TABLE dbo.ProductImages (
    ProductImageId  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProductImages PRIMARY KEY
                    CONSTRAINT DF_ProductImages_Id DEFAULT (NEWSEQUENTIALID()),
    ProductId       UNIQUEIDENTIFIER NOT NULL,
    ImageUrl        NVARCHAR(512)    NOT NULL,         -- Cloudinary
    PublicId        NVARCHAR(256)    NULL,
    SortOrder       INT              NOT NULL CONSTRAINT DF_ProductImages_Sort DEFAULT (0),
    IsPrimary       BIT              NOT NULL CONSTRAINT DF_ProductImages_IsPrimary DEFAULT (0),
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_ProductImages_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ProductImages_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId) ON DELETE CASCADE
);
GO

CREATE INDEX IX_ProductImages_ProductId ON dbo.ProductImages (ProductId);
GO

CREATE TABLE dbo.ProductVariants (
    VariantId       UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProductVariants PRIMARY KEY
                    CONSTRAINT DF_ProductVariants_Id DEFAULT (NEWSEQUENTIALID()),
    ProductId       UNIQUEIDENTIFIER NOT NULL,
    Sku             NVARCHAR(64)     NULL,
    VariantName     NVARCHAR(150)    NOT NULL,         -- e.g. "128GB / Black"
    AttributesJson  NVARCHAR(MAX)    NULL,             -- {"Color":"Orange","Storage":"128GB"}
    Price           DECIMAL(18,2)    NOT NULL,         -- giá bán variant (override)
    SalePrice       DECIMAL(18,2)    NULL,             -- giá khuyến mãi riêng của variant
    LastCostPrice   DECIMAL(18,2)    NULL,
    AvgCostPrice    DECIMAL(18,2)    NULL,
    StockQuantity   INT              NOT NULL CONSTRAINT DF_Variants_Stock DEFAULT (0),
    ReservedQuantity INT             NOT NULL CONSTRAINT DF_Variants_Reserved DEFAULT (0),
    ImageUrl        NVARCHAR(512)    NULL,             -- ảnh đổi theo cấu hình đang chọn
    SortOrder       INT              NOT NULL CONSTRAINT DF_Variants_SortOrder DEFAULT (0),
    IsActive        BIT              NOT NULL CONSTRAINT DF_Variants_IsActive DEFAULT (1),
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Variants_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Variants_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Variants_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId) ON DELETE CASCADE,
    CONSTRAINT CK_Variants_Price CHECK (Price >= 0 AND (SalePrice IS NULL OR SalePrice >= 0)),
    CONSTRAINT CK_Variants_Stock CHECK (StockQuantity >= 0 AND ReservedQuantity >= 0)
);
GO

CREATE INDEX IX_ProductVariants_ProductId ON dbo.ProductVariants (ProductId, SortOrder);
CREATE UNIQUE INDEX UQ_ProductVariants_Product_Sku
    ON dbo.ProductVariants (ProductId, Sku) WHERE Sku IS NOT NULL;
GO

/*
  InventoryLots - mỗi lần nhập kho = 1 lô với UnitCost riêng (UC-91).
  Không UPDATE UnitCost của lô đã tạo; lô mới = INSERT mới.
*/
CREATE TABLE dbo.InventoryLots (
    LotId               UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_InventoryLots PRIMARY KEY
                        CONSTRAINT DF_InventoryLots_Id DEFAULT (NEWSEQUENTIALID()),
    ProductId           UNIQUEIDENTIFIER NOT NULL,
    VariantId           UNIQUEIDENTIFIER NULL,
    LotCode             NVARCHAR(40)     NOT NULL,      -- LOT-20260315-001
    QuantityReceived    INT              NOT NULL,
    QuantityRemaining   INT              NOT NULL,
    UnitCost            DECIMAL(18,2)    NOT NULL,      -- giá nhập / đơn vị của LÔ NÀY
    Currency            CHAR(3)          NOT NULL CONSTRAINT DF_Lots_Currency DEFAULT ('VND'),
    SupplierName        NVARCHAR(150)    NULL,
    InvoiceNumber       NVARCHAR(80)     NULL,
    ReceivedAt          DATETIME2(3)     NOT NULL CONSTRAINT DF_Lots_ReceivedAt DEFAULT (SYSUTCDATETIME()),
    ExpiresAt           DATETIME2(3)     NULL,          -- optional (ít dùng cho điện tử)
    Status              NVARCHAR(20)     NOT NULL CONSTRAINT DF_Lots_Status DEFAULT (N'Open'),
        -- Open | Depleted | Void
    Note                NVARCHAR(500)    NULL,
    CreatedBy           UNIQUEIDENTIFIER NULL,
    CreatedAt           DATETIME2(3)     NOT NULL CONSTRAINT DF_Lots_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Lots_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId),
    CONSTRAINT FK_Lots_Variant FOREIGN KEY (VariantId) REFERENCES dbo.ProductVariants (VariantId),
    CONSTRAINT FK_Lots_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users (UserId),
    CONSTRAINT UQ_Lots_Product_LotCode UNIQUE (ProductId, LotCode),
    CONSTRAINT CK_Lots_Qty CHECK (QuantityReceived > 0 AND QuantityRemaining >= 0 AND QuantityRemaining <= QuantityReceived),
    CONSTRAINT CK_Lots_UnitCost CHECK (UnitCost >= 0),
    CONSTRAINT CK_Lots_Status CHECK (Status IN (N'Open', N'Depleted', N'Void'))
);
GO

CREATE INDEX IX_Lots_Product_Status_ReceivedAt
    ON dbo.InventoryLots (ProductId, Status, ReceivedAt);  -- FIFO: ORDER BY ReceivedAt ASC
GO

/* Lịch sử đổi giá BÁN trên web (UC-92) - không liên quan UnitCost lô */
CREATE TABLE dbo.ProductPriceHistories (
    PriceHistoryId  BIGINT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_ProductPriceHistories PRIMARY KEY,
    ProductId       UNIQUEIDENTIFIER NOT NULL,
    VariantId       UNIQUEIDENTIFIER NULL,
    OldBasePrice    DECIMAL(18,2)    NULL,
    NewBasePrice    DECIMAL(18,2)    NULL,
    OldSalePrice    DECIMAL(18,2)    NULL,
    NewSalePrice    DECIMAL(18,2)    NULL,
    ChangedBy       UNIQUEIDENTIFIER NULL,
    Reason          NVARCHAR(300)    NULL,
    ChangedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_PriceHist_ChangedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_PriceHist_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId),
    CONSTRAINT FK_PriceHist_Variant FOREIGN KEY (VariantId) REFERENCES dbo.ProductVariants (VariantId),
    CONSTRAINT FK_PriceHist_User FOREIGN KEY (ChangedBy) REFERENCES dbo.Users (UserId)
);
GO

CREATE TABLE dbo.InventoryTransactions (
    InventoryTxId   BIGINT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_InventoryTx PRIMARY KEY,
    ProductId       UNIQUEIDENTIFIER NOT NULL,
    VariantId       UNIQUEIDENTIFIER NULL,
    LotId           UNIQUEIDENTIFIER NULL,             -- gắn lô khi nhập/xuất theo lô
    ChangeQty       INT              NOT NULL,          -- +inbound / -outbound
    UnitCost        DECIMAL(18,2)    NULL,              -- copy từ lô lúc giao dịch
    Reason          NVARCHAR(40)     NOT NULL,
        -- StockIn | ManualAdjust | OrderReserve | OrderRelease | OrderSold | ReturnRestock | VoidLot
    ReferenceType   NVARCHAR(40)     NULL,             -- Order | ReturnRequest | Lot
    ReferenceId     UNIQUEIDENTIFIER NULL,
    Note            NVARCHAR(300)    NULL,
    CreatedBy       UNIQUEIDENTIFIER NULL,
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_InventoryTx_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_InventoryTx_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId),
    CONSTRAINT FK_InventoryTx_Variant FOREIGN KEY (VariantId) REFERENCES dbo.ProductVariants (VariantId),
    CONSTRAINT FK_InventoryTx_Lot FOREIGN KEY (LotId) REFERENCES dbo.InventoryLots (LotId)
);
GO

CREATE TABLE dbo.ProductModerationHistory (
    ModerationId    BIGINT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_ProductModeration PRIMARY KEY,
    ProductId       UNIQUEIDENTIFIER NOT NULL,
    AdminUserId     UNIQUEIDENTIFIER NOT NULL,
    Action          NVARCHAR(20)     NOT NULL,          -- Approve | Reject | RequestChange
    FromStatus      NVARCHAR(20)     NOT NULL,
    ToStatus        NVARCHAR(20)     NOT NULL,
    Reason          NVARCHAR(500)    NULL,
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_ProductModeration_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ProductModeration_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId),
    CONSTRAINT FK_ProductModeration_Admin FOREIGN KEY (AdminUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_ProductModeration_Action CHECK (Action IN (N'Approve', N'Reject', N'RequestChange'))
);
GO

CREATE INDEX IX_ProductModeration_ProductId ON dbo.ProductModerationHistory (ProductId);
GO

/* -------------------------------------------------------------------------- */
/* 4. Cart & Wishlist                                                         */
/* -------------------------------------------------------------------------- */

CREATE TABLE dbo.Carts (
    CartId          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Carts PRIMARY KEY
                    CONSTRAINT DF_Carts_CartId DEFAULT (NEWSEQUENTIALID()),
    UserId          UNIQUEIDENTIFIER NOT NULL,
    UpdatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Carts_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Carts_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Carts_UserId UNIQUE (UserId),
    CONSTRAINT FK_Carts_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId)
);
GO

CREATE TABLE dbo.CartItems (
    CartItemId      UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CartItems PRIMARY KEY
                    CONSTRAINT DF_CartItems_Id DEFAULT (NEWSEQUENTIALID()),
    CartId          UNIQUEIDENTIFIER NOT NULL,
    ProductId       UNIQUEIDENTIFIER NOT NULL,
    VariantId       UNIQUEIDENTIFIER NULL,
    Quantity        INT              NOT NULL CONSTRAINT DF_CartItems_Qty DEFAULT (1),
    UnitPriceSnapshot DECIMAL(18,2)  NULL,
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_CartItems_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_CartItems_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_CartItems_Cart FOREIGN KEY (CartId) REFERENCES dbo.Carts (CartId) ON DELETE CASCADE,
    CONSTRAINT FK_CartItems_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId),
    CONSTRAINT FK_CartItems_Variant FOREIGN KEY (VariantId) REFERENCES dbo.ProductVariants (VariantId),
    CONSTRAINT CK_CartItems_Qty CHECK (Quantity > 0),
    CONSTRAINT UQ_CartItems_Cart_Product_Variant UNIQUE (CartId, ProductId, VariantId)
);
GO

CREATE TABLE dbo.WishlistItems (
    WishlistItemId  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_WishlistItems PRIMARY KEY
                    CONSTRAINT DF_WishlistItems_Id DEFAULT (NEWSEQUENTIALID()),
    UserId          UNIQUEIDENTIFIER NOT NULL,
    ProductId       UNIQUEIDENTIFIER NOT NULL,
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_WishlistItems_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_WishlistItems_User FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_WishlistItems_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId),
    CONSTRAINT UQ_WishlistItems_User_Product UNIQUE (UserId, ProductId)
);
GO

/* -------------------------------------------------------------------------- */
/* 5. Vouchers                                                                */
/* -------------------------------------------------------------------------- */

CREATE TABLE dbo.Vouchers (
    VoucherId       UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Vouchers PRIMARY KEY
                    CONSTRAINT DF_Vouchers_Id DEFAULT (NEWSEQUENTIALID()),
    Code            NVARCHAR(40)     NOT NULL,
    Name            NVARCHAR(150)    NOT NULL,
    Description     NVARCHAR(500)    NULL,
    Scope           NVARCHAR(20)     NOT NULL,          -- System | Shop
    ShopId          UNIQUEIDENTIFIER NULL,              -- required when Scope=Shop
    DiscountType    NVARCHAR(20)     NOT NULL,          -- Percent | FixedAmount
    DiscountValue   DECIMAL(18,2)    NOT NULL,
    MaxDiscountAmount DECIMAL(18,2)  NULL,
    MinOrderAmount  DECIMAL(18,2)    NOT NULL CONSTRAINT DF_Vouchers_MinOrder DEFAULT (0),
    UsageLimit      INT              NULL,              -- null = unlimited
    PerUserLimit    INT              NOT NULL CONSTRAINT DF_Vouchers_PerUser DEFAULT (1),
    UsedCount       INT              NOT NULL CONSTRAINT DF_Vouchers_UsedCount DEFAULT (0),
    StartsAt        DATETIME2(3)     NOT NULL,
    EndsAt          DATETIME2(3)     NOT NULL,
    IsActive        BIT              NOT NULL CONSTRAINT DF_Vouchers_IsActive DEFAULT (1),
    CreatedBy       UNIQUEIDENTIFIER NOT NULL,
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Vouchers_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Vouchers_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Vouchers_Code UNIQUE (Code),
    CONSTRAINT FK_Vouchers_Shop FOREIGN KEY (ShopId) REFERENCES dbo.Shops (ShopId),
    CONSTRAINT FK_Vouchers_Creator FOREIGN KEY (CreatedBy) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Vouchers_Scope CHECK (Scope IN (N'System', N'Shop')),
    CONSTRAINT CK_Vouchers_DiscountType CHECK (DiscountType IN (N'Percent', N'FixedAmount')),
    CONSTRAINT CK_Vouchers_ShopScope CHECK (
        (Scope = N'System' AND ShopId IS NULL) OR (Scope = N'Shop' AND ShopId IS NOT NULL)
    ),
    CONSTRAINT CK_Vouchers_Period CHECK (EndsAt > StartsAt)
);
GO

CREATE INDEX IX_Vouchers_Active_Period ON dbo.Vouchers (IsActive, StartsAt, EndsAt);
GO

CREATE TABLE dbo.VoucherRedemptions (
    RedemptionId    UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_VoucherRedemptions PRIMARY KEY
                    CONSTRAINT DF_VoucherRedemptions_Id DEFAULT (NEWSEQUENTIALID()),
    VoucherId       UNIQUEIDENTIFIER NOT NULL,
    UserId          UNIQUEIDENTIFIER NOT NULL,
    OrderId         UNIQUEIDENTIFIER NULL,              -- FK after Orders
    DiscountAmount  DECIMAL(18,2)    NOT NULL,
    RedeemedAt      DATETIME2(3)     NOT NULL CONSTRAINT DF_VoucherRedemptions_At DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_VoucherRedemptions_Voucher FOREIGN KEY (VoucherId) REFERENCES dbo.Vouchers (VoucherId),
    CONSTRAINT FK_VoucherRedemptions_User FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId)
);
GO

/* -------------------------------------------------------------------------- */
/* 6. Orders & Payments                                                       */
/* -------------------------------------------------------------------------- */

CREATE TABLE dbo.Orders (
    OrderId             UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Orders PRIMARY KEY
                        CONSTRAINT DF_Orders_OrderId DEFAULT (NEWSEQUENTIALID()),
    OrderCode           NVARCHAR(30)     NOT NULL,
    BuyerUserId         UNIQUEIDENTIFIER NOT NULL,
    ShopId              UNIQUEIDENTIFIER NOT NULL,      -- 1 order = 1 shop (split cart if multi-shop)
    ShippingAddressId   UNIQUEIDENTIFIER NULL,
    ShippingSnapshotJson NVARCHAR(MAX)   NOT NULL,      -- freeze address at checkout
    Status              NVARCHAR(30)     NOT NULL CONSTRAINT DF_Orders_Status DEFAULT (N'PendingPayment'),
        -- PendingPayment | Paid | Confirmed | Shipping | Delivered | Completed
        -- Cancelled | ReturnRequested | Returned
    SubtotalAmount      DECIMAL(18,2)    NOT NULL,
    DiscountAmount      DECIMAL(18,2)    NOT NULL CONSTRAINT DF_Orders_Discount DEFAULT (0),
    ShippingFee         DECIMAL(18,2)    NOT NULL CONSTRAINT DF_Orders_Shipping DEFAULT (0),
    TotalAmount         DECIMAL(18,2)    NOT NULL,
    Currency            CHAR(3)          NOT NULL CONSTRAINT DF_Orders_Currency DEFAULT ('VND'),
    VoucherId           UNIQUEIDENTIFIER NULL,
    BuyerNote           NVARCHAR(500)    NULL,
    SellerNote          NVARCHAR(500)    NULL,
    TrackingCode        NVARCHAR(100)    NULL,
    PaidAt              DATETIME2(3)     NULL,
    CancelledAt         DATETIME2(3)     NULL,
    DeliveredAt         DATETIME2(3)     NULL,
    CompletedAt         DATETIME2(3)     NULL,
    CreatedAt           DATETIME2(3)     NOT NULL CONSTRAINT DF_Orders_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt           DATETIME2(3)     NOT NULL CONSTRAINT DF_Orders_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Orders_OrderCode UNIQUE (OrderCode),
    CONSTRAINT FK_Orders_Buyer FOREIGN KEY (BuyerUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_Orders_Shop FOREIGN KEY (ShopId) REFERENCES dbo.Shops (ShopId),
    CONSTRAINT FK_Orders_Address FOREIGN KEY (ShippingAddressId) REFERENCES dbo.Addresses (AddressId),
    CONSTRAINT FK_Orders_Voucher FOREIGN KEY (VoucherId) REFERENCES dbo.Vouchers (VoucherId)
);
GO

CREATE INDEX IX_Orders_Buyer_CreatedAt ON dbo.Orders (BuyerUserId, CreatedAt DESC);
CREATE INDEX IX_Orders_Shop_Status ON dbo.Orders (ShopId, Status);
GO

CREATE TABLE dbo.OrderItems (
    OrderItemId     UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_OrderItems PRIMARY KEY
                    CONSTRAINT DF_OrderItems_Id DEFAULT (NEWSEQUENTIALID()),
    OrderId         UNIQUEIDENTIFIER NOT NULL,
    ProductId       UNIQUEIDENTIFIER NOT NULL,
    VariantId       UNIQUEIDENTIFIER NULL,
    ProductNameSnapshot NVARCHAR(256) NOT NULL,
    VariantNameSnapshot NVARCHAR(150) NULL,            -- "Orange / 128GB" lúc đặt hàng
    SkuSnapshot     NVARCHAR(64)     NULL,
    UnitPrice       DECIMAL(18,2)    NOT NULL,         -- giá BÁN lúc checkout (snapshot)
    UnitCostAvg     DECIMAL(18,2)    NULL,             -- COGS TB của dòng (từ các lô FIFO)
    Quantity        INT              NOT NULL,
    LineTotal       DECIMAL(18,2)    NOT NULL,
    CONSTRAINT FK_OrderItems_Order FOREIGN KEY (OrderId) REFERENCES dbo.Orders (OrderId) ON DELETE CASCADE,
    CONSTRAINT FK_OrderItems_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId),
    CONSTRAINT FK_OrderItems_Variant FOREIGN KEY (VariantId) REFERENCES dbo.ProductVariants (VariantId),
    CONSTRAINT CK_OrderItems_Qty CHECK (Quantity > 0)
);
GO

/* Phân bổ số lượng bán theo từng lô (FIFO) - phục vụ lãi gộp chính xác */
CREATE TABLE dbo.OrderItemLotAllocations (
    AllocationId    UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_OrderItemLotAllocations PRIMARY KEY
                    CONSTRAINT DF_OrderItemLotAlloc_Id DEFAULT (NEWSEQUENTIALID()),
    OrderItemId     UNIQUEIDENTIFIER NOT NULL,
    LotId           UNIQUEIDENTIFIER NOT NULL,
    Quantity        INT              NOT NULL,
    UnitCostSnapshot DECIMAL(18,2)   NOT NULL,         -- copy UnitCost lô tại thời điểm bán
    CONSTRAINT FK_LotAlloc_OrderItem FOREIGN KEY (OrderItemId) REFERENCES dbo.OrderItems (OrderItemId) ON DELETE CASCADE,
    CONSTRAINT FK_LotAlloc_Lot FOREIGN KEY (LotId) REFERENCES dbo.InventoryLots (LotId),
    CONSTRAINT CK_LotAlloc_Qty CHECK (Quantity > 0)
);
GO

CREATE INDEX IX_LotAlloc_OrderItem ON dbo.OrderItemLotAllocations (OrderItemId);
GO

CREATE TABLE dbo.OrderStatusHistories (
    HistoryId       BIGINT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_OrderStatusHistories PRIMARY KEY,
    OrderId         UNIQUEIDENTIFIER NOT NULL,
    FromStatus      NVARCHAR(30)     NULL,
    ToStatus        NVARCHAR(30)     NOT NULL,
    ChangedBy       UNIQUEIDENTIFIER NULL,
    Note            NVARCHAR(300)    NULL,
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_OrderStatusHistories_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_OrderStatusHistories_Order FOREIGN KEY (OrderId) REFERENCES dbo.Orders (OrderId) ON DELETE CASCADE
);
GO

CREATE TABLE dbo.Payments (
    PaymentId       UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Payments PRIMARY KEY
                    CONSTRAINT DF_Payments_Id DEFAULT (NEWSEQUENTIALID()),
    OrderId         UNIQUEIDENTIFIER NOT NULL,
    Provider        NVARCHAR(30)     NOT NULL CONSTRAINT DF_Payments_Provider DEFAULT (N'payOS'),
    ProviderPaymentId NVARCHAR(100)  NULL,
    Amount          DECIMAL(18,2)    NOT NULL,
    Currency        CHAR(3)          NOT NULL CONSTRAINT DF_Payments_Currency DEFAULT ('VND'),
    Status          NVARCHAR(20)     NOT NULL CONSTRAINT DF_Payments_Status DEFAULT (N'Pending'),
        -- Pending | Succeeded | Failed | Cancelled | Refunded
    CheckoutUrl     NVARCHAR(512)    NULL,
    PaidAt          DATETIME2(3)     NULL,
    RawResponseJson NVARCHAR(MAX)    NULL,
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Payments_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Payments_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Payments_Order FOREIGN KEY (OrderId) REFERENCES dbo.Orders (OrderId),
    CONSTRAINT CK_Payments_Status CHECK (Status IN (N'Pending', N'Succeeded', N'Failed', N'Cancelled', N'Refunded'))
);
GO

CREATE INDEX IX_Payments_OrderId ON dbo.Payments (OrderId);
GO

/* deferred FKs */
ALTER TABLE dbo.SellerRatings
    ADD CONSTRAINT FK_SellerRatings_Order FOREIGN KEY (OrderId) REFERENCES dbo.Orders (OrderId);
GO

ALTER TABLE dbo.VoucherRedemptions
    ADD CONSTRAINT FK_VoucherRedemptions_Order FOREIGN KEY (OrderId) REFERENCES dbo.Orders (OrderId);
GO

/* -------------------------------------------------------------------------- */
/* 7. Returns                                                                 */
/* -------------------------------------------------------------------------- */

CREATE TABLE dbo.ReturnRequests (
    ReturnRequestId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ReturnRequests PRIMARY KEY
                    CONSTRAINT DF_ReturnRequests_Id DEFAULT (NEWSEQUENTIALID()),
    OrderId         UNIQUEIDENTIFIER NOT NULL,
    BuyerUserId     UNIQUEIDENTIFIER NOT NULL,
    Reason          NVARCHAR(500)    NOT NULL,
    Description     NVARCHAR(2000)   NULL,
    -- Deprecated generic bag; prefer ReturnEvidences (Unboxing / Testing). Kept for optional extra media.
    EvidenceUrls    NVARCHAR(MAX)    NULL,             -- JSON array of extra URLs (optional)
    ResolutionType  NVARCHAR(20)     NOT NULL CONSTRAINT DF_ReturnRequests_Resolution DEFAULT (N'ReturnRefund'),
        -- ReturnRefund (trả + hoàn) | Exchange (đổi hàng)
    Status          NVARCHAR(30)     NOT NULL CONSTRAINT DF_ReturnRequests_Status DEFAULT (N'Pending'),
        -- Pending → Approved → SellerConfirmed → Receiving → Accepted → (Refunded|Exchanged) → Closed
        -- (hoặc Rejected)
    RefundAmount    DECIMAL(18,2)    NULL,
    AdminNote       NVARCHAR(500)    NULL,
    ReviewedBy      UNIQUEIDENTIFIER NULL,
    ReviewedAt      DATETIME2(3)     NULL,
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_ReturnRequests_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_ReturnRequests_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ReturnRequests_Order FOREIGN KEY (OrderId) REFERENCES dbo.Orders (OrderId),
    CONSTRAINT FK_ReturnRequests_Buyer FOREIGN KEY (BuyerUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_ReturnRequests_Reviewer FOREIGN KEY (ReviewedBy) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_ReturnRequests_Status CHECK (Status IN (
        N'Pending', N'Approved', N'Rejected', N'SellerConfirmed', N'Receiving',
        N'Accepted', N'Refunded', N'Exchanged', N'Closed')),
    CONSTRAINT CK_ReturnRequests_Resolution CHECK (ResolutionType IN (N'ReturnRefund', N'Exchange'))
);
GO

CREATE TABLE dbo.ReturnRequestItems (
    ReturnItemId    UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ReturnRequestItems PRIMARY KEY
                    CONSTRAINT DF_ReturnRequestItems_Id DEFAULT (NEWSEQUENTIALID()),
    ReturnRequestId UNIQUEIDENTIFIER NOT NULL,
    OrderItemId     UNIQUEIDENTIFIER NOT NULL,
    Quantity        INT              NOT NULL,
    CONSTRAINT FK_ReturnItems_Request FOREIGN KEY (ReturnRequestId) REFERENCES dbo.ReturnRequests (ReturnRequestId) ON DELETE CASCADE,
    CONSTRAINT FK_ReturnItems_OrderItem FOREIGN KEY (OrderItemId) REFERENCES dbo.OrderItems (OrderItemId),
    CONSTRAINT CK_ReturnItems_Qty CHECK (Quantity > 0)
);
GO

/*
  ReturnEvidences - video/ảnh bằng chứng bắt buộc theo policy kiểu Shopee:
  - Unboxing: quay 6 mặt kiện + mã vận đơn còn nguyên trước khi khui + quá trình mở hộp
  - Testing: cận cảnh thiết bị, cắm sạc/bật nguồn, chứng minh lỗi kỹ thuật / hư hỏng vận chuyển
  UC-43 yêu cầu tối thiểu 1 Unboxing + 1 Testing khi tạo request.
*/
CREATE TABLE dbo.ReturnEvidences (
    EvidenceId      UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ReturnEvidences PRIMARY KEY
                    CONSTRAINT DF_ReturnEvidences_Id DEFAULT (NEWSEQUENTIALID()),
    ReturnRequestId UNIQUEIDENTIFIER NOT NULL,
    EvidenceType    NVARCHAR(20)     NOT NULL,          -- Unboxing | Testing | Other
    MediaUrl        NVARCHAR(512)    NOT NULL,          -- Cloudinary secure URL
    PublicId        NVARCHAR(256)    NULL,
    SortOrder       INT              NOT NULL CONSTRAINT DF_ReturnEvidences_Sort DEFAULT (0),
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_ReturnEvidences_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ReturnEvidences_Request FOREIGN KEY (ReturnRequestId)
        REFERENCES dbo.ReturnRequests (ReturnRequestId) ON DELETE CASCADE,
    CONSTRAINT CK_ReturnEvidences_Type CHECK (EvidenceType IN (N'Unboxing', N'Testing', N'Other'))
);
GO

CREATE INDEX IX_ReturnEvidences_Request_Type ON dbo.ReturnEvidences (ReturnRequestId, EvidenceType);
GO

CREATE TABLE dbo.ReturnStatusHistories (
    HistoryId       BIGINT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_ReturnStatusHistories PRIMARY KEY,
    ReturnRequestId UNIQUEIDENTIFIER NOT NULL,
    FromStatus      NVARCHAR(30)     NULL,
    ToStatus        NVARCHAR(30)     NOT NULL,
    ChangedBy       UNIQUEIDENTIFIER NULL,
    Note            NVARCHAR(300)    NULL,
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_ReturnStatusHistories_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ReturnStatusHistories_Request FOREIGN KEY (ReturnRequestId) REFERENCES dbo.ReturnRequests (ReturnRequestId) ON DELETE CASCADE
);
GO

/* -------------------------------------------------------------------------- */
/* 8. Reviews                                                                 */
/* -------------------------------------------------------------------------- */

CREATE TABLE dbo.ProductReviews (
    ReviewId        UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProductReviews PRIMARY KEY
                    CONSTRAINT DF_ProductReviews_Id DEFAULT (NEWSEQUENTIALID()),
    ProductId       UNIQUEIDENTIFIER NOT NULL,
    BuyerUserId     UNIQUEIDENTIFIER NOT NULL,
    OrderId         UNIQUEIDENTIFIER NULL,
    Rating          TINYINT          NOT NULL,
    Title           NVARCHAR(150)    NULL,
    Content         NVARCHAR(2000)   NULL,
    SentimentLabel  NVARCHAR(20)     NULL,             -- Positive | Neutral | Negative (AI)
    SentimentScore  DECIMAL(5,4)     NULL,
    IsVisible       BIT              NOT NULL CONSTRAINT DF_ProductReviews_IsVisible DEFAULT (1),
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_ProductReviews_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_ProductReviews_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ProductReviews_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId),
    CONSTRAINT FK_ProductReviews_Buyer FOREIGN KEY (BuyerUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_ProductReviews_Order FOREIGN KEY (OrderId) REFERENCES dbo.Orders (OrderId),
    CONSTRAINT CK_ProductReviews_Rating CHECK (Rating BETWEEN 1 AND 5),
    CONSTRAINT UQ_ProductReviews_Buyer_Product_Order UNIQUE (BuyerUserId, ProductId, OrderId)
);
GO

CREATE INDEX IX_ProductReviews_ProductId ON dbo.ProductReviews (ProductId);
GO

/* -------------------------------------------------------------------------- */
/* 9. Notifications & Chat                                                    */
/* -------------------------------------------------------------------------- */

CREATE TABLE dbo.Notifications (
    NotificationId  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY
                    CONSTRAINT DF_Notifications_Id DEFAULT (NEWSEQUENTIALID()),
    UserId          UNIQUEIDENTIFIER NOT NULL,
    Title           NVARCHAR(200)    NOT NULL,
    Body            NVARCHAR(1000)   NOT NULL,
    Type            NVARCHAR(40)     NOT NULL,          -- Order | Payment | Moderation | Chat | System | Promo
    ReferenceType   NVARCHAR(40)     NULL,
    ReferenceId     UNIQUEIDENTIFIER NULL,
    IsRead          BIT              NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT (0),
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Notifications_User FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId)
);
GO

CREATE INDEX IX_Notifications_User_CreatedAt ON dbo.Notifications (UserId, CreatedAt DESC);
GO

CREATE TABLE dbo.ChatThreads (
    ThreadId        UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ChatThreads PRIMARY KEY
                    CONSTRAINT DF_ChatThreads_Id DEFAULT (NEWSEQUENTIALID()),
    BuyerUserId     UNIQUEIDENTIFIER NOT NULL,
    ShopId          UNIQUEIDENTIFIER NOT NULL,
    ProductId       UNIQUEIDENTIFIER NULL,             -- optional context product
    LastMessageAt   DATETIME2(3)     NULL,
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_ChatThreads_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ChatThreads_Buyer FOREIGN KEY (BuyerUserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_ChatThreads_Shop FOREIGN KEY (ShopId) REFERENCES dbo.Shops (ShopId),
    CONSTRAINT FK_ChatThreads_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId),
    CONSTRAINT UQ_ChatThreads_Buyer_Shop UNIQUE (BuyerUserId, ShopId)
);
GO

CREATE TABLE dbo.ChatMessages (
    MessageId       UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ChatMessages PRIMARY KEY
                    CONSTRAINT DF_ChatMessages_Id DEFAULT (NEWSEQUENTIALID()),
    ThreadId        UNIQUEIDENTIFIER NOT NULL,
    SenderUserId    UNIQUEIDENTIFIER NOT NULL,
    Content         NVARCHAR(2000)   NOT NULL,
    AttachmentUrl   NVARCHAR(512)    NULL,
    IsRead          BIT              NOT NULL CONSTRAINT DF_ChatMessages_IsRead DEFAULT (0),
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_ChatMessages_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ChatMessages_Thread FOREIGN KEY (ThreadId) REFERENCES dbo.ChatThreads (ThreadId) ON DELETE CASCADE,
    CONSTRAINT FK_ChatMessages_Sender FOREIGN KEY (SenderUserId) REFERENCES dbo.Users (UserId)
);
GO

CREATE INDEX IX_ChatMessages_Thread_CreatedAt ON dbo.ChatMessages (ThreadId, CreatedAt);
GO

/* -------------------------------------------------------------------------- */
/* 10. Wallet (Seller)                                                        */
/* -------------------------------------------------------------------------- */

CREATE TABLE dbo.Wallets (
    WalletId        UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Wallets PRIMARY KEY
                    CONSTRAINT DF_Wallets_Id DEFAULT (NEWSEQUENTIALID()),
    ShopId          UNIQUEIDENTIFIER NOT NULL,
    AvailableBalance DECIMAL(18,2)   NOT NULL CONSTRAINT DF_Wallets_Available DEFAULT (0),
    PendingBalance  DECIMAL(18,2)    NOT NULL CONSTRAINT DF_Wallets_Pending DEFAULT (0),
    Currency        CHAR(3)          NOT NULL CONSTRAINT DF_Wallets_Currency DEFAULT ('VND'),
    UpdatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Wallets_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_Wallets_ShopId UNIQUE (ShopId),
    CONSTRAINT FK_Wallets_Shop FOREIGN KEY (ShopId) REFERENCES dbo.Shops (ShopId),
    -- AvailableBalance may go negative after RefundDebit (BR-R04); PendingBalance stays non-negative.
    CONSTRAINT CK_Wallets_Balance CHECK (PendingBalance >= 0)
);
GO

CREATE TABLE dbo.WalletTransactions (
    WalletTxId      BIGINT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_WalletTransactions PRIMARY KEY,
    WalletId        UNIQUEIDENTIFIER NOT NULL,
    TxType          NVARCHAR(30)     NOT NULL,
        -- OrderCredit | RefundDebit | Withdrawal | Adjustment
    Amount          DECIMAL(18,2)    NOT NULL,
    BalanceAfter    DECIMAL(18,2)    NOT NULL,
    ReferenceType   NVARCHAR(40)     NULL,
    ReferenceId     UNIQUEIDENTIFIER NULL,
    Note            NVARCHAR(300)    NULL,
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_WalletTx_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_WalletTx_Wallet FOREIGN KEY (WalletId) REFERENCES dbo.Wallets (WalletId)
);
GO

/* -------------------------------------------------------------------------- */
/* 11. AI / Behavior                                                          */
/* -------------------------------------------------------------------------- */

CREATE TABLE dbo.ViewedProductHistories (
    ViewId          BIGINT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_ViewedProductHistories PRIMARY KEY,
    UserId          UNIQUEIDENTIFIER NULL,              -- null = anonymous session
    SessionId       NVARCHAR(64)     NULL,
    ProductId       UNIQUEIDENTIFIER NOT NULL,
    ViewedAt        DATETIME2(3)     NOT NULL CONSTRAINT DF_Viewed_ViewedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Viewed_User FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_Viewed_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId)
);
GO

CREATE INDEX IX_Viewed_User_ViewedAt ON dbo.ViewedProductHistories (UserId, ViewedAt DESC);
CREATE INDEX IX_Viewed_Product_ViewedAt ON dbo.ViewedProductHistories (ProductId, ViewedAt DESC);
GO

CREATE TABLE dbo.ProductRecommendations (
    RecommendationId BIGINT          NOT NULL IDENTITY(1,1) CONSTRAINT PK_ProductRecommendations PRIMARY KEY,
    UserId          UNIQUEIDENTIFIER NOT NULL,
    ProductId       UNIQUEIDENTIFIER NOT NULL,
    Score           DECIMAL(9,6)     NOT NULL,
    Strategy        NVARCHAR(40)     NOT NULL,          -- Collaborative | Content | Hybrid | Popular
    GeneratedAt     DATETIME2(3)     NOT NULL CONSTRAINT DF_Recs_GeneratedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Recs_User FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_Recs_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId)
);
GO

CREATE INDEX IX_Recs_User_Score ON dbo.ProductRecommendations (UserId, Score DESC);
GO

CREATE TABLE dbo.AiConversations (
    ConversationId  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_AiConversations PRIMARY KEY
                    CONSTRAINT DF_AiConversations_Id DEFAULT (NEWSEQUENTIALID()),
    UserId          UNIQUEIDENTIFIER NOT NULL,
    Channel         NVARCHAR(30)     NOT NULL CONSTRAINT DF_AiConversations_Channel DEFAULT (N'ShoppingAssistant'),
        -- ShoppingAssistant | Compare | NlFilter
    Title           NVARCHAR(200)    NULL,
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_AiConversations_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_AiConversations_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_AiConversations_User FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId)
);
GO

CREATE TABLE dbo.AiMessages (
    AiMessageId     BIGINT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_AiMessages PRIMARY KEY,
    ConversationId  UNIQUEIDENTIFIER NOT NULL,
    Role            NVARCHAR(20)     NOT NULL,          -- user | assistant | system
    Content         NVARCHAR(MAX)    NOT NULL,
    MetaJson        NVARCHAR(MAX)    NULL,             -- parsed filters, product ids, etc.
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_AiMessages_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_AiMessages_Conversation FOREIGN KEY (ConversationId) REFERENCES dbo.AiConversations (ConversationId) ON DELETE CASCADE,
    CONSTRAINT CK_AiMessages_Role CHECK (Role IN (N'user', N'assistant', N'system'))
);
GO

CREATE INDEX IX_AiConversations_User_UpdatedAt ON dbo.AiConversations (UserId, UpdatedAt DESC);
GO

CREATE INDEX IX_AiMessages_Conversation_CreatedAt ON dbo.AiMessages (ConversationId, CreatedAt);
GO

/* -------------------------------------------------------------------------- */
/* 12. Seed - roles + sample data (dev)                                       */
/* -------------------------------------------------------------------------- */

INSERT INTO dbo.Roles (RoleCode, RoleName, Description) VALUES
(N'BUYER',  N'Buyer',  N'Khách hàng mua sản phẩm'),
(N'SELLER', N'Seller', N'Chủ cửa hàng bán sản phẩm'),
(N'ADMIN',  N'Admin',  N'Quản trị viên hệ thống');
GO

DECLARE
    @AdminId   UNIQUEIDENTIFIER = 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
    @SellerId  UNIQUEIDENTIFIER = 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB',
    @BuyerId   UNIQUEIDENTIFIER = 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC',
    @ShopId    UNIQUEIDENTIFIER = 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD',
    @ProductId UNIQUEIDENTIFIER = 'EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE',
    @LotA      UNIQUEIDENTIFIER = 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFF1',
    @LotB      UNIQUEIDENTIFIER = 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFF2',
    @RoleAdmin INT = (SELECT RoleId FROM dbo.Roles WHERE RoleCode = N'ADMIN'),
    @RoleSeller INT = (SELECT RoleId FROM dbo.Roles WHERE RoleCode = N'SELLER'),
    @RoleBuyer INT = (SELECT RoleId FROM dbo.Roles WHERE RoleCode = N'BUYER');

INSERT INTO dbo.Users (UserId, Email, EmailConfirmed, FullName, Phone, Status)
VALUES
(@AdminId,  N'admin@aidr.local',  1, N'System Admin',   N'0900000001', N'Active'),
(@SellerId, N'seller@aidr.local', 1, N'Nguyen Van Seller', N'0900000002', N'Active'),
(@BuyerId,  N'buyer@aidr.local',  1, N'Tran Thi Buyer', N'0900000003', N'Active');

INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES
(@AdminId, @RoleAdmin),
(@SellerId, @RoleSeller),
(@SellerId, @RoleBuyer),  -- seller vẫn mua được
(@BuyerId, @RoleBuyer);

INSERT INTO dbo.Shops (
    ShopId, OwnerUserId, ShopName, Slug, Tagline, ShortDescription, Description,
    Email, Phone, Province, District, Ward, StreetAddress,
    TaxCode, CostingMethod, ReturnPolicy, ShippingPolicy, IsVerified, Status, ProductCount
)
VALUES (
    @ShopId, @SellerId,
    N'TechZone Official', N'techzone-official',
    N'Điện thoại & Laptop chính hãng',
    N'Chuyên phân phối smartphone, laptop, phụ kiện.',
    N'TechZone cung cấp thiết bị điện tử chính hãng, bảo hành đầy đủ, hỗ trợ đổi trả theo chính sách.',
    N'shop@techzone.vn', N'0900000002',
    N'Ha Noi', N'Cau Giay', N'Dich Vong', N'12 Xuan Thuy',
    N'0101234567', N'FIFO',
    N'Đổi trả trong 7 ngày nếu lỗi nhà sản xuất.',
    N'Giao hàng 1-3 ngày nội thành Hà Nội.',
    1, N'Active', 1
);

INSERT INTO dbo.Wallets (ShopId, AvailableBalance, PendingBalance)
VALUES (@ShopId, 0, 0);

/* Seller onboarding queue samples (Pending + Rejected) */
DECLARE
    @Applicant1Id UNIQUEIDENTIFIER = 'C1111111-1111-1111-1111-111111111111',
    @Applicant2Id UNIQUEIDENTIFIER = 'C2222222-2222-2222-2222-222222222222',
    @Applicant3Id UNIQUEIDENTIFIER = 'C3333333-3333-3333-3333-333333333333',
    @ReqPending1  UNIQUEIDENTIFIER = 'A1111111-1111-1111-1111-111111111111',
    @ReqPending2  UNIQUEIDENTIFIER = 'A2222222-2222-2222-2222-222222222222',
    @ReqPending3  UNIQUEIDENTIFIER = 'A4444444-4444-4444-4444-444444444444',
    @ReqRejected  UNIQUEIDENTIFIER = 'A3333333-3333-3333-3333-333333333333';

INSERT INTO dbo.Users (UserId, Email, EmailConfirmed, FullName, Phone, Status)
VALUES
(@Applicant1Id, N'applicant1@aidr.local', 1, N'Le Van Applicant', N'0911000001', N'Active'),
(@Applicant2Id, N'applicant2@aidr.local', 1, N'Pham Thi Applicant', N'0911000002', N'Active'),
(@Applicant3Id, N'applicant3@aidr.local', 1, N'Hoang Rejected Applicant', N'0911000003', N'Active');

INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES
(@Applicant1Id, @RoleBuyer),
(@Applicant2Id, @RoleBuyer),
(@Applicant3Id, @RoleBuyer);

INSERT INTO dbo.SellerRegistrationRequests (
    RequestId, UserId, ShopName, BusinessInfo, DocumentUrls, Status, CreatedAt
)
VALUES
(
    @ReqPending1, @BuyerId,
    N'Green Mart Home',
    N'Household goods and kitchenware. Warehouse in District 7, HCMC.',
    N'["https://res.cloudinary.com/demo/image/upload/sample.jpg"]',
    N'Pending', DATEADD(DAY, -2, SYSUTCDATETIME())
),
(
    @ReqPending2, @Applicant1Id,
    N'Sportify Gear',
    N'Sports apparel and fitness accessories. Looking to sell nationwide.',
    N'["https://res.cloudinary.com/demo/image/upload/docs/license-sample.pdf","https://res.cloudinary.com/demo/image/upload/sample.jpg"]',
    N'Pending', DATEADD(HOUR, -8, SYSUTCDATETIME())
),
(
    @ReqPending3, @Applicant2Id,
    N'Book Corner VN',
    N'New and used books, educational materials for students.',
    NULL,
    N'Pending', DATEADD(HOUR, -1, SYSUTCDATETIME())
);

INSERT INTO dbo.SellerRegistrationRequests (
    RequestId, UserId, ShopName, BusinessInfo, DocumentUrls, Status,
    AdminNote, ReviewedBy, ReviewedAt, CreatedAt
)
VALUES (
    @ReqRejected, @Applicant3Id,
    N'Suspicious Gadgets',
    N'Import electronics without clear warranty policy.',
    N'["https://res.cloudinary.com/demo/image/upload/sample.jpg"]',
    N'Rejected',
    N'Documents incomplete and business address could not be verified.',
    @AdminId,
    DATEADD(DAY, -1, SYSUTCDATETIME()),
    DATEADD(DAY, -3, SYSUTCDATETIME())
);

INSERT INTO dbo.Categories (Name, Slug, Description, SortOrder, IsActive)
VALUES
(N'Điện thoại', N'dien-thoai', N'Smartphone các hãng', 1, 1),
(N'Laptop', N'laptop', N'Máy tính xách tay', 2, 1),
(N'Phụ kiện', N'phu-kien', N'Sạc, ốp, tai nghe...', 3, 1);

DECLARE @CatPhone INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'dien-thoai');

/*
  Ví dụ nghiệp vụ giá nhập / giá bán:
  - Lô A: nhập 10 máy @ 10.000.000 (tháng 1)
  - Đăng bán BasePrice = 11.000.000
  - Lô B: nhập thêm 5 máy @ 12.000.000 (tháng 3) - KHÔNG sửa UnitCost lô A
  - Có thể tăng BasePrice lên 12.500.000 → ghi ProductPriceHistories
  - Tồn = 10 + 5 = 15; AvgCost = (10*10tr + 5*12tr)/15 = 10.666.667
*/
INSERT INTO dbo.Products (
    ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
    Brand, ModelNumber, Sku, ConditionType,
    BasePrice, SalePrice, LastCostPrice, AvgCostPrice,
    StockQuantity, WarrantyMonths, OriginCountry,
    SpecsJson, TagsJson, Status, PublishedAt
)
VALUES (
    @ProductId, @ShopId, @CatPhone,
    N'Samsung Galaxy S24 256GB', N'samsung-galaxy-s24-256gb',
    N'Flagship Samsung, màn 6.2", chip Snapdragon 8 Gen 3',
    N'Mô tả chi tiết Galaxy S24: camera AI, pin 4000mAh, IP68...',
    N'Samsung', N'SM-S921B', N'TZ-S24-256', N'New',
    11000000, NULL, 12000000, 10666666.67,
    15, 12, N'Viet Nam',
    N'{"ram":"8GB","storage":"256GB","screen":"6.2"}',
    N'["flagship","samsung","5g"]',
    N'Approved', SYSUTCDATETIME()
);

INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary)
VALUES (@ProductId, N'https://res.cloudinary.com/demo/image/upload/s24.jpg', 0, 1);

INSERT INTO dbo.InventoryLots (
    LotId, ProductId, LotCode, QuantityReceived, QuantityRemaining,
    UnitCost, SupplierName, InvoiceNumber, ReceivedAt, Status, CreatedBy, Note
)
VALUES
(@LotA, @ProductId, N'LOT-20260110-001', 10, 10, 10000000,
 N'NCC Samsung VN', N'INV-A-001', '2026-01-10', N'Open', @SellerId,
 N'Lô nhập đầu - giá vốn 10tr/máy'),
(@LotB, @ProductId, N'LOT-20260301-002', 5, 5, 12000000,
 N'NCC Samsung VN', N'INV-B-002', '2026-03-01', N'Open', @SellerId,
 N'Lô sau - giá vốn tăng lên 12tr/máy');

INSERT INTO dbo.InventoryTransactions (ProductId, LotId, ChangeQty, UnitCost, Reason, ReferenceType, ReferenceId, CreatedBy, Note)
VALUES
(@ProductId, @LotA, 10, 10000000, N'StockIn', N'Lot', @LotA, @SellerId, N'Nhập lô A'),
(@ProductId, @LotB, 5, 12000000, N'StockIn', N'Lot', @LotB, @SellerId, N'Nhập lô B');

-- Giả sử sau đó seller tăng giá bán 11tr → 12.5tr
INSERT INTO dbo.ProductPriceHistories (ProductId, OldBasePrice, NewBasePrice, ChangedBy, Reason)
VALUES (@ProductId, 11000000, 12500000, @SellerId, N'Điều chỉnh theo giá vốn lô mới');

UPDATE dbo.Products SET BasePrice = 12500000, UpdatedAt = SYSUTCDATETIME()
WHERE ProductId = @ProductId;

INSERT INTO dbo.Addresses (UserId, ReceiverName, Phone, Province, District, Ward, StreetAddress, IsDefault)
VALUES (@BuyerId, N'Tran Thi Buyer', N'0900000003', N'Ha Noi', N'Dong Da', N'Cat Linh', N'25 Cat Linh', 1);

PRINT N'Seed sample data inserted (admin/seller/buyer + 1 product with 2 cost lots).';
GO

/* -------------------------------------------------------------------------- */
/* 13. Useful views                                                           */
/* -------------------------------------------------------------------------- */

CREATE OR ALTER VIEW dbo.vw_SellerSalesSummary
AS
SELECT
    o.ShopId,
    CAST(o.CreatedAt AS DATE) AS SaleDate,
    COUNT(*) AS OrderCount,
    SUM(CASE WHEN o.Status IN (N'Completed', N'Delivered', N'Paid', N'Confirmed', N'Shipping') THEN o.TotalAmount ELSE 0 END) AS GrossSales
FROM dbo.Orders o
GROUP BY o.ShopId, CAST(o.CreatedAt AS DATE);
GO

CREATE OR ALTER VIEW dbo.vw_ProductStockByLot
AS
SELECT
    p.ProductId,
    p.Name AS ProductName,
    p.BasePrice AS SellingPrice,
    p.SalePrice,
    p.AvgCostPrice,
    p.StockQuantity AS StockOnHand,
    l.LotId,
    l.LotCode,
    l.UnitCost AS LotUnitCost,
    l.QuantityRemaining,
    l.ReceivedAt,
    l.Status AS LotStatus,
    /* Ước tính lãi / đơn vị nếu bán đúng BasePrice từ lô này */
    (COALESCE(p.SalePrice, p.BasePrice) - l.UnitCost) AS EstMarginPerUnit
FROM dbo.Products p
INNER JOIN dbo.InventoryLots l ON l.ProductId = p.ProductId
WHERE l.Status = N'Open';
GO

PRINT N'AIDR database schema created successfully.';
GO

/*
================================================================================
  ERD (Mermaid) - copy vào docs / Notion / GitHub preview
================================================================================

```mermaid
erDiagram
    Users ||--o{ UserRoles : has
    Roles ||--o{ UserRoles : grants
    Users ||--o| Shops : owns
    Users ||--o{ Addresses : has
    Shops ||--o{ Products : sells
    Categories ||--o{ Products : classifies
    Products ||--o{ ProductImages : has
    Products ||--o{ ProductVariants : has
    Products ||--o{ InventoryLots : stocked_as
    Products ||--o{ ProductPriceHistories : price_changes
    Products ||--o{ InventoryTransactions : movements
    InventoryLots ||--o{ InventoryTransactions : logs
    InventoryLots ||--o{ OrderItemLotAllocations : consumed_by
    Users ||--o| Carts : has
    Carts ||--o{ CartItems : contains
    Products ||--o{ CartItems : in
    Users ||--o{ Orders : places
    Shops ||--o{ Orders : fulfills
    Orders ||--o{ OrderItems : lines
    OrderItems ||--o{ OrderItemLotAllocations : allocates
    Products ||--o{ OrderItems : sold_as
    Orders ||--o{ Payments : paid_by
    Orders ||--o{ ReturnRequests : may_have
    ReturnRequests ||--o{ ReturnEvidences : evidences
    ReturnRequests ||--o{ ReturnRequestItems : lines
    Shops ||--o| Wallets : has
    Wallets ||--o{ WalletTransactions : ledger
    Products ||--o{ ProductReviews : reviewed
    Shops ||--o{ SellerFollows : followed
    Users ||--o{ SellerFollows : follows
    Users ||--o{ ChatThreads : chats
    Shops ||--o{ ChatThreads : chats
    ChatThreads ||--o{ ChatMessages : messages
    Users ||--o{ Notifications : receives
    Shops ||--o{ Vouchers : shop_vouchers
    Vouchers ||--o{ VoucherRedemptions : redeemed

    Users {
        uniqueidentifier UserId PK
        nvarchar Email
        nvarchar Status
    }
    Shops {
        uniqueidentifier ShopId PK
        nvarchar ShopName
        nvarchar CostingMethod
    }
    Products {
        uniqueidentifier ProductId PK
        decimal BasePrice
        decimal SalePrice
        decimal AvgCostPrice
        int StockQuantity
    }
    InventoryLots {
        uniqueidentifier LotId PK
        nvarchar LotCode
        decimal UnitCost
        int QuantityRemaining
        datetime2 ReceivedAt
    }
    OrderItems {
        uniqueidentifier OrderItemId PK
        decimal UnitPrice
        decimal UnitCostAvg
        int Quantity
    }
    OrderItemLotAllocations {
        uniqueidentifier AllocationId PK
        int Quantity
        decimal UnitCostSnapshot
    }
    ProductPriceHistories {
        bigint PriceHistoryId PK
        decimal OldBasePrice
        decimal NewBasePrice
    }
```

  Ví dụ FIFO khi bán 12 máy (BasePrice hiện 12.5tr):
  - Trừ 10 từ LotA @ 10tr + 2 từ LotB @ 12tr
  - OrderItem.UnitPrice = 12.500.000
  - OrderItem.UnitCostAvg = (10*10tr + 2*12tr)/12 = 10.333.333
  - Gross margin dòng ≈ 12.5tr - 10.333tr = 2.167tr / máy
================================================================================
*/
