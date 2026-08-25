-- Align wallet balance check with BR-R04 (RefundDebit may drive AvailableBalance negative).
-- Run once on existing AIDR databases that still have the old constraint.

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_Wallets_Balance'
      AND parent_object_id = OBJECT_ID(N'dbo.Wallets')
)
BEGIN
    ALTER TABLE dbo.Wallets DROP CONSTRAINT CK_Wallets_Balance;
END
GO

ALTER TABLE dbo.Wallets
    ADD CONSTRAINT CK_Wallets_Balance CHECK (PendingBalance >= 0);
GO
