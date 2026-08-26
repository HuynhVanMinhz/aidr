/*
  AIDR — Extended catalog demo seed
  Chạy trên DB đã có schema + seed cơ bản từ database.sql.
  Idempotent: bỏ qua nếu slug sản phẩm đã tồn tại.
*/

SET NOCOUNT ON;

DECLARE
    @ShopId    UNIQUEIDENTIFIER,
    @SellerId  UNIQUEIDENTIFIER = 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB',
    @BuyerId   UNIQUEIDENTIFIER = 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC',
    @ProductS24 UNIQUEIDENTIFIER = 'EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE',
    @CatPhone  INT,
    @CatLaptop INT,
    @CatAccess INT,
    @RoleSeller INT,
    @RoleBuyer INT;

SELECT @RoleSeller = RoleId FROM dbo.Roles WHERE RoleCode = N'SELLER';
SELECT @RoleBuyer = RoleId FROM dbo.Roles WHERE RoleCode = N'BUYER';

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @SellerId)
BEGIN
    INSERT INTO dbo.Users (UserId, Email, EmailConfirmed, FullName, Phone, Status)
    VALUES (@SellerId, N'seller@aidr.local', 1, N'Alex Seller', N'0900000002', N'Active');
    IF @RoleSeller IS NOT NULL
        INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@SellerId, @RoleSeller);
    IF @RoleBuyer IS NOT NULL
        INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@SellerId, @RoleBuyer);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @BuyerId)
BEGIN
    INSERT INTO dbo.Users (UserId, Email, EmailConfirmed, FullName, Phone, Status)
    VALUES (@BuyerId, N'buyer@aidr.local', 1, N'Jamie Buyer', N'0900000003', N'Active');
    IF @RoleBuyer IS NOT NULL
        INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@BuyerId, @RoleBuyer);
END;

SELECT TOP (1) @ShopId = ShopId FROM dbo.Shops WHERE Status = N'Active' ORDER BY CreatedAt;

IF @ShopId IS NULL
BEGIN
    SET @ShopId = 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD';
    INSERT INTO dbo.Shops (
        ShopId, OwnerUserId, ShopName, Slug, Tagline, ShortDescription, Description,
        Email, Phone, Province, District, Ward, StreetAddress,
        TaxCode, CostingMethod, ReturnPolicy, ShippingPolicy, IsVerified, Status, ProductCount
    ) VALUES (
        @ShopId, @SellerId,
        N'TechZone Official', N'techzone-official',
        N'Authentic phones, laptops and gadgets',
        N'Authorized electronics retailer for smartphones, laptops, audio and accessories.',
        N'TechZone Official stocks genuine electronics with manufacturer warranty, fast delivery, and transparent pricing.',
        N'shop@techzone.vn', N'0900000002',
        N'Ha Noi', N'Cau Giay', N'Dich Vong', N'12 Xuan Thuy',
        N'0101234567', N'FIFO',
        N'7-day return for manufacturer defects with original box and invoice.',
        N'Shipping 1-3 days in Hanoi metro; 2-5 days nationwide.',
        1, N'Active', 0
    );
    IF NOT EXISTS (SELECT 1 FROM dbo.Wallets WHERE ShopId = @ShopId)
        INSERT INTO dbo.Wallets (ShopId, AvailableBalance, PendingBalance) VALUES (@ShopId, 0, 0);
END
ELSE
    SELECT TOP (1) @SellerId = OwnerUserId FROM dbo.Shops WHERE ShopId = @ShopId;

SELECT @CatPhone = CategoryId FROM dbo.Categories WHERE Slug = N'dien-thoai';
SELECT @CatLaptop = CategoryId FROM dbo.Categories WHERE Slug = N'laptop';
SELECT @CatAccess = CategoryId FROM dbo.Categories WHERE Slug = N'phu-kien';

IF @CatPhone IS NULL
BEGIN
    INSERT INTO dbo.Categories (Name, Slug, Description, SortOrder, IsActive)
    VALUES (N'Phones', N'dien-thoai', N'Smartphones from major brands', 1, 1);
    SELECT @CatPhone = SCOPE_IDENTITY();
END;

IF @CatLaptop IS NULL
BEGIN
    INSERT INTO dbo.Categories (Name, Slug, Description, SortOrder, IsActive)
    VALUES (N'Laptop', N'laptop', N'Notebooks for work, study and creation', 2, 1);
    SELECT @CatLaptop = SCOPE_IDENTITY();
END;

