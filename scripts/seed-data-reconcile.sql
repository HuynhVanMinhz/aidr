/*
  seed-data-reconcile.sql — sync denormalized counters and fix common seed drift.

  Run AFTER feature seed scripts (especially seed-inventory-lots.sql).
  Idempotent; safe to re-run.

  Fixes:
    - InventoryLots backfill for products missing lot coverage
    - Products.StockQuantity / AvgCostPrice from lots
    - Products.ReservedQuantity capped to available stock
    - Shops.ProductCount, FollowerCount, AvgRating, RatingCount
    - Products.ReviewCount / AvgRating from visible reviews
    - Wallets for every shop
    - Vouchers.UsedCount from redemptions
    - Shop ProductCount on demo shop
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

BEGIN TRAN;

/* -------------------------------------------------------------------------- */
/* 1. Backfill missing InventoryLots (same rule as seed-inventory-lots.sql)   */
/* -------------------------------------------------------------------------- */
IF OBJECT_ID('tempdb..#Gap') IS NOT NULL DROP TABLE #Gap;

SELECT
    p.ProductId,
    p.ShopId,
    s.OwnerUserId,
    p.Currency,
    Gap = p.StockQuantity - ISNULL(l.Remaining, 0),
    UnitCost = CAST(
        ROUND(COALESCE(p.AvgCostPrice, COALESCE(p.SalePrice, p.BasePrice) * 0.72), 2)
        AS DECIMAL(18, 2)),
    LotCode = N'LOT-OPENING-' + CONVERT(NVARCHAR(8), @Now, 112) + N'-'
        + RIGHT(N'00000000' + CAST(ABS(CHECKSUM(p.ProductId)) % 100000000 AS NVARCHAR(8)), 8)
INTO #Gap
FROM dbo.Products p
INNER JOIN dbo.Shops s ON s.ShopId = p.ShopId
LEFT JOIN (
    SELECT ProductId, Remaining = SUM(QuantityRemaining)
    FROM dbo.InventoryLots
    WHERE Status <> N'Void'
    GROUP BY ProductId
) l ON l.ProductId = p.ProductId
WHERE p.StockQuantity - ISNULL(l.Remaining, 0) > 0;

UPDATE #Gap SET UnitCost = 0 WHERE UnitCost IS NULL OR UnitCost < 0;

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
    N'Opening balance backfilled during data reconcile'
FROM #Gap g
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.InventoryLots il
    WHERE il.ProductId = g.ProductId AND il.LotCode = g.LotCode
);

INSERT INTO dbo.InventoryTransactions (
    ProductId, LotId, ChangeQty, UnitCost, Reason, ReferenceType, ReferenceId, Note, CreatedBy, CreatedAt
)
SELECT
    n.ProductId, n.LotId, n.Quantity, n.UnitCost,
    N'StockIn', N'Lot', n.LotId, N'Opening balance reconcile', n.CreatedBy, @Now
FROM #NewLots n
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.InventoryTransactions t
    WHERE t.LotId = n.LotId AND t.Reason = N'StockIn'
);

/* -------------------------------------------------------------------------- */
/* 2. Re-sync Products stock / cost from lots                                 */
/* -------------------------------------------------------------------------- */
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
WHERE p.StockQuantity <> ISNULL(l.Remaining, 0)
   OR (p.AvgCostPrice IS NULL AND ISNULL(l.Remaining, 0) > 0)
   OR (p.AvgCostPrice IS NOT NULL AND ISNULL(l.Remaining, 0) = 0);

/* Cap reserved qty — cannot exceed on-hand stock */
UPDATE dbo.Products
SET ReservedQuantity = StockQuantity, UpdatedAt = @Now
WHERE ReservedQuantity > StockQuantity;

/* -------------------------------------------------------------------------- */
/* 3. Shop denormalized counters                                              */
/* -------------------------------------------------------------------------- */
UPDATE s
SET
    s.ProductCount = ISNULL(pc.Cnt, 0),
    s.UpdatedAt = @Now
FROM dbo.Shops s
LEFT JOIN (
    SELECT ShopId, Cnt = COUNT(*)
    FROM dbo.Products
    WHERE Status = N'Approved'
    GROUP BY ShopId
) pc ON pc.ShopId = s.ShopId
WHERE s.ProductCount <> ISNULL(pc.Cnt, 0);

UPDATE s
SET
    s.FollowerCount = ISNULL(fc.Cnt, 0),
    s.UpdatedAt = @Now
FROM dbo.Shops s
LEFT JOIN (
    SELECT ShopId, Cnt = COUNT(*)
    FROM dbo.SellerFollows
    GROUP BY ShopId
) fc ON fc.ShopId = s.ShopId
WHERE s.FollowerCount <> ISNULL(fc.Cnt, 0);

UPDATE s
SET
    s.RatingCount = ISNULL(sr.Cnt, 0),
    s.AvgRating = ISNULL(sr.AvgScore, 0),
    s.UpdatedAt = @Now
FROM dbo.Shops s
LEFT JOIN (
    SELECT ShopId, Cnt = COUNT(*), AvgScore = CAST(AVG(CAST(Score AS DECIMAL(5,2))) AS DECIMAL(3,2))
    FROM dbo.SellerRatings
    GROUP BY ShopId
) sr ON sr.ShopId = s.ShopId
WHERE s.RatingCount <> ISNULL(sr.Cnt, 0)
   OR s.AvgRating <> ISNULL(sr.AvgScore, 0);

/* -------------------------------------------------------------------------- */
/* 4. Product review aggregates                                               */
/* -------------------------------------------------------------------------- */
UPDATE p
SET
    p.ReviewCount = ISNULL(rv.Cnt, 0),
    p.AvgRating = ISNULL(rv.AvgRating, 0),
    p.UpdatedAt = @Now
FROM dbo.Products p
LEFT JOIN (
    SELECT
        ProductId,
        Cnt = COUNT(*),
        AvgRating = CAST(ROUND(AVG(CAST(Rating AS DECIMAL(5,2))), 2) AS DECIMAL(3,2))
    FROM dbo.ProductReviews
    WHERE IsVisible = 1
    GROUP BY ProductId
) rv ON rv.ProductId = p.ProductId
WHERE p.ReviewCount <> ISNULL(rv.Cnt, 0)
   OR p.AvgRating <> ISNULL(rv.AvgRating, 0);

/* -------------------------------------------------------------------------- */
/* 5. Wallets for all shops                                                   */
/* -------------------------------------------------------------------------- */
INSERT INTO dbo.Wallets (WalletId, ShopId, AvailableBalance, PendingBalance, Currency, UpdatedAt)
SELECT NEWID(), s.ShopId, 0, 0, N'VND', @Now
FROM dbo.Shops s
WHERE NOT EXISTS (SELECT 1 FROM dbo.Wallets w WHERE w.ShopId = s.ShopId);

/* -------------------------------------------------------------------------- */
/* 6. Voucher used counts                                                     */
/* -------------------------------------------------------------------------- */
UPDATE v
SET
    v.UsedCount = ISNULL(r.Cnt, 0),
    v.UpdatedAt = @Now
FROM dbo.Vouchers v
LEFT JOIN (
    SELECT VoucherId, Cnt = COUNT(*)
    FROM dbo.VoucherRedemptions
    GROUP BY VoucherId
) r ON r.VoucherId = v.VoucherId
WHERE v.UsedCount <> ISNULL(r.Cnt, 0);

COMMIT;

PRINT N'Data reconcile completed at ' + CONVERT(NVARCHAR(30), @Now, 126);
