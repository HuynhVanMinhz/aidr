/*
  seed-settlement-backfill.sql - bring existing data into the escrow model.

  Run AFTER scripts/settlement-schema.sql.

  Before escrow, `OrderRepository.CreditSellerWalletAsync` credited the seller's
  AvailableBalance with the FULL order total the moment the buyer confirmed
  receipt - no platform fee, no hold. Those orders are grandfathered at 0%: they
  get a settlement entry marked Paid so the ledger is complete, but no fee is
  clawed back. Charging 3% retroactively would push seller balances negative and
  corrupt the demo data.

  Orders completed from now on go through the real flow at the configured rate.

  Safe to re-run (guarded by UQ_Settle_Order).
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

BEGIN TRAN;

/* 1. One Paid entry per already-completed order, commission 0. */
INSERT INTO dbo.SettlementEntries (
    SettlementEntryId, OrderId, ShopId, GrossAmount, SubsidyAmount,
    CommissionRate, CommissionAmount, NetAmount, Currency, Status,
    HoldUntil, EligibleAt, CreatedAt, UpdatedAt
)
SELECT
    NEWID(),
    o.OrderId,
    o.ShopId,
    o.TotalAmount,
    0,
    0,                      -- grandfathered: no platform fee on historical orders
    0,
    o.TotalAmount,
    o.Currency,
    N'Paid',
    ISNULL(o.CompletedAt, o.UpdatedAt),
    ISNULL(o.CompletedAt, o.UpdatedAt),
    ISNULL(o.CompletedAt, o.UpdatedAt),
    @Now
FROM dbo.Orders o
WHERE o.Status = N'Completed'
  AND NOT EXISTS (SELECT 1 FROM dbo.SettlementEntries s WHERE s.OrderId = o.OrderId);

DECLARE @Completed INT = @@ROWCOUNT;

/*
  2. Orders that are Paid..Delivered were never credited under the old code and
     have no entry yet. Leave them alone - they will flow through the normal
     Completed -> hold path once the buyer confirms or the sweep auto-completes
     them, and will be charged the current commission rate. Nothing to do here.
*/

/* 3. Pending balances were never written before; recompute from the ledger. */
UPDATE w
SET
    w.PendingBalance = ISNULL(p.PendingNet, 0),
    w.UpdatedAt = @Now
FROM dbo.Wallets w
LEFT JOIN (
    SELECT s.ShopId, SUM(s.NetAmount) AS PendingNet
    FROM dbo.SettlementEntries s
    WHERE s.Status IN (N'Holding', N'OnHold', N'Eligible')
    GROUP BY s.ShopId
) p ON p.ShopId = w.ShopId;

DECLARE @Wallets INT = @@ROWCOUNT;

COMMIT;

PRINT N'Backfilled ' + CAST(@Completed AS NVARCHAR(10))
    + N' settlement entries; re-synced ' + CAST(@Wallets AS NVARCHAR(10)) + N' wallet pending balances.';

/* 4. Verification - every completed order must be accounted for. */
SELECT
    OrdersCompleted = (SELECT COUNT(*) FROM dbo.Orders WHERE Status = N'Completed'),
    EntriesTotal    = (SELECT COUNT(*) FROM dbo.SettlementEntries),
    MissingEntries  = (
        SELECT COUNT(*)
        FROM dbo.Orders o
        WHERE o.Status = N'Completed'
          AND NOT EXISTS (SELECT 1 FROM dbo.SettlementEntries s WHERE s.OrderId = o.OrderId)),
    PendingMismatch = (
        SELECT COUNT(*)
        FROM dbo.Wallets w
        LEFT JOIN (
            SELECT ShopId, SUM(NetAmount) AS PendingNet
            FROM dbo.SettlementEntries
            WHERE Status IN (N'Holding', N'OnHold', N'Eligible')
            GROUP BY ShopId
        ) p ON p.ShopId = w.ShopId
        WHERE w.PendingBalance <> ISNULL(p.PendingNet, 0));
