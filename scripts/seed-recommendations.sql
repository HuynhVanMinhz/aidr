/*
  AIDR — Recommendation & Similar demo seed (UC-53 / UC-54)
  Prerequisites:
    - POST /api/dev/seed-demo-accounts (demo buyer CCCC...)
    - POST /api/dev/seed-catalog (Approved products 1111...01..10 + S24)

  Idempotent: skips when REC-SEED marker views already exist for demo buyer.
  Seeds:
    - ViewedProductHistories for demo buyer (phones / Samsung affinity)
    - Peer views for a second demo user (collaborative co-view signal)
    - ProductRecommendations rows (Hybrid / Content / Popular strategies)
*/

SET NOCOUNT ON;

DECLARE
    @BuyerId   UNIQUEIDENTIFIER = 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC',
    @PeerId    UNIQUEIDENTIFIER = 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCC1',
    @Now       DATETIME2(3) = SYSUTCDATETIME(),
    @ApprovedCount INT;

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @BuyerId)
BEGIN
    RAISERROR(N'Demo buyer missing. Run POST /api/dev/seed-demo-accounts first.', 16, 1);
    RETURN;
END;

SELECT @ApprovedCount = COUNT(*) FROM dbo.Products WHERE Status = N'Approved';
IF @ApprovedCount < 3
BEGIN
    RAISERROR(N'Not enough Approved products. Run POST /api/dev/seed-catalog first.', 16, 1);
    RETURN;
END;

/* Ensure peer user for collaborative signal (no login required) */
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @PeerId)
BEGIN
    INSERT INTO dbo.Users (UserId, Email, EmailConfirmed, FullName, Phone, Status, CreatedAt, UpdatedAt)
    VALUES (@PeerId, N'buyer-peer@aidr.local', 1, N'Demo Peer Buyer', N'0900000099', N'Active', @Now, @Now);

    DECLARE @RoleBuyer INT = (SELECT RoleId FROM dbo.Roles WHERE RoleCode = N'BUYER');
    IF @RoleBuyer IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = @PeerId AND RoleId = @RoleBuyer)
        INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@PeerId, @RoleBuyer);
END;

/* Skip if already seeded */
IF EXISTS (
    SELECT 1
    FROM dbo.ViewedProductHistories
    WHERE UserId = @BuyerId
      AND SessionId = N'REC-SEED'
)
BEGIN
    PRINT N'Recommendation demo seed already present — skipped.';
    RETURN;
END;

/* Resolve product ids (fixed catalog GUIDs with slug fallback) */
DECLARE
    @P_S24   UNIQUEIDENTIFIER = COALESCE(
        (SELECT TOP 1 ProductId FROM dbo.Products WHERE ProductId = 'EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE' AND Status = N'Approved'),
        (SELECT TOP 1 ProductId FROM dbo.Products WHERE Slug = N'samsung-galaxy-s24-256gb' AND Status = N'Approved')),
    @P_IP15  UNIQUEIDENTIFIER = COALESCE(
        (SELECT TOP 1 ProductId FROM dbo.Products WHERE ProductId = '11111111-1111-1111-1111-111111111101' AND Status = N'Approved'),
        (SELECT TOP 1 ProductId FROM dbo.Products WHERE Slug = N'iphone-15-128gb' AND Status = N'Approved')),
    @P_X14   UNIQUEIDENTIFIER = COALESCE(
        (SELECT TOP 1 ProductId FROM dbo.Products WHERE ProductId = '11111111-1111-1111-1111-111111111102' AND Status = N'Approved'),
        (SELECT TOP 1 ProductId FROM dbo.Products WHERE Slug = N'xiaomi-14-256gb' AND Status = N'Approved')),
    @P_MBA   UNIQUEIDENTIFIER = COALESCE(
        (SELECT TOP 1 ProductId FROM dbo.Products WHERE ProductId = '11111111-1111-1111-1111-111111111103' AND Status = N'Approved'),
        (SELECT TOP 1 ProductId FROM dbo.Products WHERE Slug = N'macbook-air-m3-13' AND Status = N'Approved')),
    @P_ASUS  UNIQUEIDENTIFIER = COALESCE(
        (SELECT TOP 1 ProductId FROM dbo.Products WHERE ProductId = '11111111-1111-1111-1111-111111111104' AND Status = N'Approved'),
        (SELECT TOP 1 ProductId FROM dbo.Products WHERE Status = N'Approved' ORDER BY SoldCount DESC)),
    @P_WATCH UNIQUEIDENTIFIER = COALESCE(
        (SELECT TOP 1 ProductId FROM dbo.Products WHERE ProductId = '11111111-1111-1111-1111-111111111109' AND Status = N'Approved'),
        (SELECT TOP 1 ProductId FROM dbo.Products WHERE Slug = N'samsung-galaxy-watch-6' AND Status = N'Approved')),
    @P_IPAD  UNIQUEIDENTIFIER = COALESCE(
        (SELECT TOP 1 ProductId FROM dbo.Products WHERE ProductId = '11111111-1111-1111-1111-111111111110' AND Status = N'Approved'),
        (SELECT TOP 1 ProductId FROM dbo.Products WHERE Status = N'Approved' ORDER BY AvgRating DESC));

