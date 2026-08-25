/*
  AIDR — Align ReturnRequests with database.sql / Return & Refund module.
  Adds ResolutionType + ReturnEvidences if missing (idempotent).
  Each ALTER in its own batch (SQL Server cannot use a new column in the same batch).
*/

SET NOCOUNT ON;
GO

IF COL_LENGTH('dbo.ReturnRequests', 'ResolutionType') IS NULL
BEGIN
    ALTER TABLE dbo.ReturnRequests
        ADD ResolutionType NVARCHAR(20) NOT NULL
            CONSTRAINT DF_ReturnRequests_Resolution DEFAULT (N'ReturnRefund');
    PRINT N'Added ReturnRequests.ResolutionType';
END
ELSE
    PRINT N'ResolutionType already present';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_ReturnRequests_Resolution'
      AND parent_object_id = OBJECT_ID(N'dbo.ReturnRequests')
)
BEGIN
    ALTER TABLE dbo.ReturnRequests
        ADD CONSTRAINT CK_ReturnRequests_Resolution
            CHECK (ResolutionType IN (N'ReturnRefund'));
    PRINT N'Added CK_ReturnRequests_Resolution';
END
GO

IF OBJECT_ID(N'dbo.ReturnEvidences', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ReturnEvidences (
        EvidenceId      UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ReturnEvidences PRIMARY KEY
                        CONSTRAINT DF_ReturnEvidences_Id DEFAULT (NEWSEQUENTIALID()),
        ReturnRequestId UNIQUEIDENTIFIER NOT NULL,
        EvidenceType    NVARCHAR(20)     NOT NULL,
        MediaUrl        NVARCHAR(512)    NOT NULL,
        PublicId        NVARCHAR(256)    NULL,
        SortOrder       INT              NOT NULL CONSTRAINT DF_ReturnEvidences_Sort DEFAULT (0),
        CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_ReturnEvidences_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_ReturnEvidences_Request FOREIGN KEY (ReturnRequestId)
            REFERENCES dbo.ReturnRequests (ReturnRequestId) ON DELETE CASCADE,
        CONSTRAINT CK_ReturnEvidences_Type CHECK (EvidenceType IN (N'Unboxing', N'Testing', N'Other'))
    );

    CREATE INDEX IX_ReturnEvidences_Request_Type
        ON dbo.ReturnEvidences (ReturnRequestId, EvidenceType);

    PRINT N'Created dbo.ReturnEvidences';
END
ELSE
    PRINT N'ReturnEvidences already present';
GO
