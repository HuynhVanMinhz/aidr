/*
  review-moderation-schema.sql - anti review-bombing columns + reports table.

  Adds CountsTowardRating / ModerationStatus / TrustReleaseAt on ProductReviews
  and dbo.ProductReviewReports for seller/buyer reports + admin queue.

  Safe to re-run.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

IF COL_LENGTH('dbo.ProductReviews', 'CountsTowardRating') IS NULL
BEGIN
    ALTER TABLE dbo.ProductReviews
        ADD CountsTowardRating BIT NOT NULL
            CONSTRAINT DF_ProductReviews_CountsTowardRating DEFAULT (1);
    PRINT N'Added ProductReviews.CountsTowardRating';
END;
GO

IF COL_LENGTH('dbo.ProductReviews', 'ModerationStatus') IS NULL
BEGIN
    ALTER TABLE dbo.ProductReviews
        ADD ModerationStatus NVARCHAR(20) NOT NULL
            CONSTRAINT DF_ProductReviews_ModerationStatus DEFAULT (N'Approved');
    PRINT N'Added ProductReviews.ModerationStatus';
END;
GO

IF COL_LENGTH('dbo.ProductReviews', 'TrustReleaseAt') IS NULL
BEGIN
    ALTER TABLE dbo.ProductReviews
        ADD TrustReleaseAt DATETIME2(3) NULL;
    PRINT N'Added ProductReviews.TrustReleaseAt';
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_ProductReviews_ModerationStatus'
      AND parent_object_id = OBJECT_ID(N'dbo.ProductReviews')
)
BEGIN
    ALTER TABLE dbo.ProductReviews
        ADD CONSTRAINT CK_ProductReviews_ModerationStatus
        CHECK (ModerationStatus IN (
            N'Approved', N'PendingTrust', N'Reported', N'HiddenByAdmin', N'HiddenByOwner'
        ));
    PRINT N'Added CK_ProductReviews_ModerationStatus';
END;
GO

IF OBJECT_ID('dbo.ProductReviewReports', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProductReviewReports (
        ReportId        UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProductReviewReports PRIMARY KEY
                        CONSTRAINT DF_ProductReviewReports_Id DEFAULT (NEWSEQUENTIALID()),
        ReviewId        UNIQUEIDENTIFIER NOT NULL,
        ReporterUserId  UNIQUEIDENTIFIER NOT NULL,
        Reason          NVARCHAR(40)     NOT NULL,
        Details         NVARCHAR(500)    NULL,
        Status          NVARCHAR(20)     NOT NULL CONSTRAINT DF_ProductReviewReports_Status DEFAULT (N'Open'),
        CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_ProductReviewReports_CreatedAt DEFAULT (SYSUTCDATETIME()),
        ResolvedAt      DATETIME2(3)     NULL,
        ResolvedBy      UNIQUEIDENTIFIER NULL,
        CONSTRAINT FK_ProductReviewReports_Review FOREIGN KEY (ReviewId)
            REFERENCES dbo.ProductReviews (ReviewId),
        CONSTRAINT FK_ProductReviewReports_Reporter FOREIGN KEY (ReporterUserId)
            REFERENCES dbo.Users (UserId),
        CONSTRAINT FK_ProductReviewReports_Resolver FOREIGN KEY (ResolvedBy)
            REFERENCES dbo.Users (UserId),
        CONSTRAINT CK_ProductReviewReports_Status CHECK (Status IN (N'Open', N'Dismissed', N'Upheld')),
        CONSTRAINT CK_ProductReviewReports_Reason CHECK (Reason IN (
            N'Spam', N'Offensive', N'Irrelevant', N'Fake', N'Other'
        ))
    );

    CREATE UNIQUE INDEX UX_ProductReviewReports_Open
        ON dbo.ProductReviewReports (ReviewId, ReporterUserId)
        WHERE Status = N'Open';

    CREATE INDEX IX_ProductReviewReports_Status_CreatedAt
        ON dbo.ProductReviewReports (Status, CreatedAt DESC);

    PRINT N'Created dbo.ProductReviewReports';
END;
GO

/* Backfill: visible reviews without status stay Approved + count toward rating */
UPDATE dbo.ProductReviews
SET ModerationStatus = N'Approved',
    CountsTowardRating = CASE WHEN IsVisible = 1 THEN 1 ELSE 0 END
WHERE ModerationStatus IS NULL
   OR ModerationStatus = N'';
GO
