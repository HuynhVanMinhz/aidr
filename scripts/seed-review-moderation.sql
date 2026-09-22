/*
  Seed PendingTrust + Reported product reviews for admin moderation queue.

  Prerequisites:
  - Demo accounts: POST /api/dev/seed-demo-accounts
  - Catalog: POST /api/dev/seed-catalog (or seed-pending-products)
  - Schema: scripts/review-moderation-schema.sql (applied by seeder)

  Idempotent: fixed ReviewIds / ReportIds; skip if already present.
*/
SET NOCOUNT ON;

DECLARE @BuyerId UNIQUEIDENTIFIER = 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC';
DECLARE @SellerOwnerId UNIQUEIDENTIFIER = 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB';
DECLARE @AirPods UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111106';
DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

DECLARE @PendingReviewId UNIQUEIDENTIFIER = 'E1111111-1111-1111-1111-111111111101';
DECLARE @ReportedReviewId UNIQUEIDENTIFIER = 'E1111111-1111-1111-1111-111111111102';
DECLARE @ReportId UNIQUEIDENTIFIER = 'E2111111-1111-1111-1111-111111111201';

DECLARE @SpamBuyerId UNIQUEIDENTIFIER = 'A1111111-1111-1111-1111-111111111201';
DECLARE @SpamBuyer2Id UNIQUEIDENTIFIER = 'A1111111-1111-1111-1111-111111111202';

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @BuyerId)
BEGIN
    RAISERROR(N'Demo buyer missing. Run POST /api/dev/seed-demo-accounts first.', 16, 1);
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @AirPods)
BEGIN
    RAISERROR(N'AirPods demo product missing. Run catalog seed first.', 16, 1);
    RETURN;
END;

IF COL_LENGTH('dbo.ProductReviews', 'CountsTowardRating') IS NULL
BEGIN
    RAISERROR(N'review-moderation-schema.sql not applied.', 16, 1);
    RETURN;
END;

/* New low-trust spam accounts (CreatedAt = yesterday) */
INSERT INTO dbo.Users (
    UserId, Email, PasswordHash, FullName, Status, EmailConfirmed, CreatedAt, UpdatedAt
)
SELECT v.UserId, v.Email, N'!SEED-NO-LOGIN!', v.FullName, N'Active', 1, DATEADD(DAY, -1, @Now), @Now
FROM (VALUES
    (@SpamBuyerId, N'review-spam-1@aidr.local', N'Spam Buyer One'),
    (@SpamBuyer2Id, N'review-spam-2@aidr.local', N'Spam Buyer Two')
) v(UserId, Email, FullName)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Users u WHERE u.UserId = v.UserId);

DECLARE @BuyerRoleId INT = (SELECT TOP 1 RoleId FROM dbo.Roles WHERE RoleCode = N'BUYER');
IF @BuyerRoleId IS NOT NULL
BEGIN
    INSERT INTO dbo.UserRoles (UserId, RoleId)
    SELECT v.UserId, @BuyerRoleId
    FROM (VALUES (@SpamBuyerId), (@SpamBuyer2Id)) v(UserId)
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.UserRoles ur WHERE ur.UserId = v.UserId AND ur.RoleId = @BuyerRoleId
    );
END;

/* PendingTrust review - visible but not counting */
IF NOT EXISTS (SELECT 1 FROM dbo.ProductReviews WHERE ReviewId = @PendingReviewId)
BEGIN
    INSERT INTO dbo.ProductReviews (
        ReviewId, ProductId, BuyerUserId, OrderId, Rating, Title, Content,
        IsVisible, CountsTowardRating, ModerationStatus, TrustReleaseAt, CreatedAt, UpdatedAt
    )
    VALUES (
        @PendingReviewId, @AirPods, @SpamBuyerId, NULL, 1,
        N'Pending trust seed',
        N'This low-trust account review should stay out of AvgRating until released.',
        1, 0, N'PendingTrust', DATEADD(HOUR, 72, @Now), @Now, @Now
    );
END;

/* Reported review + open report from demo seller (if seller exists) or demo buyer */
IF NOT EXISTS (SELECT 1 FROM dbo.ProductReviews WHERE ReviewId = @ReportedReviewId)
BEGIN
    INSERT INTO dbo.ProductReviews (
        ReviewId, ProductId, BuyerUserId, OrderId, Rating, Title, Content,
        IsVisible, CountsTowardRating, ModerationStatus, TrustReleaseAt, CreatedAt, UpdatedAt
    )
    VALUES (
        @ReportedReviewId, @AirPods, @SpamBuyer2Id, NULL, 1,
        N'Reported spam seed',
        N'Buy elsewhere scammer shop!!! Fake product spam content for moderation queue.',
        1, 0, N'Reported', NULL, @Now, @Now
    );
END;

DECLARE @ReporterId UNIQUEIDENTIFIER =
    CASE WHEN EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @SellerOwnerId)
         THEN @SellerOwnerId ELSE @BuyerId END;

IF NOT EXISTS (SELECT 1 FROM dbo.ProductReviewReports WHERE ReportId = @ReportId)
BEGIN
    INSERT INTO dbo.ProductReviewReports (
        ReportId, ReviewId, ReporterUserId, Reason, Details, Status, CreatedAt
    )
    VALUES (
        @ReportId, @ReportedReviewId, @ReporterId, N'Spam',
        N'Seeded open report for admin moderation queue.', N'Open', @Now
    );
END;

/* Sync AirPods counters from rating-eligible reviews only */
UPDATE p
SET p.ReviewCount = ISNULL(s.Cnt, 0),
    p.AvgRating = ISNULL(s.AvgRating, 0),
    p.UpdatedAt = @Now
FROM dbo.Products p
OUTER APPLY (
    SELECT COUNT(*) AS Cnt,
           CAST(ROUND(AVG(CAST(r.Rating AS DECIMAL(10,4))), 2) AS DECIMAL(3,2)) AS AvgRating
    FROM dbo.ProductReviews r
    WHERE r.ProductId = p.ProductId
      AND r.IsVisible = 1
      AND r.CountsTowardRating = 1
) s
WHERE p.ProductId = @AirPods;

PRINT N'Review moderation seed completed.';
GO
