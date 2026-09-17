/*
  AIDR — Expand ReturnRequests CHECK constraints for Admin→Seller pipeline.

  Old CK_ReturnRequests_Status only allowed:
    Pending | Approved | Rejected | Receiving | Refunded | Closed
  Missing statuses used by the app:
    SellerConfirmed | Accepted | Exchanged

  Old CK_ReturnRequests_Resolution only allowed ReturnRefund (Exchange blocked).

  Idempotent. Run on existing DBs (e.g. production / shared staging) after deploy.
*/

SET NOCOUNT ON;
GO

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_ReturnRequests_Status'
      AND parent_object_id = OBJECT_ID(N'dbo.ReturnRequests')
)
BEGIN
    ALTER TABLE dbo.ReturnRequests DROP CONSTRAINT CK_ReturnRequests_Status;
    PRINT N'Dropped CK_ReturnRequests_Status';
END
GO

ALTER TABLE dbo.ReturnRequests
    ADD CONSTRAINT CK_ReturnRequests_Status CHECK (Status IN (
        N'Pending',
        N'Approved',
        N'Rejected',
        N'SellerConfirmed',
        N'Receiving',
        N'Accepted',
        N'Refunded',
        N'Exchanged',
        N'Closed'));
PRINT N'Added CK_ReturnRequests_Status (full return pipeline)';
GO

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_ReturnRequests_Resolution'
      AND parent_object_id = OBJECT_ID(N'dbo.ReturnRequests')
)
BEGIN
    ALTER TABLE dbo.ReturnRequests DROP CONSTRAINT CK_ReturnRequests_Resolution;
    PRINT N'Dropped CK_ReturnRequests_Resolution';
END
GO

ALTER TABLE dbo.ReturnRequests
    ADD CONSTRAINT CK_ReturnRequests_Resolution
        CHECK (ResolutionType IN (N'ReturnRefund', N'Exchange'));
PRINT N'Added CK_ReturnRequests_Resolution (ReturnRefund | Exchange)';
GO