IF @CatAccess IS NULL
BEGIN
    INSERT INTO dbo.Categories (Name, Slug, Description, SortOrder, IsActive)
    VALUES (N'Accessories', N'phu-kien', N'Chargers, cases, cables and more', 3, 1);
    SELECT @CatAccess = SCOPE_IDENTITY();
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE Slug = N'samsung-galaxy-s24-256gb' AND ShopId = @ShopId)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount, IsFeatured
    ) VALUES (
        @ProductS24, @ShopId, @CatPhone,
        N'Samsung Galaxy S24 256GB', N'samsung-galaxy-s24-256gb',
        N'Flagship Samsung, 6.2" display, Snapdragon 8 Gen 3',
        N'Galaxy S24 with AI camera features, IP68 rating, and all-day battery. Official Samsung warranty.',
        N'Samsung', N'SM-S921B', N'TZ-S24-256', N'New',
        12500000, 11990000, 15, 12, N'Vietnam',
        N'{"ram":"8GB","storage":"256GB","screen":"6.2"}', N'["flagship","samsung","5g"]',
        N'Approved', SYSUTCDATETIME(), 4.70, 10, 35, 500, 1
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary)
    VALUES (@ProductS24, N'/theme/images/product-image-1.png', 0, 1);
END;

UPDATE dbo.Categories SET ImageUrl = N'/theme/images/category-item-image-1.png' WHERE Slug = N'dien-thoai' AND (ImageUrl IS NULL OR ImageUrl = N'');
UPDATE dbo.Categories SET ImageUrl = N'/theme/images/category-item-image-1.png' WHERE Slug = N'laptop' AND (ImageUrl IS NULL OR ImageUrl = N'');
UPDATE dbo.Categories SET ImageUrl = N'/theme/images/category-item-image-1.png' WHERE Slug = N'phu-kien' AND (ImageUrl IS NULL OR ImageUrl = N'');

/* ---- Products (Approved) ---- */
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE Slug = N'iphone-15-128gb' AND ShopId = @ShopId)
BEGIN
    DECLARE @P1 UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111101';
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount, IsFeatured
    ) VALUES (
        @P1, @ShopId, @CatPhone,
        N'iPhone 15 128GB', N'iphone-15-128gb',
        N'Apple A16 Bionic, Dynamic Island, 48MP camera',
        N'iPhone 15 with USB-C, 5G, and a bright Super Retina XDR display. Genuine Apple warranty.',
        N'Apple', N'A2846', N'TZ-IP15-128', N'New',
        21990000, 20990000, 25, 12, N'USA',
        N'{"ram":"6GB","storage":"128GB","screen":"6.1"}', N'["apple","iphone","5g"]',
        N'Approved', DATEADD(DAY, -5, SYSUTCDATETIME()), 4.80, 12, 48, 320, 1
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary) VALUES
    (@P1, N'/theme/images/product-image-1.png', 0, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE Slug = N'xiaomi-14-256gb' AND ShopId = @ShopId)
BEGIN
    DECLARE @P2 UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111102';
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount
    ) VALUES (
        @P2, @ShopId, @CatPhone,
        N'Xiaomi 14 256GB', N'xiaomi-14-256gb',
        N'Leica camera, Snapdragon 8 Gen 3, 90W charging',
        N'Xiaomi 14 flagship with Leica optics and a smooth 120Hz AMOLED panel.',
        N'Xiaomi', N'23127PN0CC', N'TZ-X14-256', N'New',
        17990000, NULL, 18, 12, N'China',
        N'{"ram":"12GB","storage":"256GB","screen":"6.36"}', N'["xiaomi","leica","5g"]',
        N'Approved', DATEADD(DAY, -3, SYSUTCDATETIME()), 4.60, 8, 22, 180
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary) VALUES
    (@P2, N'/theme/images/product-image-1.png', 0, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE Slug = N'macbook-air-m3-13' AND ShopId = @ShopId)
BEGIN
    DECLARE @P3 UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111103';
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount, IsFeatured
    ) VALUES (
        @P3, @ShopId, @CatLaptop,
        N'MacBook Air M3 13 inch', N'macbook-air-m3-13',
        N'Apple M3, 16GB RAM, 512GB SSD',
        N'MacBook Air 13-inch — thin, silent, and all-day battery for work and study.',
        N'Apple', N'MRXN3', N'TZ-MBA-M3', N'New',
        28990000, 27990000, 10, 12, N'USA',
        N'{"ram":"16GB","storage":"512GB","screen":"13.6"}', N'["apple","laptop","m3"]',
        N'Approved', DATEADD(DAY, -7, SYSUTCDATETIME()), 4.90, 15, 31, 410, 1
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary) VALUES
    (@P3, N'/theme/images/product-image-1.png', 0, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE Slug = N'asus-vivobook-15-oled' AND ShopId = @ShopId)
