/*
  seed-settlement-test-10k.sql
  Seed a 10,000 VND eligible settlement entry for seller@aidr.local (TechZone Official).

  Prerequisites:
    - DemoAccountsSeeder must have run (seller + shop exist)
    - settlement-schema.sql must have run

  What this does:
    1. Inserts a dummy Completed order (10,000 VND) for the seller's shop
    2. Inserts a SettlementEntry already in 'Eligible' state (hold window expired)
    3. Upserts a Verified bank account on the shop so canPayout = true
    4. Updates the shop's wallet PendingBalance

  Safe to re-run (guarded by UQ_Settle_Order and UX_ShopBank_Default).
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

DECLARE @Now      DATETIME2(3) = SYSUTCDATETIME();
DECLARE @ShopId   UNIQUEIDENTIFIER = N'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD'; -- TechZone Official
DECLARE @BuyerId  UNIQUEIDENTIFIER = N'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC'; -- buyer@aidr.local
DECLARE @AdminId  UNIQUEIDENTIFIER = N'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA'; -- admin@aidr.local
DECLARE @OrderId  UNIQUEIDENTIFIER = N'EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE'; -- fixed so idempotent

DECLARE @Gross    DECIMAL(18,2) = 10000;
DECLARE @Rate     DECIMAL(6,4)  = 0.03;
DECLARE @Fee      DECIMAL(18,2) = ROUND(@Gross * @Rate, 0);
DECLARE @Net      DECIMAL(18,2) = @Gross - @Fee;

BEGIN TRAN;

/* 1. Dummy completed order */
IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE OrderId = @OrderId)
BEGIN
    INSERT INTO dbo.Orders (
        OrderId, OrderCode, BuyerUserId, ShopId,
        ShippingSnapshotJson, Status,
        SubtotalAmount, DiscountAmount, ShippingFee, TotalAmount, Currency,
        PaidAt, CompletedAt, CreatedAt, UpdatedAt
    ) VALUES (
        @OrderId, N'ORD-TEST-10K', @BuyerId, @ShopId,
        N'{}', N'Completed',
        @Gross, 0, 0, @Gross, N'VND',
        DATEADD(DAY, -35, @Now), DATEADD(DAY, -32, @Now),
        DATEADD(DAY, -35, @Now), @Now
    );
    PRINT N'Inserted dummy order ORD-TEST-10K';
END;

/* 2. Eligible settlement entry (hold window already expired) */
IF NOT EXISTS (SELECT 1 FROM dbo.SettlementEntries WHERE OrderId = @OrderId)
BEGIN
    INSERT INTO dbo.SettlementEntries (
        SettlementEntryId, OrderId, ShopId,
        GrossAmount, SubsidyAmount, CommissionRate, CommissionAmount, NetAmount, Currency,
        Status, HoldUntil, EligibleAt, CreatedAt, UpdatedAt
    ) VALUES (
        NEWID(), @OrderId, @ShopId,
        @Gross, 0, @Rate, @Fee, @Net, N'VND',
        N'Eligible',
        DATEADD(DAY, -2, @Now),   -- HoldUntil already passed
        DATEADD(DAY, -2, @Now),   -- EligibleAt
        @Now, @Now
    );
    PRINT N'Inserted Eligible settlement entry: gross=' + CAST(@Gross AS NVARCHAR(20))
        + N', fee=' + CAST(@Fee AS NVARCHAR(20))
        + N', net=' + CAST(@Net AS NVARCHAR(20));
END;

/* 3. Verified bank account (upsert) */
IF NOT EXISTS (SELECT 1 FROM dbo.ShopBankAccounts WHERE ShopId = @ShopId)
BEGIN
    INSERT INTO dbo.ShopBankAccounts (
        ShopBankAccountId, ShopId,
        BankBin, BankName, AccountNumber, AccountName,
        Status, IsDefault,
        VerifiedBy, VerifiedAt,
        CreatedAt, UpdatedAt
    ) VALUES (
        NEWID(), @ShopId,
        N'970422', N'MB Bank', N'1234567890', N'Alex Seller',
        N'Verified', 1,
        @AdminId, @Now,
        @Now, @Now
    );
    PRINT N'Inserted Verified bank account (MB Bank 1234567890)';
END
ELSE
BEGIN
    UPDATE dbo.ShopBankAccounts
    SET Status = N'Verified', VerifiedBy = @AdminId, VerifiedAt = @Now, UpdatedAt = @Now
    WHERE ShopId = @ShopId;
    PRINT N'Updated bank account to Verified';
END;

/* 4. Sync wallet PendingBalance */
UPDATE dbo.Wallets
SET PendingBalance = ISNULL((
        SELECT SUM(NetAmount)
        FROM dbo.SettlementEntries
        WHERE ShopId = @ShopId AND Status IN (N'Holding', N'OnHold', N'Eligible')
    ), 0),
    UpdatedAt = @Now
WHERE ShopId = @ShopId;

COMMIT;

PRINT N'Done. Run settlement sweep (or call POST /api/admin/settlements/sweep) to trigger auto-payout.';

/* Verify */
SELECT
    e.Status, e.GrossAmount, e.CommissionAmount, e.NetAmount, e.EligibleAt,
    b.BankName, b.AccountNumber, b.Status AS BankStatus
FROM dbo.SettlementEntries e
JOIN dbo.ShopBankAccounts b ON b.ShopId = e.ShopId
WHERE e.OrderId = @OrderId;
