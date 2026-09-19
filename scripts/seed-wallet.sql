/*
  AIDR - Seller Wallet ledger demo seed (UC-85)
  Prerequisites: POST /api/dev/seed-demo-accounts (demo seller shop + wallet).
  Idempotent by Note prefix WAL-SEED-NN on WalletTransactions.

  Covers:
  - OrderCredit / RefundDebit / Withdrawal / Adjustment (filter chips)
  - Positive + negative amounts, running BalanceAfter
  - 25 rows → pagination (pageSize 20)
  - Updates Wallets.AvailableBalance to match final ledger balance
*/

SET NOCOUNT ON;

DECLARE
    @ShopId   UNIQUEIDENTIFIER = 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD',
    @WalletId UNIQUEIDENTIFIER,
    @Now      DATETIME2(3) = SYSUTCDATETIME(),
    @FinalAvailable DECIMAL(18,2) = 12350000.00;

IF NOT EXISTS (SELECT 1 FROM dbo.Shops WHERE ShopId = @ShopId)
    SELECT TOP (1) @ShopId = ShopId FROM dbo.Shops WHERE Status = N'Active' ORDER BY CreatedAt;

IF @ShopId IS NULL
BEGIN
    RAISERROR(N'Demo shop missing. Run POST /api/dev/seed-demo-accounts first.', 16, 1);
    RETURN;
END;

SELECT @WalletId = WalletId FROM dbo.Wallets WHERE ShopId = @ShopId;

IF @WalletId IS NULL
BEGIN
    SET @WalletId = 'E1000001-0001-4000-8000-000000000001';
    INSERT INTO dbo.Wallets (WalletId, ShopId, AvailableBalance, PendingBalance, Currency, UpdatedAt)
    VALUES (@WalletId, @ShopId, 0, 0, 'VND', @Now);
END;

/* Skip if already seeded */
IF EXISTS (
    SELECT 1
    FROM dbo.WalletTransactions
    WHERE WalletId = @WalletId
      AND Note LIKE N'WAL-SEED-%'
)
BEGIN
    PRINT N'Wallet demo seed already present - skipped.';
    RETURN;
END;

