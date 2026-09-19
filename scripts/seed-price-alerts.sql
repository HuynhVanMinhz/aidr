/*
  seed-price-alerts.sql - demo price history rows + buyer alerts.
  Prerequisites: demo buyer, approved products (seed-demo-accounts, catalog seeds).
*/
SET NOCOUNT ON;

DECLARE @BuyerId UNIQUEIDENTIFIER = (
    SELECT TOP 1 UserId FROM dbo.Users WHERE Email = N'buyer@aidr.local'
);
DECLARE @ProductId UNIQUEIDENTIFIER = (
    SELECT TOP 1 ProductId FROM dbo.Products WHERE Status = N'Approved' ORDER BY CreatedAt
);
DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

IF @BuyerId IS NULL OR @ProductId IS NULL
BEGIN
    PRINT N'seed-price-alerts: skipped - missing demo buyer or approved product.';
    RETURN;
END;

IF NOT EXISTS (
    SELECT 1 FROM dbo.ProductPriceHistories WHERE ProductId = @ProductId AND Reason = N'SEED-PRICE-HISTORY'
)
BEGIN
    DECLARE @Base DECIMAL(18,2) = (SELECT BasePrice FROM dbo.Products WHERE ProductId = @ProductId);

    INSERT INTO dbo.ProductPriceHistories (ProductId, OldBasePrice, NewBasePrice, OldSalePrice, NewSalePrice, Reason, ChangedAt)
    VALUES
        (@ProductId, @Base, @Base, NULL, @Base * 0.95, N'SEED-PRICE-HISTORY', DATEADD(DAY, -60, @Now)),
        (@ProductId, @Base, @Base * 0.98, @Base * 0.95, @Base * 0.92, N'SEED-PRICE-HISTORY', DATEADD(DAY, -30, @Now)),
        (@ProductId, @Base * 0.98, @Base * 0.95, @Base * 0.92, @Base * 0.88, N'SEED-PRICE-HISTORY', DATEADD(DAY, -7, @Now));

    UPDATE dbo.Products
    SET BasePrice = @Base * 0.95,
        SalePrice = @Base * 0.88
    WHERE ProductId = @ProductId;

    PRINT N'seed-price-alerts: inserted price history points.';
END;

IF OBJECT_ID('dbo.ProductPriceAlerts', 'U') IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM dbo.ProductPriceAlerts
    WHERE UserId = @BuyerId AND ProductId = @ProductId AND AlertType = N'PriceDrop'
)
BEGIN
    INSERT INTO dbo.ProductPriceAlerts (UserId, ProductId, AlertType, BaselinePrice, ThresholdPct, ThresholdAmount, IsActive, ExpiresAt)
    VALUES (@BuyerId, @ProductId, N'PriceDrop', (SELECT SalePrice FROM dbo.Products WHERE ProductId = @ProductId), 5.00, 50000, 1, DATEADD(DAY, 90, @Now));

    PRINT N'seed-price-alerts: created demo price drop alert.';
END;

PRINT N'seed-price-alerts: done.';
