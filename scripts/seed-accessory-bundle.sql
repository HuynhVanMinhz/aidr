/*
  seed-accessory-bundle.sql - phone + accessory products in the same shop for bundle testing.

  Prerequisites: demo seller/shop + category hierarchy seeds.
  Idempotent by fixed product GUIDs.
*/

SET NOCOUNT ON;

DECLARE
    @ShopId UNIQUEIDENTIFIER = (SELECT TOP 1 ShopId FROM dbo.Shops WHERE Status = N'Active' ORDER BY CreatedAt),
    @SellerId UNIQUEIDENTIFIER,
    @CatPhone INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'dien-thoai'),
    @CatCase INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'phu-kien-op'),
    @CatCharger INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'phu-kien-sac'),
    @CatEarbuds INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'phu-kien-tai-nghe'),
    @PhoneId UNIQUEIDENTIFIER = N'F1111111-1111-1111-1111-111111111101',
    @CaseId UNIQUEIDENTIFIER = N'F1111111-1111-1111-1111-111111111102',
    @ChargerId UNIQUEIDENTIFIER = N'F1111111-1111-1111-1111-111111111103',
    @EarbudsId UNIQUEIDENTIFIER = N'F1111111-1111-1111-1111-111111111104',
    @Now DATETIME2(3) = SYSUTCDATETIME();

IF @ShopId IS NULL OR @CatPhone IS NULL
BEGIN
    PRINT N'seed-accessory-bundle: skipped - missing shop or phone category.';
    RETURN;
END;

SELECT @SellerId = OwnerUserId FROM dbo.Shops WHERE ShopId = @ShopId;

IF @CatCase IS NULL SET @CatCase = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'phu-kien');
IF @CatCharger IS NULL SET @CatCharger = @CatCase;
IF @CatEarbuds IS NULL SET @CatEarbuds = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'am-thanh');

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @PhoneId)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, ConditionType, BasePrice, SalePrice, Currency,
        StockQuantity, ReservedQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount, IsFeatured, CreatedAt, UpdatedAt
    ) VALUES (
        @PhoneId, @ShopId, @CatPhone,
        N'Bundle Demo Phone X1', N'bundle-demo-phone-x1',
        N'512GB flagship phone for bundle demo.',
        N'Demo smartphone used to test accessory bundle recommendations.',
        N'DemoBrand', N'X1-512', N'New', 15990000, 14990000, N'VND',
        25, 0, 12, N'Vietnam',
        N'{"ram":"12GB","storage":"512GB","screen":"6.7","battery":"5000mAh","charging":"45W"}',
        N'["BUNDLE-DEMO"]',
        N'Approved', @Now, 4.50, 8, 42, 0, 1, @Now, @Now
    );
END
ELSE
BEGIN
    UPDATE dbo.Products
    SET Status = N'Approved', StockQuantity = 25, ReservedQuantity = 0, ShopId = @ShopId, CategoryId = @CatPhone, UpdatedAt = @Now
    WHERE ProductId = @PhoneId;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @CaseId)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, ConditionType, BasePrice, Currency,
        StockQuantity, ReservedQuantity, WarrantyMonths, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, CreatedAt, UpdatedAt
    ) VALUES (
        @CaseId, @ShopId, @CatCase,
        N'Bundle Demo Clear Case X1', N'bundle-demo-case-x1',
        N'TPU case for Bundle Demo Phone X1.',
        N'Protective clear case matched to the demo phone model.',
        N'DemoBrand', N'CASE-X1', N'New', 290000, N'VND',
        50, 0, 3,
        N'{"model":"X1","compatible_models":["X1","X1 Pro"]}',
        N'["BUNDLE-DEMO"]',
        N'Approved', @Now, 4.20, 5, 18, @Now, @Now
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @ChargerId)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, ConditionType, BasePrice, Currency,
        StockQuantity, ReservedQuantity, WarrantyMonths, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, CreatedAt, UpdatedAt
    ) VALUES (
        @ChargerId, @ShopId, @CatCharger,
        N'Bundle Demo 45W GaN Charger', N'bundle-demo-gan-charger-45w',
        N'USB-C PD charger for fast phone charging.',
        N'Compact GaN charger with USB-C PD support.',
        N'DemoBrand', N'CHG-45W', N'New', 490000, N'VND',
        40, 0, 6,
        N'{"max_watt":"45W","connector":"USB-C"}',
        N'["BUNDLE-DEMO"]',
        N'Approved', @Now, 4.60, 12, 31, @Now, @Now
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @EarbudsId)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, ConditionType, BasePrice, SalePrice, Currency,
        StockQuantity, ReservedQuantity, WarrantyMonths, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, CreatedAt, UpdatedAt
    ) VALUES (
        @EarbudsId, @ShopId, @CatEarbuds,
        N'Bundle Demo Wireless Earbuds', N'bundle-demo-wireless-earbuds',
        N'ANC earbuds to complete your phone setup.',
        N'Lightweight wireless earbuds with active noise cancellation.',
        N'DemoBrand', N'BUDS-A1', N'New', 1290000, 1190000, N'VND',
        30, 0, 12,
        N'{"connectivity":"Bluetooth 5.3","battery":"30h case"}',
        N'["BUNDLE-DEMO"]',
        N'Approved', @Now, 4.40, 9, 22, @Now, @Now
    );
END;

PRINT N'seed-accessory-bundle: demo phone + accessories ready.';
GO
