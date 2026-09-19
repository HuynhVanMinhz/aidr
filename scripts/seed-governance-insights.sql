/*
  AIDR - Admin Governance / Customer Insights demo seed
  Prerequisites: schema + demo accounts + catalog (Approved products + Active shop).
  Idempotent: skips when insight-buyer-01@aidr.local already exists.

  Creates:
  - 40 buyer users registered over the last ~45 days
  - ~80 paid/completed orders spread over the last 30 days
  - Order lines against Approved products (for GMV / top products / cohort)
*/

SET NOCOUNT ON;

IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = N'insight-buyer-01@aidr.local')
BEGIN
    PRINT N'Governance insights seed already applied - skipped.';
    RETURN;
END;

DECLARE
    @ShopId UNIQUEIDENTIFIER,
    @RoleBuyer INT,
    @ShippingJson NVARCHAR(MAX) = N'{"receiverName":"Insight Buyer","phone":"0901000000","province":"Ha Noi","district":"Cau Giay","ward":"Dich Vong","streetAddress":"12 Xuan Thuy"}',
    @Now DATETIME2(3) = SYSUTCDATETIME(),
    @i INT,
    @BuyerId UNIQUEIDENTIFIER,
    @OrderId UNIQUEIDENTIFIER,
    @ProductId UNIQUEIDENTIFIER,
    @ProductName NVARCHAR(256),
    @UnitPrice DECIMAL(18,2),
    @Qty INT,
    @LineTotal DECIMAL(18,2),
    @PaidAt DATETIME2(3),
    @CreatedAt DATETIME2(3),
    @Status NVARCHAR(30),
    @OrderCode NVARCHAR(30),
    @BuyerEmail NVARCHAR(256),
    @BuyerName NVARCHAR(128);

SELECT @RoleBuyer = RoleId FROM dbo.Roles WHERE RoleCode = N'BUYER';
IF @RoleBuyer IS NULL
    THROW 50001, N'BUYER role is missing.', 1;

SELECT TOP (1) @ShopId = ShopId
FROM dbo.Shops
WHERE Status = N'Active'
ORDER BY CreatedAt;

IF @ShopId IS NULL
    THROW 50002, N'No Active shop found. Run catalog seed first.', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE Status = N'Approved' AND ShopId = @ShopId)
    THROW 50003, N'No Approved products for shop. Run catalog seed first.', 1;

/* ---- Buyers registered across last 45 days ---- */
SET @i = 1;
WHILE @i <= 40
BEGIN
    SET @BuyerId = NEWID();
    SET @BuyerEmail = CONCAT(N'insight-buyer-', RIGHT(CONCAT(N'00', CAST(@i AS NVARCHAR(10))), 2), N'@aidr.local');
    SET @BuyerName = CONCAT(N'Insight Buyer ', @i);
    SET @CreatedAt = DATEADD(HOUR, -((@i * 17) % (45 * 24)), @Now);

    INSERT INTO dbo.Users (
        UserId, Email, EmailConfirmed, FullName, Phone, Status,
        FailedLoginCount, LastLoginAt, CreatedAt, UpdatedAt
    )
    VALUES (
        @BuyerId,
        @BuyerEmail,
        1,
        @BuyerName,
        CONCAT(N'091', RIGHT(CONCAT(N'0000000', CAST(1000000 + @i AS NVARCHAR(10))), 7)),
        N'Active',
        0,
        CASE WHEN @i % 3 = 0 THEN NULL ELSE DATEADD(HOUR, -(@i % 72), @Now) END,
        @CreatedAt,
        @CreatedAt
    );

    INSERT INTO dbo.UserRoles (UserId, RoleId, AssignedAt)
    VALUES (@BuyerId, @RoleBuyer, @CreatedAt);

    SET @i += 1;
END;

/* ---- Paid orders over last 30 days ---- */
DECLARE @BuyerCursor TABLE (
    RowNum INT IDENTITY(1,1) PRIMARY KEY,
    UserId UNIQUEIDENTIFIER NOT NULL
);

INSERT INTO @BuyerCursor (UserId)
SELECT UserId
FROM dbo.Users
WHERE Email LIKE N'insight-buyer-%@aidr.local'
ORDER BY CreatedAt;

DECLARE @ProductCursor TABLE (
    RowNum INT IDENTITY(1,1) PRIMARY KEY,
    ProductId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(256) NOT NULL,
    UnitPrice DECIMAL(18,2) NOT NULL
);

INSERT INTO @ProductCursor (ProductId, Name, UnitPrice)
SELECT TOP (12)
    p.ProductId,
    p.Name,
    COALESCE(NULLIF(p.SalePrice, 0), p.BasePrice)