/* Buyer view history — phone / Samsung affinity */
INSERT INTO dbo.ViewedProductHistories (UserId, SessionId, ProductId, ViewedAt)
SELECT @BuyerId, N'REC-SEED', v.ProductId, v.ViewedAt
FROM (VALUES
    (@P_S24,   DATEADD(HOUR, -2, @Now)),
    (@P_IP15,  DATEADD(HOUR, -5, @Now)),
    (@P_X14,   DATEADD(HOUR, -8, @Now)),
    (@P_S24,   DATEADD(DAY, -1, @Now)),
    (@P_WATCH, DATEADD(DAY, -2, @Now)),
    (@P_MBA,   DATEADD(DAY, -3, @Now))
) AS v(ProductId, ViewedAt)
WHERE v.ProductId IS NOT NULL;

/* Peer also viewed S24 / IP15 then other items → collaborative candidates */
INSERT INTO dbo.ViewedProductHistories (UserId, SessionId, ProductId, ViewedAt)
SELECT @PeerId, N'REC-SEED-PEER', v.ProductId, v.ViewedAt
FROM (VALUES
    (@P_S24,   DATEADD(HOUR, -3, @Now)),
    (@P_IP15,  DATEADD(HOUR, -4, @Now)),
    (@P_ASUS,  DATEADD(HOUR, -6, @Now)),
    (@P_IPAD,  DATEADD(DAY, -1, @Now)),
    (@P_WATCH, DATEADD(DAY, -1, @Now))
) AS v(ProductId, ViewedAt)
WHERE v.ProductId IS NOT NULL;

/* Precomputed recommendations for demo buyer */
DELETE FROM dbo.ProductRecommendations WHERE UserId = @BuyerId;

INSERT INTO dbo.ProductRecommendations (UserId, ProductId, Score, Strategy, GeneratedAt)
SELECT @BuyerId, r.ProductId, r.Score, r.Strategy, @Now
FROM (VALUES
    (@P_X14,   CAST(0.920000 AS DECIMAL(9,6)), N'Hybrid'),
    (@P_WATCH, CAST(0.880000 AS DECIMAL(9,6)), N'Content'),
    (@P_IPAD,  CAST(0.810000 AS DECIMAL(9,6)), N'Collaborative'),
    (@P_ASUS,  CAST(0.760000 AS DECIMAL(9,6)), N'Collaborative'),
    (@P_MBA,   CAST(0.700000 AS DECIMAL(9,6)), N'Popular'),
    (@P_IP15,  CAST(0.650000 AS DECIMAL(9,6)), N'Content')
) AS r(ProductId, Score, Strategy)
WHERE r.ProductId IS NOT NULL
  AND EXISTS (SELECT 1 FROM dbo.Products p WHERE p.ProductId = r.ProductId AND p.Status = N'Approved');

PRINT N'Recommendation demo seed completed.';
