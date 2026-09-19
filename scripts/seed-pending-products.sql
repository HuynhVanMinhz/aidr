/*
  AIDR - Pending products for Admin Product Moderation queue (UC-18..21)
  Requires: demo accounts + categories (or catalog seed).
  Idempotent by product slug.
*/

SET NOCOUNT ON;

DECLARE
    @ShopId    UNIQUEIDENTIFIER = 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD',
    @SellerId  UNIQUEIDENTIFIER = 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB',
    @CatPhone  INT,
    @CatLaptop INT,
    @CatAccess INT,
    @P1 UNIQUEIDENTIFIER = 'F1111111-1111-1111-1111-111111111111',
    @P2 UNIQUEIDENTIFIER = 'F2222222-2222-2222-2222-222222222222',
    @P3 UNIQUEIDENTIFIER = 'F3333333-3333-3333-3333-333333333333',
    @P4 UNIQUEIDENTIFIER = 'F4444444-4444-4444-4444-444444444444',
    @P5 UNIQUEIDENTIFIER = 'F5555555-5555-5555-5555-555555555555';

IF NOT EXISTS (SELECT 1 FROM dbo.Shops WHERE ShopId = @ShopId)
    SELECT TOP (1) @ShopId = ShopId FROM dbo.Shops WHERE Status = N'Active' ORDER BY CreatedAt;

IF @ShopId IS NULL
BEGIN
    RAISERROR(N'Demo shop missing. Run seed-demo-accounts / seed-catalog first.', 16, 1);
    RETURN;
END;

SELECT @CatPhone = CategoryId FROM dbo.Categories WHERE Slug = N'dien-thoai';
SELECT @CatLaptop = CategoryId FROM dbo.Categories WHERE Slug = N'laptop';
SELECT @CatAccess = CategoryId FROM dbo.Categories WHERE Slug = N'phu-kien';

IF @CatPhone IS NULL SELECT TOP (1) @CatPhone = CategoryId FROM dbo.Categories WHERE IsActive = 1 ORDER BY SortOrder;
IF @CatLaptop IS NULL SET @CatLaptop = @CatPhone;
IF @CatAccess IS NULL SET @CatAccess = @CatPhone;

IF @CatPhone IS NULL
BEGIN
    RAISERROR(N'No categories. Run seed-categories first.', 16, 1);
    RETURN;
END;

/* Pending queue samples */
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @P1)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, ConditionType, BasePrice, SalePrice, Currency,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson, Status
    ) VALUES (
        @P1, @ShopId, @CatPhone,
        N'Xiaomi 14T Pro Pending Review', N'xiaomi-14t-pro-pending',
        N'Awaiting admin moderation - sample pending phone.',
        N'Demo product for UC-18..20 Approve/Reject flow.',
        N'Xiaomi', N'2407FPN8EG', N'New', 12990000, 12490000, 'VND',
        8, 12, N'China',
        N'{"ram":"12GB","storage":"512GB"}', N'["pending","moderation"]', N'Pending'
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary)
    VALUES (@P1, N'/theme/images/product-image-1.png', 0, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @P2)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, ConditionType, BasePrice, SalePrice, Currency,
        StockQuantity, WarrantyMonths, OriginCountry, Status
    ) VALUES (
        @P2, @ShopId, @CatLaptop,
        N'ASUS Vivobook 15 Pending', N'asus-vivobook-15-pending',
        N'Laptop listing waiting for approval.',
        N'Demo pending laptop for moderation queue.',
        N'ASUS', N'X1504VA', N'New', 15990000, NULL, 'VND',
        5, 24, N'Vietnam', N'Pending'
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary)
    VALUES (@P2, N'/theme/images/product-image-1.png', 0, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @P3)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ConditionType, BasePrice, Currency, StockQuantity, Status
    ) VALUES (
        @P3, @ShopId, @CatAccess,
        N'Sony WH-1000XM5 Pending', N'sony-wh-1000xm5-pending',
        N'Incomplete specs - useful for Reject with reason.',
        N'Demo pending accessory.',
        N'Sony', N'New', 8990000, 'VND', 12, N'Pending'
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary)
    VALUES (@P3, N'/theme/images/product-image-1.png', 0, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @P4)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ConditionType, BasePrice, SalePrice, Currency, StockQuantity, Status
    ) VALUES (
        @P4, @ShopId, @CatPhone,
        N'OPPO Reno12 Pending', N'oppo-reno12-pending',
        N'Another pending phone in the queue.',
        N'Demo pending phone #2.',
        N'OPPO', N'New', 9990000, 9490000, 'VND', 10, N'Pending'
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary)
    VALUES (@P4, N'/theme/images/product-image-1.png', 0, 1);
END;

/* One Rejected sample for filter tabs */
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @P5)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ConditionType, BasePrice, Currency, StockQuantity, Status
    ) VALUES (
        @P5, @ShopId, @CatAccess,
        N'Generic Cable Rejected Sample', N'generic-cable-rejected',
        N'Sample already rejected listing.',
        N'Poor description / counterfeit risk demo.',
        N'NoBrand', N'New', 99000, 'VND', 50, N'Rejected'
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary)
    VALUES (@P5, N'/theme/images/product-image-6.png', 0, 1);

    IF NOT EXISTS (
        SELECT 1 FROM dbo.ProductModerationHistory WHERE ProductId = @P5
    )
    BEGIN
        INSERT INTO dbo.ProductModerationHistory (
            ProductId, AdminUserId, Action, FromStatus, ToStatus, Reason, CreatedAt
        )
        VALUES (
            @P5,
            'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
            N'Reject',
            N'Pending',
            N'Rejected',
            N'Insufficient product information and unclear brand authenticity.',
            DATEADD(DAY, -1, SYSUTCDATETIME())
        );
    END
END;

/* Ensure stock lots + cost for margin testing on an Approved catalog product */
DECLARE @ApprovedId UNIQUEIDENTIFIER;
SELECT TOP (1) @ApprovedId = ProductId
FROM dbo.Products
WHERE ShopId = @ShopId AND Status = N'Approved'
ORDER BY CreatedAt;

IF @ApprovedId IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.InventoryLots WHERE ProductId = @ApprovedId AND LotCode = N'LOT-SEED-001')
BEGIN
    DECLARE @LotId UNIQUEIDENTIFIER = NEWID();
    INSERT INTO dbo.InventoryLots (
        LotId, ProductId, LotCode, QuantityReceived, QuantityRemaining,
        UnitCost, Currency, SupplierName, InvoiceNumber, ReceivedAt, Status, CreatedBy, Note
    ) VALUES (
        @LotId, @ApprovedId, N'LOT-SEED-001', 20, 20,
        10000000, 'VND', N'Demo Supplier', N'INV-SEED-001', SYSUTCDATETIME(), N'Open',
        @SellerId, N'Seed lot for margin / inventory UI'
    );

    UPDATE dbo.Products
    SET StockQuantity = CASE WHEN StockQuantity < 20 THEN 20 ELSE StockQuantity END,
        LastCostPrice = 10000000,
        AvgCostPrice = 10000000,
        UpdatedAt = SYSUTCDATETIME()
    WHERE ProductId = @ApprovedId;

    INSERT INTO dbo.InventoryTransactions (
        ProductId, LotId, ChangeQty, UnitCost, Reason, ReferenceType, ReferenceId, CreatedBy, Note
    ) VALUES (
        @ApprovedId, @LotId, 20, 10000000, N'StockIn', N'Lot', @LotId, @SellerId, N'Seed lot'
    );
END;

PRINT N'Pending product moderation seed completed.';
GO

