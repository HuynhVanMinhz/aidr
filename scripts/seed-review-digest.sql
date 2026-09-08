/*
  seed-review-digest.sql — 15+ diverse reviews on a demo phone for AI review digest testing.

  Prerequisites:
  - POST /api/dev/seed-demo-accounts
  - POST /api/dev/seed-catalog (Samsung Galaxy S24)
  - POST /api/dev/seed-product-reviews optional (this script is self-contained)

  Idempotent: removes prior REV-DIGEST-SEED:* reviews, then re-inserts.
*/

SET NOCOUNT ON;

DECLARE @ProductId UNIQUEIDENTIFIER = (
    SELECT TOP 1 ProductId FROM dbo.Products WHERE Slug = N'samsung-galaxy-s24-256gb' AND Status = N'Approved'
);
DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

IF @ProductId IS NULL
BEGIN
    PRINT N'seed-review-digest: skipped — no approved Samsung Galaxy S24 product.';
    RETURN;
END;

DECLARE @Reviewers TABLE (UserId UNIQUEIDENTIFIER NOT NULL, FullName NVARCHAR(100) NOT NULL, Idx INT NOT NULL);
INSERT INTO @Reviewers (UserId, FullName, Idx) VALUES
(N'B1111111-1111-1111-1111-111111111101', N'Alex Nguyen', 1),
(N'B1111111-1111-1111-1111-111111111102', N'Jordan Lee', 2),
(N'B1111111-1111-1111-1111-111111111103', N'Morgan Tran', 3),
(N'B1111111-1111-1111-1111-111111111104', N'Casey Pham', 4),
(N'B1111111-1111-1111-1111-111111111105', N'Riley Vo', 5),
(N'B1111111-1111-1111-1111-111111111106', N'Sam Le', 6),
(N'B1111111-1111-1111-1111-111111111107', N'Jamie Ho', 7),
(N'B1111111-1111-1111-1111-111111111108', N'Avery Do', 8),
(N'B1111111-1111-1111-1111-111111111109', N'Quinn Bui', 9),
(N'B1111111-1111-1111-1111-111111111110', N'Drew Ngo', 10),
(N'B1111111-1111-1111-1111-111111111111', N'Blake Dao', 11),
(N'B1111111-1111-1111-1111-111111111112', N'Cameron Vu', 12),
(N'B1111111-1111-1111-1111-111111111113', N'Harper Ly', 13),
(N'B1111111-1111-1111-1111-111111111114', N'Reese Mai', 14),
(N'B1111111-1111-1111-1111-111111111115', N'Skyler Ton', 15);

DECLARE @BuyerRoleId INT = (SELECT TOP 1 RoleId FROM dbo.Roles WHERE RoleCode = N'BUYER');

INSERT INTO dbo.Users (UserId, Email, PasswordHash, FullName, Status, EmailConfirmed, CreatedAt, UpdatedAt)
SELECT r.UserId, CONCAT(N'digest-seed-', r.Idx, N'@aidr.local'), N'!SEED-NO-LOGIN!', r.FullName, N'Active', 1, @Now, @Now
FROM @Reviewers r
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = r.UserId);

IF @BuyerRoleId IS NOT NULL
BEGIN
    INSERT INTO dbo.UserRoles (UserId, RoleId)
    SELECT r.UserId, @BuyerRoleId
    FROM @Reviewers r
    WHERE NOT EXISTS (SELECT 1 FROM dbo.UserRoles ur WHERE ur.UserId = r.UserId AND ur.RoleId = @BuyerRoleId);
END;

DELETE FROM dbo.ProductReviews
WHERE ProductId = @ProductId
  AND (Title LIKE N'REV-DIGEST-SEED:%' OR BuyerUserId IN (SELECT UserId FROM @Reviewers));

DELETE FROM dbo.ProductReviewDigestSnapshots WHERE ProductId = @ProductId;

;WITH SeedReviews AS (
    SELECT * FROM (VALUES
        (1,  5, N'REV-DIGEST-SEED: Excellent battery life', N'Battery easily lasts a full day with heavy use. Very impressed.'),
        (2,  5, N'REV-DIGEST-SEED: Sharp display', N'120Hz screen is smooth and colors look vibrant outdoors.'),
        (3,  5, N'REV-DIGEST-SEED: Fast delivery', N'Arrived in two days, well packaged and genuine product.'),
        (4,  4, N'REV-DIGEST-SEED: Good value', N'Solid flagship features for the price compared to last year models.'),
        (5,  4, N'REV-DIGEST-SEED: Great camera', N'Night shots are clean though zoom could be better.'),
        (6,  4, N'REV-DIGEST-SEED: Smooth performance', N'Apps open quickly and gaming runs well on high settings.'),
        (7,  3, N'REV-DIGEST-SEED: Average packaging', N'Box was fine but inner tray felt a bit loose.'),
        (8,  3, N'REV-DIGEST-SEED: Okay speakers', N'Speakers are decent but not as loud as expected.'),
        (9,  3, N'REV-DIGEST-SEED: Mixed on heating', N'Gets warm during long gaming sessions but cools down quickly.'),
        (10, 2, N'REV-DIGEST-SEED: Warm under load', N'Noticeable heat when recording 4K video for more than ten minutes.'),
        (11, 2, N'REV-DIGEST-SEED: Pricey accessories', N'Cases and chargers from the shop are more expensive than elsewhere.'),
        (12, 5, N'REV-DIGEST-SEED: Reliable daily driver', N'Fingerprint and face unlock work consistently every day.'),
        (13, 4, N'REV-DIGEST-SEED: Clean software', N'One UI feels polished with minimal bloat out of the box.'),
        (14, 4, N'REV-DIGEST-SEED: Good for photos', N'Portrait mode separates subjects well in daylight.'),
        (15, 5, N'REV-DIGEST-SEED: Would buy again', N'Best Android phone I have owned in years for battery and screen.')
    ) AS v(Idx, Rating, Title, Content)
)
INSERT INTO dbo.ProductReviews (
    ProductId, BuyerUserId, Rating, Title, Content, IsVisible, CreatedAt, UpdatedAt
)
SELECT
    @ProductId,
    r.UserId,
    s.Rating,
    s.Title,
    s.Content,
    1,
    DATEADD(DAY, -s.Idx, @Now),
    DATEADD(DAY, -s.Idx, @Now)
FROM SeedReviews s
INNER JOIN @Reviewers r ON r.Idx = s.Idx;

UPDATE p
SET
    ReviewCount = stats.Cnt,
    AvgRating = stats.AvgRating,
    UpdatedAt = @Now
FROM dbo.Products p
CROSS APPLY (
    SELECT
        Cnt = COUNT(*),
        AvgRating = CAST(ROUND(AVG(CAST(r.Rating AS DECIMAL(4,2))), 2) AS DECIMAL(3,2))
    FROM dbo.ProductReviews r
    WHERE r.ProductId = p.ProductId AND r.IsVisible = 1
) stats
WHERE p.ProductId = @ProductId;

PRINT N'seed-review-digest: inserted 15 digest demo reviews.';
GO
