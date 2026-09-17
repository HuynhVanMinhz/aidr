/*
  AIDR — Expand ReturnRequests CHECK constraints for Admin→Seller pipeline.

  Old CK_ReturnRequests_Status only allowed:
    Pending | Approved | Rejected | Receiving | Refunded | Closed
  Missing statuses used by the app:
    SellerConfirmed | Accepted | Exchanged

  Old CK_ReturnRequests_Resolution only allowed ReturnRefund (Exchange blocked).

  Idempotent. Safe to re-run on VPS / production.

  VPS (SQL in Docker), from host:
    docker cp scripts/alter-return-pipeline-statuses.sql aidr-sqlserver:/tmp/alter-return-pipeline-statuses.sql
    docker exec -i aidr-sqlserver /opt/mssql-tools18/bin/sqlcmd \
      -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -d AIDR \
      -i /tmp/alter-return-pipeline-statuses.sql
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

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_ReturnRequests_Status'
      AND parent_object_id = OBJECT_ID(N'dbo.ReturnRequests')
)
BEGIN
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
END
ELSE
    PRINT N'CK_ReturnRequests_Status already present — skipped';
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

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_ReturnRequests_Resolution'
      AND parent_object_id = OBJECT_ID(N'dbo.ReturnRequests')
)
BEGIN
    ALTER TABLE dbo.ReturnRequests
        ADD CONSTRAINT CK_ReturnRequests_Resolution
            CHECK (ResolutionType IN (N'ReturnRefund', N'Exchange'));
    PRINT N'Added CK_ReturnRequests_Resolution (ReturnRefund | Exchange)';
END
ELSE
    PRINT N'CK_ReturnRequests_Resolution already present — skipped';
GO

/* Verify */
SELECT c.name AS ConstraintName, c.definition
FROM sys.check_constraints c
WHERE c.parent_object_id = OBJECT_ID(N'dbo.ReturnRequests')
ORDER BY c.name;
GO
