/*
  Seed product reviews for storefront PDP testing (AirPods + a few other demo products).

  Prerequisites:
  - Demo buyer: POST /api/dev/seed-demo-accounts (CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC)
  - Catalog products: POST /api/dev/seed-catalog (AirPods = 11111111-1111-1111-1111-111111111106)

  Idempotent: deletes prior REV-SEED-* marker reviews for target products, then re-inserts.
  Syncs Products.AvgRating / ReviewCount from visible ProductReviews.
*/
SET NOCOUNT ON;

DECLARE @BuyerId UNIQUEIDENTIFIER = 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC';
DECLARE @AirPods UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111106';
DECLARE @Sony UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111107';
DECLARE @S24 UNIQUEIDENTIFIER = (
    SELECT TOP 1 ProductId FROM dbo.Products WHERE Slug = N'samsung-galaxy-s24-256gb'
);
DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @BuyerId)
BEGIN
    RAISERROR(N'Demo buyer missing. Run POST /api/dev/seed-demo-accounts first.', 16, 1);
    RETURN;
END;

/* Extra demo reviewers (idempotent) - avoids UNIQUE (Buyer, Product, Order) collisions when OrderId is NULL */
DECLARE @Reviewers TABLE (UserId UNIQUEIDENTIFIER NOT NULL, FullName NVARCHAR(100) NOT NULL, Idx INT NOT NULL);
INSERT INTO @Reviewers (UserId, FullName, Idx) VALUES
(N'A1111111-1111-1111-1111-111111111101', N'Alex Nguyen', 1),
(N'A1111111-1111-1111-1111-111111111102', N'Jordan Lee', 2),
(N'A1111111-1111-1111-1111-111111111103', N'Morgan Tran', 3),
(N'A1111111-1111-1111-1111-111111111104', N'Casey Pham', 4),
(N'A1111111-1111-1111-1111-111111111105', N'Riley Vo', 5),
(N'A1111111-1111-1111-1111-111111111106', N'Sam Le', 6),
(N'A1111111-1111-1111-1111-111111111107', N'Jamie Ho', 7),
(N'A1111111-1111-1111-1111-111111111108', N'Avery Do', 8),
(N'A1111111-1111-1111-1111-111111111109', N'Quinn Bui', 9),
(N'A1111111-1111-1111-1111-111111111110', N'Drew Ngo', 10),
(N'A1111111-1111-1111-1111-111111111111', N'Blake Dao', 11),
(N'A1111111-1111-1111-1111-111111111112', N'Cameron Vu', 12),
(N'A1111111-1111-1111-1111-111111111113', N'Harper Ly', 13),
(N'A1111111-1111-1111-1111-111111111114', N'Reese Mai', 14),
(N'A1111111-1111-1111-1111-111111111115', N'Skyler Ton', 15),
(N'A1111111-1111-1111-1111-111111111116', N'Parker Hua', 16),
(N'A1111111-1111-1111-1111-111111111117', N'Taylor Kim', 17),
(N'A1111111-1111-1111-1111-111111111118', N'Robin Chau', 18),
(N'A1111111-1111-1111-1111-111111111119', N'Sage Dinh', 19);

DECLARE @BuyerRoleId INT = (SELECT TOP 1 RoleId FROM dbo.Roles WHERE RoleCode = N'BUYER');

INSERT INTO dbo.Users (
    UserId, Email, PasswordHash, FullName, Status, EmailConfirmed, CreatedAt, UpdatedAt
)
SELECT r.UserId,
       CONCAT(N'rev-seed-', r.Idx, N'@aidr.local'),
       N'!SEED-NO-LOGIN!',
       r.FullName,
       N'Active',
       1,
       @Now,
       @Now
FROM @Reviewers r
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = r.UserId);

IF @BuyerRoleId IS NOT NULL
BEGIN
    INSERT INTO dbo.UserRoles (UserId, RoleId)
    SELECT r.UserId, @BuyerRoleId
    FROM @Reviewers r
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.UserRoles ur WHERE ur.UserId = r.UserId AND ur.RoleId = @BuyerRoleId
    );
END;

/* Wipe previous seeded reviews for target products */
DELETE FROM dbo.ProductReviews
WHERE ProductId = @AirPods
  AND (
      BuyerUserId IN (SELECT UserId FROM @Reviewers)
      OR BuyerUserId = @BuyerId
      OR Title LIKE N'REV-SEED:%'
  );

DELETE FROM dbo.ProductReviews
WHERE ProductId IN (@Sony, @S24)
  AND (
      BuyerUserId IN (SELECT UserId FROM @Reviewers)
      OR Title LIKE N'REV-SEED:%'
  );

