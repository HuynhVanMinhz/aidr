/*
  review-digest-schema.sql - cached AI review digest snapshots per product.

  See docs/solution-ai-review-digest.md.
  Safe to re-run.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('dbo.ProductReviewDigestSnapshots', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProductReviewDigestSnapshots (
        ProductId   UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProductReviewDigestSnapshots PRIMARY KEY,
        ReviewCount INT              NOT NULL,
        DigestJson  NVARCHAR(MAX)    NOT NULL,
        Source      NVARCHAR(20)     NOT NULL,
        GeneratedAt DATETIME2(3)     NOT NULL,
        CONSTRAINT FK_Digest_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId)
    );

    PRINT N'Created dbo.ProductReviewDigestSnapshots';
END;
GO
