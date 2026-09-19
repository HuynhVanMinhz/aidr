/*
  seed-compatibility-demo.sql - DDR4 laptop + DDR5 RAM incompatible pair for compatibility testing.

  Prerequisites: active shop + laptop category.
  Idempotent by fixed product GUIDs.
*/

SET NOCOUNT ON;

DECLARE
    @ShopId UNIQUEIDENTIFIER = (SELECT TOP 1 ShopId FROM dbo.Shops WHERE Status = N'Active' ORDER BY CreatedAt),
    @CatLaptop INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'laptop'),
    @CatAccess INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'phu-kien'),
    @LaptopId UNIQUEIDENTIFIER = N'F2222222-2222-2222-2222-222222222201',
    @RamId UNIQUEIDENTIFIER = N'F2222222-2222-2222-2222-222222222202',
    @Now DATETIME2(3) = SYSUTCDATETIME();

IF @ShopId IS NULL OR @CatLaptop IS NULL
BEGIN
    PRINT N'seed-compatibility-demo: skipped - missing shop or laptop category.';
    RETURN;
END;

IF @CatAccess IS NULL SET @CatAccess = @CatLaptop;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @LaptopId)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, ConditionType, BasePrice, Currency,
        StockQuantity, ReservedQuantity, WarrantyMonths, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, CreatedAt, UpdatedAt
    ) VALUES (
        @LaptopId, @ShopId, @CatLaptop,
        N'Compat Demo Laptop DDR4', N'compat-demo-laptop-ddr4',
        N'Office laptop with DDR4 SO-DIMM slots.',
        N'Demo laptop for RAM compatibility checks.',
        N'DemoBrand', N'LAP-DDR4', N'New', 18990000, N'VND',
        10, 0, 24,
        N'{"ram_type":"DDR4","form_factor":"SO-DIMM","max_ram":"32GB","ram_slots":"2"}',
        N'["COMPAT-DEMO"]',
        N'Approved', @Now, 4.30, 6, 11, @Now, @Now
    );
END
ELSE
BEGIN
    UPDATE dbo.Products
    SET SpecsJson = N'{"ram_type":"DDR4","form_factor":"SO-DIMM","max_ram":"32GB","ram_slots":"2"}',
        Status = N'Approved', StockQuantity = 10, UpdatedAt = @Now
    WHERE ProductId = @LaptopId;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @RamId)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, ConditionType, BasePrice, Currency,
        StockQuantity, ReservedQuantity, WarrantyMonths, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, CreatedAt, UpdatedAt
    ) VALUES (
        @RamId, @ShopId, @CatAccess,
        N'Compat Demo RAM DDR5 16GB', N'compat-demo-ram-ddr5-16gb',
        N'16GB DDR5 SO-DIMM upgrade module.',
        N'Demo RAM stick for compatibility checks.',
        N'DemoBrand', N'RAM-DDR5-16', N'New', 1290000, N'VND',
        20, 0, 36,
        N'{"ram_type":"DDR5","form_factor":"SO-DIMM","capacity":"16GB","ram_speed":"5600MHz"}',
        N'["COMPAT-DEMO"]',
        N'Approved', @Now, 4.10, 4, 7, @Now, @Now
    );
END
ELSE
BEGIN
    UPDATE dbo.Products
    SET SpecsJson = N'{"ram_type":"DDR5","form_factor":"SO-DIMM","capacity":"16GB","ram_speed":"5600MHz"}',
        Status = N'Approved', StockQuantity = 20, UpdatedAt = @Now
    WHERE ProductId = @RamId;
END;

PRINT N'seed-compatibility-demo: DDR4 laptop + DDR5 RAM pair ready.';
GO