/* ---- AirPods Pro: 20 reviews matching denormalized marketing count ---- */
IF EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @AirPods)
BEGIN
    ;WITH AirPodsReviews AS (
        SELECT * FROM (VALUES
            (1,  5, N'REV-SEED: Excellent ANC', N'Comfortable fit and strong noise cancellation on flights.'),
            (2,  5, N'REV-SEED: Crystal clear calls', N'Mic quality is great for meetings and commuting.'),
            (3,  5, N'REV-SEED: Worth the upgrade', N'Adaptive Audio feels smarter than the previous generation.'),
            (4,  5, N'REV-SEED: Seamless Apple setup', N'Paired instantly with iPhone and MacBook.'),
            (5,  5, N'REV-SEED: All-day comfort', N'Wore them for 4 hours straight with no ear fatigue.'),
            (6,  5, N'REV-SEED: Spatial Audio wow', N'Movies feel immersive with dynamic head tracking.'),
            (7,  5, N'REV-SEED: Battery holds up', N'Case charges quickly and lasts through travel days.'),
            (8,  5, N'REV-SEED: MagSafe friendly', N'Love dropping the case on a charger without cables.'),
            (9,  5, N'REV-SEED: Great for gym', N'Stay secure during runs; sweat resistant enough for me.'),
            (10, 5, N'REV-SEED: Premium sound', N'Balanced mids and clean highs for podcasts and music.'),
            (11, 5, N'REV-SEED: Fast shipping', N'Arrived sealed and genuine - packaging looked official.'),
            (12, 5, N'REV-SEED: Transparency mode', N'Hear traffic clearly while still enjoying music.'),
            (13, 4, N'REV-SEED: Almost perfect', N'Sound is excellent; wish tips included one more size.'),
            (14, 4, N'REV-SEED: Solid daily driver', N'Use them every commute. ANC is strong in the metro.'),
            (15, 4, N'REV-SEED: Good value on sale', N'Bought during promo - quality matches the price drop.'),
            (16, 4, N'REV-SEED: Reliable pairing', N'Switches between devices smoothly most of the time.'),
            (17, 4, N'REV-SEED: Comfortable tips', N'Silicon tips seal well after trying the medium size.'),
            (18, 3, N'REV-SEED: Fine but pricey', N'Performance is good, though still expensive for TWS.'),
            (19, 3, N'REV-SEED: Mixed on fit', N'Sound is great; small ears need the foam tips.'),
            (0,  5, N'REV-SEED: Excellent ANC', N'Comfortable fit and strong noise cancellation on flights.')
        ) AS v(Idx, Rating, Title, Content)
    )
    INSERT INTO dbo.ProductReviews (
        ProductId, BuyerUserId, OrderId, Rating, Title, Content, IsVisible, CreatedAt, UpdatedAt
    )
    SELECT
        @AirPods,
        CASE WHEN a.Idx = 0 THEN @BuyerId ELSE r.UserId END,
        NULL,
        a.Rating,
        a.Title,
        a.Content,
        1,
        DATEADD(DAY, -a.Idx, @Now),
        DATEADD(DAY, -a.Idx, @Now)
    FROM AirPodsReviews a
    LEFT JOIN @Reviewers r ON r.Idx = a.Idx
    WHERE a.Idx = 0 OR r.UserId IS NOT NULL;
END;

/* ---- Sony XM5: a handful of reviews ---- */
IF EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @Sony)
BEGIN
    INSERT INTO dbo.ProductReviews (
        ProductId, BuyerUserId, OrderId, Rating, Title, Content, IsVisible, CreatedAt, UpdatedAt
    )
    SELECT @Sony, r.UserId, NULL, v.Rating, v.Title, v.Content, 1,
           DATEADD(DAY, -v.DaysAgo, @Now), DATEADD(DAY, -v.DaysAgo, @Now)
    FROM (VALUES
        (1, 5, 3, N'REV-SEED: Best travel headphones', N'ANC on planes is outstanding and the case is compact.'),
        (2, 5, 5, N'REV-SEED: Battery beast', N'Easily lasts a full work week between charges.'),
        (3, 4, 8, N'REV-SEED: Comfortable over-ear', N'Pads are plush; slight warmth after long sessions.'),
        (4, 4, 10, N'REV-SEED: LDAC sounds rich', N'Wired to Android the detail is excellent.')
    ) AS v(Idx, Rating, DaysAgo, Title, Content)
    INNER JOIN @Reviewers r ON r.Idx = v.Idx;
END;

/* ---- Galaxy S24: keep a few ---- */
IF @S24 IS NOT NULL
BEGIN
    INSERT INTO dbo.ProductReviews (
        ProductId, BuyerUserId, OrderId, Rating, Title, Content, IsVisible, CreatedAt, UpdatedAt
    )
    SELECT @S24, r.UserId, NULL, v.Rating, v.Title, v.Content, 1,
           DATEADD(DAY, -v.DaysAgo, @Now), DATEADD(DAY, -v.DaysAgo, @Now)
    FROM (VALUES
        (5, 5, 2, N'REV-SEED: Bright display', N'Screen looks fantastic outdoors and cameras are snappy.'),
        (6, 4, 6, N'REV-SEED: Smooth daily use', N'One UI is polished; battery lasts a full day easily.'),
        (7, 5, 9, N'REV-SEED: Flagship feel', N'Build quality and performance match expectations.')
    ) AS v(Idx, Rating, DaysAgo, Title, Content)
    INNER JOIN @Reviewers r ON r.Idx = v.Idx;
END;

/* Sync denormalized product rating stats from visible reviews */
UPDATE p
SET
    ReviewCount = ISNULL(s.Cnt, 0),
    AvgRating = ISNULL(s.AvgRating, 0),
    UpdatedAt = @Now
FROM dbo.Products p
OUTER APPLY (
    SELECT
        COUNT(*) AS Cnt,
        CAST(AVG(CAST(r.Rating AS DECIMAL(9, 2))) AS DECIMAL(3, 2)) AS AvgRating
    FROM dbo.ProductReviews r
    WHERE r.ProductId = p.ProductId AND r.IsVisible = 1
) s
WHERE p.ProductId IN (@AirPods, @Sony, @S24)
   OR p.Slug IN (N'airpods-pro-2', N'sony-wh-1000xm5', N'samsung-galaxy-s24-256gb');

PRINT N'Product reviews demo seed completed.';
GO