/*
  Chronological insert (oldest first). Amounts signed; BalanceAfter is running available.
  Final available = 12,350,000 VND.
*/
INSERT INTO dbo.WalletTransactions (WalletId, TxType, Amount, BalanceAfter, ReferenceType, ReferenceId, Note, CreatedAt)
VALUES
(@WalletId, N'OrderCredit',   2500000.00,  2500000.00, N'Order',         NULL, N'WAL-SEED-01 | Order credit for WAL-ORD-001', DATEADD(DAY, -45, @Now)),
(@WalletId, N'OrderCredit',   1800000.00,  4300000.00, N'Order',         NULL, N'WAL-SEED-02 | Order credit for WAL-ORD-002', DATEADD(DAY, -43, @Now)),
(@WalletId, N'Adjustment',     200000.00,  4500000.00, N'Adjustment',    NULL, N'WAL-SEED-03 | Opening balance correction', DATEADD(DAY, -42, @Now)),
(@WalletId, N'Withdrawal',    -500000.00,  4000000.00, N'Withdrawal',    NULL, N'WAL-SEED-04 | Bank transfer to seller account', DATEADD(DAY, -40, @Now)),
(@WalletId, N'OrderCredit',   3200000.00,  7200000.00, N'Order',         NULL, N'WAL-SEED-05 | Order credit for WAL-ORD-003', DATEADD(DAY, -38, @Now)),
(@WalletId, N'RefundDebit',   -450000.00,  6750000.00, N'ReturnRequest', NULL, N'WAL-SEED-06 | Refund debit for return on WAL-ORD-002', DATEADD(DAY, -36, @Now)),
(@WalletId, N'OrderCredit',   1500000.00,  8250000.00, N'Order',         NULL, N'WAL-SEED-07 | Order credit for WAL-ORD-004', DATEADD(DAY, -34, @Now)),
(@WalletId, N'OrderCredit',    980000.00,  9230000.00, N'Order',         NULL, N'WAL-SEED-08 | Order credit for WAL-ORD-005', DATEADD(DAY, -32, @Now)),
(@WalletId, N'Withdrawal',   -1000000.00,  8230000.00, N'Withdrawal',    NULL, N'WAL-SEED-09 | Weekly payout withdrawal', DATEADD(DAY, -30, @Now)),
(@WalletId, N'OrderCredit',   2750000.00, 10980000.00, N'Order',         NULL, N'WAL-SEED-10 | Order credit for WAL-ORD-006', DATEADD(DAY, -28, @Now)),
(@WalletId, N'Adjustment',    -150000.00, 10830000.00, N'Adjustment',    NULL, N'WAL-SEED-11 | Fee adjustment (payment gateway)', DATEADD(DAY, -26, @Now)),
(@WalletId, N'OrderCredit',   2100000.00, 12930000.00, N'Order',         NULL, N'WAL-SEED-12 | Order credit for WAL-ORD-007', DATEADD(DAY, -24, @Now)),
(@WalletId, N'RefundDebit',   -320000.00, 12610000.00, N'ReturnRequest', NULL, N'WAL-SEED-13 | Refund debit for return on WAL-ORD-005', DATEADD(DAY, -22, @Now)),
(@WalletId, N'OrderCredit',   1650000.00, 14260000.00, N'Order',         NULL, N'WAL-SEED-14 | Order credit for WAL-ORD-008', DATEADD(DAY, -20, @Now)),
(@WalletId, N'OrderCredit',    890000.00, 15150000.00, N'Order',         NULL, N'WAL-SEED-15 | Order credit for WAL-ORD-009', DATEADD(DAY, -18, @Now)),
(@WalletId, N'Withdrawal',   -2000000.00, 13150000.00, N'Withdrawal',    NULL, N'WAL-SEED-16 | Mid-month payout withdrawal', DATEADD(DAY, -16, @Now)),
(@WalletId, N'OrderCredit',   3400000.00, 16550000.00, N'Order',         NULL, N'WAL-SEED-17 | Order credit for WAL-ORD-010', DATEADD(DAY, -14, @Now)),
(@WalletId, N'RefundDebit',   -780000.00, 15770000.00, N'ReturnRequest', NULL, N'WAL-SEED-18 | Refund debit for return on WAL-ORD-007', DATEADD(DAY, -12, @Now)),
(@WalletId, N'OrderCredit',   1250000.00, 17020000.00, N'Order',         NULL, N'WAL-SEED-19 | Order credit for WAL-ORD-011', DATEADD(DAY, -10, @Now)),
(@WalletId, N'Adjustment',     50000.00, 17070000.00, N'Adjustment',    NULL, N'WAL-SEED-20 | Goodwill credit adjustment', DATEADD(DAY, -9, @Now)),
(@WalletId, N'OrderCredit',   1980000.00, 19050000.00, N'Order',         NULL, N'WAL-SEED-21 | Order credit for WAL-ORD-012', DATEADD(DAY, -7, @Now)),
(@WalletId, N'Withdrawal',   -3500000.00, 15550000.00, N'Withdrawal',    NULL, N'WAL-SEED-22 | Large payout withdrawal', DATEADD(DAY, -5, @Now)),
(@WalletId, N'OrderCredit',   1120000.00, 16670000.00, N'Order',         NULL, N'WAL-SEED-23 | Order credit for WAL-ORD-013', DATEADD(DAY, -3, @Now)),
(@WalletId, N'RefundDebit',   -220000.00, 16450000.00, N'ReturnRequest', NULL, N'WAL-SEED-24 | Refund debit for return on WAL-ORD-011', DATEADD(DAY, -2, @Now)),
(@WalletId, N'Withdrawal',   -4100000.00, 12350000.00, N'Withdrawal',    NULL, N'WAL-SEED-25 | End-of-period payout withdrawal', DATEADD(DAY, -1, @Now));

UPDATE dbo.Wallets
SET AvailableBalance = @FinalAvailable,
    UpdatedAt = @Now
WHERE WalletId = @WalletId;

PRINT N'Wallet demo seed completed.';