BEGIN
    DECLARE @P4 UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111104';
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount
    ) VALUES (
        @P4, @ShopId, @CatLaptop,
        N'ASUS Vivobook 15 OLED', N'asus-vivobook-15-oled',
        N'Ryzen 7, 16GB RAM, 512GB SSD, OLED display',
        N'ASUS Vivobook 15 OLED for students and office work with vivid colors.',
        N'ASUS', N'M1502YA', N'TZ-VB15', N'New',
        15990000, 14990000, 14, 24, N'China',
        N'{"ram":"16GB","storage":"512GB","screen":"15.6 OLED"}', N'["asus","laptop","oled"]',
        N'Approved', DATEADD(DAY, -2, SYSUTCDATETIME()), 4.50, 6, 19, 95
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary) VALUES
    (@P4, N'/theme/images/product-image-1.png', 0, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE Slug = N'dell-xps-15-9530' AND ShopId = @ShopId)
BEGIN
    DECLARE @P5 UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111105';
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount
    ) VALUES (
        @P5, @ShopId, @CatLaptop,
        N'Dell XPS 15 9530', N'dell-xps-15-9530',
        N'Intel Core i7, 32GB RAM, RTX 4050, 3.5K OLED',
        N'Dell XPS 15 creator laptop for developers and content creators.',
        N'Dell', N'XPS9530', N'TZ-XPS15', N'New',
        45990000, NULL, 6, 24, N'USA',
        N'{"ram":"32GB","storage":"1TB","gpu":"RTX 4050"}', N'["dell","xps","creator"]',
        N'Approved', DATEADD(DAY, -10, SYSUTCDATETIME()), 4.70, 4, 8, 220
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary) VALUES
    (@P5, N'/theme/images/product-image-1.png', 0, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE Slug = N'airpods-pro-2' AND ShopId = @ShopId)
BEGIN
    DECLARE @P6 UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111106';
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount, IsFeatured
    ) VALUES (
        @P6, @ShopId, @CatAccess,
        N'AirPods Pro (2nd gen)', N'airpods-pro-2',
        N'Active Noise Cancellation, USB-C, Spatial Audio',
        N'Apple AirPods Pro (2nd gen) true wireless earbuds with Adaptive Audio.',
        N'Apple', N'MTJV3', N'TZ-APP2', N'New',
        5990000, 5490000, 40, 12, N'USA',
        N'{"type":"TWS","anc":"yes","codec":"AAC"}', N'["apple","audio","tws"]',
        N'Approved', DATEADD(DAY, -1, SYSUTCDATETIME()), 4.85, 20, 85, 560, 1
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary) VALUES
    (@P6, N'/theme/images/product-image-1.png', 0, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE Slug = N'sony-wh-1000xm5' AND ShopId = @ShopId)
BEGIN
    DECLARE @P7 UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111107';
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount
    ) VALUES (
        @P7, @ShopId, @CatAccess,
        N'Sony WH-1000XM5', N'sony-wh-1000xm5',
        N'Industry-leading ANC, 30h battery, LDAC',
        N'Sony WH-1000XM5 over-ear headphones for travel and critical listening.',
        N'Sony', N'WH1000XM5', N'TZ-SONY-XM5', N'New',
        7490000, 6990000, 22, 12, N'Malaysia',
        N'{"type":"Over-ear","anc":"yes","battery":"30h"}', N'["sony","headphone","anc"]',
        N'Approved', DATEADD(DAY, -4, SYSUTCDATETIME()), 4.75, 18, 42, 390
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary) VALUES
    (@P7, N'/theme/images/product-image-1.png', 0, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE Slug = N'anker-735-gan-charger' AND ShopId = @ShopId)
BEGIN
    DECLARE @P8 UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111108';
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount
    ) VALUES (
        @P8, @ShopId, @CatAccess,
        N'Anker 735 GaN Charger 65W', N'anker-735-gan-charger',
        N'65W GaN II charger with 3 ports',
        N'Anker 735 compact GaN charger for phones, tablets, and thin laptops.',
        N'Anker', N'A2667', N'TZ-ANK-65W', N'New',
        890000, NULL, 55, 18, N'China',
        N'{"power":"65W","ports":"3","gan":"yes"}', N'["anker","charger","gan"]',
        N'Approved', DATEADD(DAY, -6, SYSUTCDATETIME()), 4.40, 9, 120, 150
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary) VALUES
    (@P8, N'/theme/images/product-image-1.png', 0, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE Slug = N'samsung-galaxy-watch-6' AND ShopId = @ShopId)
