/*
  product-qa-schema.sql — public product Q&A threads.

  See docs/solution-v2-engagement-growth.md.
  Safe to re-run.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('dbo.ProductQuestions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProductQuestions (
        QuestionId   UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProductQuestions PRIMARY KEY
                     CONSTRAINT DF_ProductQuestions_Id DEFAULT (NEWSEQUENTIALID()),
        ProductId    UNIQUEIDENTIFIER NOT NULL,
        UserId       UNIQUEIDENTIFIER NOT NULL,
        Content      NVARCHAR(1000)   NOT NULL,
        Status       NVARCHAR(20)     NOT NULL CONSTRAINT DF_ProductQuestions_Status DEFAULT (N'Visible'),
        CreatedAt    DATETIME2(3)     NOT NULL CONSTRAINT DF_ProductQuestions_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_ProductQuestion_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId),
        CONSTRAINT FK_ProductQuestion_User FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
        CONSTRAINT CK_ProductQuestion_Status CHECK (Status IN (N'Visible', N'Hidden'))
    );

    CREATE INDEX IX_ProductQuestion_Product ON dbo.ProductQuestions (ProductId, Status, CreatedAt DESC);
    PRINT N'Created dbo.ProductQuestions';
END;
GO

IF OBJECT_ID('dbo.ProductAnswers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProductAnswers (
        AnswerId     UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProductAnswers PRIMARY KEY
                     CONSTRAINT DF_ProductAnswers_Id DEFAULT (NEWSEQUENTIALID()),
        QuestionId   UNIQUEIDENTIFIER NOT NULL,
        UserId       UNIQUEIDENTIFIER NOT NULL,
        Content      NVARCHAR(2000)   NOT NULL,
        IsOfficial   BIT              NOT NULL CONSTRAINT DF_ProductAnswers_IsOfficial DEFAULT (0),
        CreatedAt    DATETIME2(3)     NOT NULL CONSTRAINT DF_ProductAnswers_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_ProductAnswer_Question FOREIGN KEY (QuestionId) REFERENCES dbo.ProductQuestions (QuestionId) ON DELETE CASCADE,
        CONSTRAINT FK_ProductAnswer_User FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId)
    );

    CREATE INDEX IX_ProductAnswer_Question ON dbo.ProductAnswers (QuestionId, CreatedAt);
    PRINT N'Created dbo.ProductAnswers';
END;
GO