FROM dbo.Products p
WHERE p.ShopId = @ShopId
  AND p.Status = N'Approved'
ORDER BY p.CreatedAt;

IF NOT EXISTS (SELECT 1 FROM @ProductCursor)
    THROW 50004, N'Product cursor empty.', 1;

DECLARE @ProductCount INT = (SELECT COUNT(*) FROM @ProductCursor);
DECLARE @BuyerCount INT = (SELECT COUNT(*) FROM @BuyerCursor);

SET @i = 1;
WHILE @i <= 80
BEGIN
    SELECT @BuyerId = UserId
    FROM @BuyerCursor
    WHERE RowNum = ((@i - 1) % @BuyerCount) + 1;

    SELECT
        @ProductId = ProductId,
        @ProductName = Name,
        @UnitPrice = UnitPrice
    FROM @ProductCursor
    WHERE RowNum = ((@i - 1) % @ProductCount) + 1;

    SET @Qty = 1 + (@i % 3);
    SET @LineTotal = @UnitPrice * @Qty;
    SET @PaidAt = DATEADD(HOUR, -((@i * 9) % (30 * 24)), @Now);
    SET @Status = CASE WHEN @i % 5 = 0 THEN N'Paid' WHEN @i % 5 = 1 THEN N'Confirmed' WHEN @i % 5 = 2 THEN N'Shipping' WHEN @i % 5 = 3 THEN N'Delivered' ELSE N'Completed' END;
    SET @OrderId = NEWID();
    SET @OrderCode = CONCAT(N'INS', FORMAT(@Now, 'yyMMdd'), N'-', RIGHT(CONCAT(N'000', CAST(@i AS NVARCHAR(10))), 3));

    INSERT INTO dbo.Orders (
        OrderId, OrderCode, BuyerUserId, ShopId, ShippingAddressId, ShippingSnapshotJson,
        Status, SubtotalAmount, DiscountAmount, ShippingFee, TotalAmount, Currency,
        PaidAt, DeliveredAt, CompletedAt, CreatedAt, UpdatedAt
    )
    VALUES (
        @OrderId,
        @OrderCode,
        @BuyerId,
        @ShopId,
        NULL,
        @ShippingJson,
        @Status,
        @LineTotal,
        0,
        CASE WHEN @i % 4 = 0 THEN 30000 ELSE 0 END,
        @LineTotal + CASE WHEN @i % 4 = 0 THEN 30000 ELSE 0 END,
        'VND',
        @PaidAt,
        CASE WHEN @Status IN (N'Delivered', N'Completed') THEN DATEADD(DAY, 2, @PaidAt) ELSE NULL END,
        CASE WHEN @Status = N'Completed' THEN DATEADD(DAY, 3, @PaidAt) ELSE NULL END,
        DATEADD(HOUR, -2, @PaidAt),
        @PaidAt
    );

    INSERT INTO dbo.OrderItems (
        OrderItemId, OrderId, ProductId, ProductNameSnapshot, SkuSnapshot,
        UnitPrice, UnitCostAvg, Quantity, LineTotal
    )
    VALUES (
        NEWID(),
        @OrderId,
        @ProductId,
        @ProductName,
        NULL,
        @UnitPrice,
        ROUND(@UnitPrice * 0.72, 0),
        @Qty,
        @LineTotal
    );

    /* Second line on some orders for richer top-product mix */
    IF @i % 4 = 0
    BEGIN
        SELECT
            @ProductId = ProductId,
            @ProductName = Name,
            @UnitPrice = UnitPrice
        FROM @ProductCursor
        WHERE RowNum = ((@i) % @ProductCount) + 1;

        SET @Qty = 1;
        SET @LineTotal = @UnitPrice * @Qty;

        INSERT INTO dbo.OrderItems (
            OrderItemId, OrderId, ProductId, ProductNameSnapshot, SkuSnapshot,
            UnitPrice, UnitCostAvg, Quantity, LineTotal
        )
        VALUES (
            NEWID(),
            @OrderId,
            @ProductId,
            @ProductName,
            NULL,
            @UnitPrice,
            ROUND(@UnitPrice * 0.72, 0),
            @Qty,
            @LineTotal
        );

        UPDATE dbo.Orders
        SET
            SubtotalAmount = SubtotalAmount + @LineTotal,
            TotalAmount = TotalAmount + @LineTotal
        WHERE OrderId = @OrderId;
    END;

    SET @i += 1;
END;

PRINT N'Governance insights seed completed: 40 buyers + 80 orders.';
GO