BEGIN
    DECLARE @P9 UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111109';
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount
    ) VALUES (
        @P9, @ShopId, @CatAccess,
        N'Samsung Galaxy Watch 6 44mm', N'samsung-galaxy-watch-6',
        N'Wear OS, health tracking, built-in GPS',
        N'Samsung Galaxy Watch 6 44mm smartwatch for Android users.',
        N'Samsung', N'SM-R940', N'TZ-GW6', N'New',
        6990000, 6490000, 20, 12, N'Vietnam',
        N'{"size":"44mm","gps":"yes","os":"Wear OS"}', N'["samsung","watch","wearable"]',
        N'Approved', DATEADD(DAY, -8, SYSUTCDATETIME()), 4.55, 7, 25, 210
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary) VALUES
    (@P9, N'/theme/images/product-image-1.png', 0, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE Slug = N'ipad-air-m2-128gb' AND ShopId = @ShopId)
BEGIN
    DECLARE @P10 UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111110';
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount
    ) VALUES (
        @P10, @ShopId, @CatLaptop,
        N'iPad Air M2 11 inch 128GB', N'ipad-air-m2-128gb',
        N'Apple M2, Liquid Retina, Apple Pencil support',
        N'iPad Air 11-inch with M2 — ideal for notes, drawing, and streaming.',
        N'Apple', N'MUWD3', N'TZ-IPAD-AIR', N'New',
        16990000, NULL, 12, 12, N'USA',
        N'{"chip":"M2","storage":"128GB","screen":"11"}', N'["apple","tablet","m2"]',
        N'Approved', DATEADD(DAY, -9, SYSUTCDATETIME()), 4.65, 5, 14, 175
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary) VALUES
    (@P10, N'/theme/images/product-image-1.png', 0, 1);
END;

/* Cập nhật S24 seed gốc — thêm ảnh theme + metrics */
DECLARE @S24 UNIQUEIDENTIFIER = (SELECT TOP (1) ProductId FROM dbo.Products WHERE Slug = N'samsung-galaxy-s24-256gb' ORDER BY CreatedAt);
IF @S24 IS NOT NULL
BEGIN
    UPDATE dbo.Products SET
        IsFeatured = 1,
        AvgRating = 4.70,
        ReviewCount = 10,
        SoldCount = 35,
        ViewCount = 500,
        SalePrice = 11990000
    WHERE ProductId = @S24;

    IF NOT EXISTS (SELECT 1 FROM dbo.ProductImages WHERE ProductId = @S24)
        INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary)
        VALUES (@S24, N'/theme/images/product-image-1.png', 0, 1);
    ELSE
        UPDATE dbo.ProductImages SET ImageUrl = N'/theme/images/product-image-1.png'
        WHERE ProductId = @S24 AND IsPrimary = 1;

    IF @BuyerId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.ProductReviews WHERE ProductId = @S24 AND BuyerUserId = @BuyerId)
    BEGIN
        INSERT INTO dbo.ProductReviews (ProductId, BuyerUserId, Rating, Title, Content, IsVisible, CreatedAt, UpdatedAt)
        VALUES
        (@S24, @BuyerId, 5, N'Very satisfied', N'Brand-new device, solid battery life, and fast delivery.', 1, DATEADD(DAY, -2, SYSUTCDATETIME()), DATEADD(DAY, -2, SYSUTCDATETIME()));
    END;
END;

IF EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = '11111111-1111-1111-1111-111111111106')
AND NOT EXISTS (SELECT 1 FROM dbo.ProductReviews WHERE ProductId = '11111111-1111-1111-1111-111111111106')
BEGIN
    INSERT INTO dbo.ProductReviews (ProductId, BuyerUserId, Rating, Title, Content, IsVisible, CreatedAt, UpdatedAt)
    VALUES
    ('11111111-1111-1111-1111-111111111106', @BuyerId, 5, N'Excellent ANC', N'Comfortable fit and strong noise cancellation on flights.', 1, DATEADD(DAY, -1, SYSUTCDATETIME()), DATEADD(DAY, -1, SYSUTCDATETIME()));
END;

UPDATE dbo.Shops SET ProductCount = (
    SELECT COUNT(*) FROM dbo.Products p WHERE p.ShopId = @ShopId AND p.Status = N'Approved'
), UpdatedAt = SYSUTCDATETIME()
WHERE ShopId = @ShopId;

PRINT N'Catalog demo seed completed.';
GO


