/*
  AIDR — Low-stock System notifications for demo seller (UC-17 + UC-44)
  Prerequisites: POST /api/dev/seed-demo-accounts (+ catalog products on demo shop).
  Idempotent by fixed NotificationId(s).

  Seeds unread System / Product notifications so seller bell + inventory deep-link can be tested.
  Also ensures at least one demo product is marked low-stock (available <= threshold) when possible.
*/

SET NOCOUNT ON;

DECLARE
    @SellerId UNIQUEIDENTIFIER = 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB',
    @ShopId   UNIQUEIDENTIFIER = 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD',
    @ProductId UNIQUEIDENTIFIER,
    @ProductName NVARCHAR(256),
    @Available INT,
    @Threshold INT,
    @N1 UNIQUEIDENTIFIER = 'F1000001-0001-4000-8000-000000000001',
    @N2 UNIQUEIDENTIFIER = 'F1000001-0001-4000-8000-000000000002',
    @Now DATETIME2(3) = SYSUTCDATETIME();

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @SellerId)
BEGIN
    RAISERROR(N'Demo seller missing. Run POST /api/dev/seed-demo-accounts first.', 16, 1);
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Shops WHERE ShopId = @ShopId)
    SELECT TOP (1) @ShopId = ShopId FROM dbo.Shops WHERE OwnerUserId = @SellerId AND Status = N'Active' ORDER BY CreatedAt;

IF @ShopId IS NULL
BEGIN
    RAISERROR(N'Demo shop missing. Run seed-demo-accounts / seed-catalog first.', 16, 1);
    RETURN;
END;

/* Prefer an already low-stock product; otherwise pick any and tighten threshold for demo. */
SELECT TOP (1)
    @ProductId = ProductId,
    @ProductName = Name,
    @Available = StockQuantity - ReservedQuantity,
    @Threshold = LowStockThreshold
FROM dbo.Products
WHERE ShopId = @ShopId
  AND Status <> N'Deleted'
  AND (StockQuantity - ReservedQuantity) <= LowStockThreshold
ORDER BY UpdatedAt DESC;

IF @ProductId IS NULL
BEGIN
    SELECT TOP (1)
        @ProductId = ProductId,
        @ProductName = Name,
        @Available = StockQuantity - ReservedQuantity,
        @Threshold = LowStockThreshold
    FROM dbo.Products
    WHERE ShopId = @ShopId
      AND Status <> N'Deleted'
    ORDER BY UpdatedAt DESC;

    IF @ProductId IS NOT NULL AND @Available > @Threshold
    BEGIN
        UPDATE dbo.Products
        SET LowStockThreshold = CASE WHEN @Available < 0 THEN 0 ELSE @Available END,
            UpdatedAt = @Now
        WHERE ProductId = @ProductId;

        SET @Threshold = CASE WHEN @Available < 0 THEN 0 ELSE @Available END;
    END
END;

IF @ProductId IS NULL
BEGIN
    RAISERROR(N'No products on demo shop. Run POST /api/dev/seed-catalog first.', 16, 1);
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Notifications WHERE NotificationId = @N1)
BEGIN
    INSERT INTO dbo.Notifications (
        NotificationId, UserId, Title, Body, Type, ReferenceType, ReferenceId, IsRead, CreatedAt
    )
    VALUES (
        @N1,
        @SellerId,
        N'Low stock: ' + LEFT(@ProductName, 120),
        LEFT(@ProductName, 200) + N' has '
            + CAST(@Available AS NVARCHAR(20)) + N' unit(s) left (threshold '
            + CAST(@Threshold AS NVARCHAR(20)) + N').',
        N'System',
        N'Product',
        @ProductId,
        0,
        DATEADD(MINUTE, -15, @Now)
    );
END;

/* Second sample (read) so inbox list has variety — reuse same product. */
IF NOT EXISTS (SELECT 1 FROM dbo.Notifications WHERE NotificationId = @N2)
BEGIN
    INSERT INTO dbo.Notifications (
        NotificationId, UserId, Title, Body, Type, ReferenceType, ReferenceId, IsRead, CreatedAt
    )
    VALUES (
        @N2,
        @SellerId,
        N'Low stock: ' + LEFT(@ProductName, 120),
        N'Resolved or acknowledged earlier — sample read notification for inbox filters.',
        N'System',
        N'Product',
        @ProductId,
        1,
        DATEADD(DAY, -2, @Now)
    );
END;

PRINT N'Low-stock notification demo seed completed.';
