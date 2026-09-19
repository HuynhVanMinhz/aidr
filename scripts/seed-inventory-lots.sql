/*
  seed-inventory-lots.sql - backfill opening InventoryLots for seeded products.

  Why: checkout allocates cost lots FIFO (OrderRepository.AllocateLotsFifoAsync).
  Most seed scripts insert Products.StockQuantity directly without creating any
  InventoryLots row, so the pre-check (StockQuantity - ReservedQuantity) passes
  but FIFO allocation finds nothing and throws
  "Insufficient stock for '<product>'." for every checkout.

  This script creates one opening lot per product for the missing quantity, logs
  a StockIn inventory transaction, then re-syncs Products.StockQuantity /
  AvgCostPrice from the lots so both sides agree.

  Safe to re-run: it only tops up the gap between StockQuantity and open lots.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

BEGIN TRAN;

/* 1. Products whose on-hand stock is not backed by inventory lots */
IF OBJECT_ID('tempdb..#Gap') IS NOT NULL DROP TABLE #Gap;

SELECT
    p.ProductId,
    p.ShopId,
    s.OwnerUserId,
    p.Currency,
    Gap = p.StockQuantity - ISNULL(l.Remaining, 0),
    /* Fall back to ~72% of the selling price when no cost is known. */
    UnitCost = CAST(
        ROUND(COALESCE(p.AvgCostPrice, COALESCE(p.SalePrice, p.BasePrice) * 0.72), 2)
        AS DECIMAL(18, 2)),
    /* Unique per product and stable across re-runs on a different day. */
    LotCode = N'LOT-OPENING-' + CONVERT(NVARCHAR(8), @Now, 112) + N'-'
        + RIGHT(N'000' + CAST(ISNULL(l.LotCount, 0) + 1 AS NVARCHAR(8)), 3)
INTO #Gap
FROM dbo.Products p
INNER JOIN dbo.Shops s ON s.ShopId = p.ShopId
LEFT JOIN (
    SELECT ProductId, Remaining = SUM(QuantityRemaining), LotCount = COUNT(*)
    FROM dbo.InventoryLots
    WHERE Status <> N'Void'
    GROUP BY ProductId
) l ON l.ProductId = p.ProductId
WHERE p.StockQuantity - ISNULL(l.Remaining, 0) > 0;

/* Never write a zero/negative unit cost - CK_Lots_UnitCost requires >= 0. */
UPDATE #Gap SET UnitCost = 0 WHERE UnitCost IS NULL OR UnitCost < 0;

/* 2. Create the opening lots */
IF OBJECT_ID('tempdb..#NewLots') IS NOT NULL DROP TABLE #NewLots;
CREATE TABLE #NewLots (
    LotId UNIQUEIDENTIFIER NOT NULL,
    ProductId UNIQUEIDENTIFIER NOT NULL,
    Quantity INT NOT NULL,
    UnitCost DECIMAL(18, 2) NOT NULL,
    CreatedBy UNIQUEIDENTIFIER NULL
);

INSERT INTO dbo.InventoryLots (
    LotId, ProductId, LotCode, QuantityReceived, QuantityRemaining,
    UnitCost, Currency, SupplierName, InvoiceNumber, ReceivedAt, Status, CreatedBy, Note
)
OUTPUT inserted.LotId, inserted.ProductId, inserted.QuantityReceived, inserted.UnitCost, inserted.CreatedBy
INTO #NewLots (LotId, ProductId, Quantity, UnitCost, CreatedBy)
SELECT
    NEWID(), g.ProductId, g.LotCode, g.Gap, g.Gap,
    g.UnitCost, ISNULL(g.Currency, 'VND'), N'AIDR seed supplier', N'INV-OPENING',
    DATEADD(DAY, -30, @Now), N'Open', g.OwnerUserId,
    N'Opening balance backfilled from Products.StockQuantity'
FROM #Gap g;

/* 3. Audit trail */
INSERT INTO dbo.InventoryTransactions (
    ProductId, LotId, ChangeQty, UnitCost, Reason, ReferenceType, ReferenceId, Note, CreatedBy, CreatedAt
)
SELECT
    n.ProductId, n.LotId, n.Quantity, n.UnitCost,
    N'StockIn', N'Lot', n.LotId, N'Opening balance backfill', n.CreatedBy, @Now
FROM #NewLots n;

/* 4. Re-sync denormalised stock/cost on Products (same rule as RecalcStockAsync) */
UPDATE p
SET
    p.StockQuantity = ISNULL(l.Remaining, 0),
    p.AvgCostPrice = CASE
        WHEN ISNULL(l.Remaining, 0) = 0 THEN NULL
        ELSE CAST(ROUND(l.CostValue / l.Remaining, 2) AS DECIMAL(18, 2))
    END,
    p.UpdatedAt = @Now
FROM dbo.Products p
LEFT JOIN (
    SELECT
        ProductId,
        Remaining = SUM(QuantityRemaining),
        CostValue = SUM(QuantityRemaining * UnitCost)
    FROM dbo.InventoryLots
    WHERE Status <> N'Void'
    GROUP BY ProductId
) l ON l.ProductId = p.ProductId
WHERE EXISTS (SELECT 1 FROM #Gap g WHERE g.ProductId = p.ProductId);

DECLARE @Created INT = (SELECT COUNT(*) FROM #NewLots);
DECLARE @Units INT = (SELECT ISNULL(SUM(Quantity), 0) FROM #NewLots);

COMMIT;

PRINT N'Opening lots created: ' + CAST(@Created AS NVARCHAR(10))
    + N' (' + CAST(@Units AS NVARCHAR(10)) + N' units).';

/* 5. Verification - every product must now be lot-backed */
SELECT
    p.Name,
    p.StockQuantity,
    p.ReservedQuantity,
    LotRemaining = ISNULL(SUM(CASE WHEN l.Status = N'Open' THEN l.QuantityRemaining END), 0),
    p.AvgCostPrice
FROM dbo.Products p
LEFT JOIN dbo.InventoryLots l ON l.ProductId = p.ProductId
GROUP BY p.Name, p.StockQuantity, p.ReservedQuantity, p.AvgCostPrice
HAVING p.StockQuantity > ISNULL(SUM(CASE WHEN l.Status = N'Open' THEN l.QuantityRemaining END), 0)
ORDER BY p.Name;
