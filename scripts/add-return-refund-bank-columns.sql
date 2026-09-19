-- Migration: add buyer refund bank account fields to ReturnRequests
-- Run once against dev/prod DB after deploying the code changes.

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.ReturnRequests') AND name = N'RefundBankBin'
)
BEGIN
    ALTER TABLE dbo.ReturnRequests
        ADD RefundBankBin        NVARCHAR(20)  NULL,
            RefundBankName       NVARCHAR(100) NULL,
            RefundAccountNumber  NVARCHAR(50)  NULL,
            RefundAccountName    NVARCHAR(200) NULL;

    PRINT 'Added refund bank columns to ReturnRequests.';
END
ELSE
BEGIN
    PRINT 'Columns already exist, skipping.';
END
