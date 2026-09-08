/*
  seed-product-qa.sql — demo Q&A on TechZone catalog products.

  Prerequisites:
    - POST /api/dev/seed-demo-accounts
    - POST /api/dev/seed-catalog (or seed-electronics-refresh)
  Idempotent: fixed question ids.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @BuyerId UNIQUEIDENTIFIER = 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC';
DECLARE @SellerId UNIQUEIDENTIFIER = 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB';
DECLARE @QuestionId UNIQUEIDENTIFIER = 'E1111111-1111-1111-1111-111111111111';
DECLARE @AnswerId UNIQUEIDENTIFIER = 'E2222222-2222-2222-2222-222222222222';

DECLARE @ProductId UNIQUEIDENTIFIER = (
    SELECT TOP (1) p.ProductId
    FROM dbo.Products p
    WHERE p.Status = N'Approved'
    ORDER BY p.CreatedAt DESC
);

IF @ProductId IS NULL
BEGIN
    RAISERROR(N'No approved product found. Run catalog seed first.', 16, 1);
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.ProductQuestions WHERE QuestionId = @QuestionId)
BEGIN
    INSERT INTO dbo.ProductQuestions (QuestionId, ProductId, UserId, Content, Status, CreatedAt)
    VALUES (
        @QuestionId,
        @ProductId,
        @BuyerId,
        N'Is this item covered by an official warranty in Vietnam?',
        N'Visible',
        DATEADD(DAY, -2, SYSUTCDATETIME())
    );
    PRINT N'Inserted demo product question.';
END;

IF NOT EXISTS (SELECT 1 FROM dbo.ProductAnswers WHERE AnswerId = @AnswerId)
BEGIN
    INSERT INTO dbo.ProductAnswers (AnswerId, QuestionId, UserId, Content, IsOfficial, CreatedAt)
    VALUES (
        @AnswerId,
        @QuestionId,
        @SellerId,
        N'Yes — all TechZone electronics include a 12-month shop warranty plus manufacturer support where applicable.',
        1,
        DATEADD(DAY, -1, SYSUTCDATETIME())
    );
    PRINT N'Inserted demo seller answer.';
END;

PRINT N'Product Q&A demo seed completed.';
GO
