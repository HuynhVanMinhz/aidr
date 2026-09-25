-- Migration: refund transfer proof image + notification image attachment
-- Run once against existing DB after deploying the code changes.
-- Prerequisites: ReturnRequests / Notifications tables already exist.

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.ReturnRequests') AND name = N'RefundTransferProofUrl'
)
BEGIN
    ALTER TABLE dbo.ReturnRequests
        ADD RefundTransferProofUrl NVARCHAR(512) NULL;

    PRINT 'Added RefundTransferProofUrl to ReturnRequests.';
END
ELSE
BEGIN
    PRINT 'ReturnRequests.RefundTransferProofUrl already exists, skipping.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Notifications') AND name = N'ImageUrl'
)
BEGIN
    ALTER TABLE dbo.Notifications
        ADD ImageUrl NVARCHAR(512) NULL;

    PRINT 'Added ImageUrl to Notifications.';
END
ELSE
BEGIN
    PRINT 'Notifications.ImageUrl already exists, skipping.';
END
GO
