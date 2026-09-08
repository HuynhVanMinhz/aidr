/*
  price-alert-schema.sql — buyer price drop / back-in-stock alerts.

  See docs/solution-price-alerts-and-history.md.
  Safe to re-run.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('dbo.ProductPriceAlerts', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProductPriceAlerts (
        PriceAlertId     UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProductPriceAlerts PRIMARY KEY
                         CONSTRAINT DF_ProductPriceAlerts_Id DEFAULT (NEWSEQUENTIALID()),
        UserId           UNIQUEIDENTIFIER NOT NULL,
        ProductId        UNIQUEIDENTIFIER NOT NULL,
        AlertType        NVARCHAR(20)     NOT NULL,
        BaselinePrice    DECIMAL(18,2)    NULL,
        ThresholdPct     DECIMAL(5,2)     NOT NULL CONSTRAINT DF_PriceAlert_ThresholdPct DEFAULT (5.00),
        ThresholdAmount  DECIMAL(18,2)    NOT NULL CONSTRAINT DF_PriceAlert_ThresholdAmt DEFAULT (50000),
        IsActive         BIT              NOT NULL CONSTRAINT DF_PriceAlert_IsActive DEFAULT (1),
        LastTriggeredAt  DATETIME2(3)     NULL,
        ExpiresAt        DATETIME2(3)     NULL,
        CreatedAt        DATETIME2(3)     NOT NULL CONSTRAINT DF_PriceAlert_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_PriceAlert_User FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
        CONSTRAINT FK_PriceAlert_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products (ProductId),
        CONSTRAINT UQ_PriceAlert_User_Product_Type UNIQUE (UserId, ProductId, AlertType),
        CONSTRAINT CK_PriceAlert_Type CHECK (AlertType IN (N'PriceDrop', N'BackInStock'))
    );

    CREATE INDEX IX_PriceAlert_Active_Product ON dbo.ProductPriceAlerts (IsActive, ProductId)
        WHERE IsActive = 1;

    PRINT N'Created dbo.ProductPriceAlerts';
END;
GO
