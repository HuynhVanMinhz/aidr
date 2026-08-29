/*
  settlement-schema.sql — escrow / seller settlement / platform commission.

  See docs/solution-escrow-settlement.md.

  Buyer pays -> money lands in the platform bank account (payOS settles T+1).
  AIDR holds it on the books for HoldDays after the order is Completed, then an
  admin approves a payout batch: the shop's net is released and paid out via
  payOS Chi ho (Payouts), and the platform keeps the commission.

  Safe to re-run.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* -------------------------------------------------------------------------- */
/* 1. ShopBankAccounts — where a shop's payouts are sent                       */
/* -------------------------------------------------------------------------- */

IF OBJECT_ID('dbo.ShopBankAccounts', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ShopBankAccounts (
        ShopBankAccountId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ShopBankAccounts PRIMARY KEY
                          CONSTRAINT DF_ShopBankAccounts_Id DEFAULT (NEWSEQUENTIALID()),
        ShopId            UNIQUEIDENTIFIER NOT NULL,
        BankBin           NVARCHAR(20)     NOT NULL,   -- payOS toBin, e.g. '970422' (MB)
        BankName          NVARCHAR(150)    NULL,
        AccountNumber     NVARCHAR(40)     NOT NULL,
        AccountName       NVARCHAR(150)    NOT NULL,   -- must match the real account holder
        Status            NVARCHAR(20)     NOT NULL CONSTRAINT DF_ShopBank_Status DEFAULT (N'Unverified'),
            -- Unverified | Verified | Rejected
        IsDefault         BIT              NOT NULL CONSTRAINT DF_ShopBank_IsDefault DEFAULT (1),
        VerifiedBy        UNIQUEIDENTIFIER NULL,
        VerifiedAt        DATETIME2(3)     NULL,
        RejectReason      NVARCHAR(300)    NULL,
        CreatedAt         DATETIME2(3)     NOT NULL CONSTRAINT DF_ShopBank_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt         DATETIME2(3)     NOT NULL CONSTRAINT DF_ShopBank_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_ShopBank_Shop FOREIGN KEY (ShopId) REFERENCES dbo.Shops (ShopId),
        CONSTRAINT FK_ShopBank_VerifiedBy FOREIGN KEY (VerifiedBy) REFERENCES dbo.Users (UserId),
        CONSTRAINT CK_ShopBank_Status CHECK (Status IN (N'Unverified', N'Verified', N'Rejected'))
    );

    CREATE UNIQUE INDEX UX_ShopBank_Default ON dbo.ShopBankAccounts (ShopId) WHERE IsDefault = 1;
    PRINT N'Created dbo.ShopBankAccounts';
END;
GO

/* -------------------------------------------------------------------------- */
/* 2. SettlementEntries — one ledger row per order                            */
/* -------------------------------------------------------------------------- */

IF OBJECT_ID('dbo.SettlementEntries', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SettlementEntries (
        SettlementEntryId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SettlementEntries PRIMARY KEY
                          CONSTRAINT DF_SettlementEntries_Id DEFAULT (NEWSEQUENTIALID()),
        OrderId           UNIQUEIDENTIFIER NOT NULL,
        ShopId            UNIQUEIDENTIFIER NOT NULL,
        GrossAmount       DECIMAL(18,2)    NOT NULL,   -- Orders.TotalAmount (what the buyer paid)
        SubsidyAmount     DECIMAL(18,2)    NOT NULL CONSTRAINT DF_Settle_Subsidy DEFAULT (0),
        CommissionRate    DECIMAL(6,4)     NOT NULL,   -- snapshot, e.g. 0.0300
        CommissionAmount  DECIMAL(18,2)    NOT NULL,
        NetAmount         DECIMAL(18,2)    NOT NULL,   -- Gross - Commission
        Currency          CHAR(3)          NOT NULL CONSTRAINT DF_Settle_Currency DEFAULT ('VND'),
        Status            NVARCHAR(20)     NOT NULL CONSTRAINT DF_Settle_Status DEFAULT (N'Holding'),
            -- Holding | OnHold | Eligible | Approved | Paid | Reversed
        HoldUntil         DATETIME2(3)     NOT NULL,
        EligibleAt        DATETIME2(3)     NULL,
        PayoutBatchId     UNIQUEIDENTIFIER NULL,
        HoldReason        NVARCHAR(300)    NULL,
        ReversedReason    NVARCHAR(300)    NULL,
        CreatedAt         DATETIME2(3)     NOT NULL CONSTRAINT DF_Settle_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt         DATETIME2(3)     NOT NULL CONSTRAINT DF_Settle_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        -- One entry per order: the strongest idempotency guard we have.
        CONSTRAINT UQ_Settle_Order UNIQUE (OrderId),
        CONSTRAINT FK_Settle_Order FOREIGN KEY (OrderId) REFERENCES dbo.Orders (OrderId),
        CONSTRAINT FK_Settle_Shop FOREIGN KEY (ShopId) REFERENCES dbo.Shops (ShopId),
        CONSTRAINT CK_Settle_Status CHECK (Status IN
            (N'Holding', N'OnHold', N'Eligible', N'Approved', N'Paid', N'Reversed')),
        CONSTRAINT CK_Settle_Amounts CHECK (
            CommissionAmount >= 0 AND NetAmount >= 0 AND GrossAmount >= 0)
    );

    CREATE INDEX IX_Settle_Shop_Status_HoldUntil
        ON dbo.SettlementEntries (ShopId, Status, HoldUntil);
    CREATE INDEX IX_Settle_Batch ON dbo.SettlementEntries (PayoutBatchId);
    PRINT N'Created dbo.SettlementEntries';
END;
GO

/* -------------------------------------------------------------------------- */
/* 3. PayoutBatches — one admin approval = one batch per shop                  */
/* -------------------------------------------------------------------------- */

IF OBJECT_ID('dbo.PayoutBatches', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PayoutBatches (
        PayoutBatchId     UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_PayoutBatches PRIMARY KEY
                          CONSTRAINT DF_PayoutBatches_Id DEFAULT (NEWSEQUENTIALID()),
        BatchCode         NVARCHAR(30)     NOT NULL,   -- PAY-20260930-AB12CD34, also the payOS idempotency key
        ShopId            UNIQUEIDENTIFIER NOT NULL,
        ShopBankAccountId UNIQUEIDENTIFIER NOT NULL,
        PeriodTo          DATETIME2(3)     NOT NULL,   -- cut-off: entries eligible at or before this
        EntryCount        INT              NOT NULL,
        GrossAmount       DECIMAL(18,2)    NOT NULL,
        CommissionAmount  DECIMAL(18,2)    NOT NULL,
        NetAmount         DECIMAL(18,2)    NOT NULL,   -- amount actually transferred
        Currency          CHAR(3)          NOT NULL CONSTRAINT DF_Payout_Currency DEFAULT ('VND'),
        Status            NVARCHAR(20)     NOT NULL CONSTRAINT DF_Payout_Status DEFAULT (N'Draft'),
            -- Draft | Approved | Processing | Paid | Failed | Cancelled
        ApprovedBy        UNIQUEIDENTIFIER NULL,
        ApprovedAt        DATETIME2(3)     NULL,
        ProviderPayoutId  NVARCHAR(100)    NULL,
        ProviderState     NVARCHAR(40)     NULL,
        PaidAt            DATETIME2(3)     NULL,
        FailureReason     NVARCHAR(500)    NULL,
        AttemptCount      INT              NOT NULL CONSTRAINT DF_Payout_Attempts DEFAULT (0),
        RawResponseJson   NVARCHAR(MAX)    NULL,
        CreatedAt         DATETIME2(3)     NOT NULL CONSTRAINT DF_Payout_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt         DATETIME2(3)     NOT NULL CONSTRAINT DF_Payout_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_Payout_Code UNIQUE (BatchCode),
        CONSTRAINT FK_Payout_Shop FOREIGN KEY (ShopId) REFERENCES dbo.Shops (ShopId),
        CONSTRAINT FK_Payout_Bank FOREIGN KEY (ShopBankAccountId)
            REFERENCES dbo.ShopBankAccounts (ShopBankAccountId),
        CONSTRAINT FK_Payout_ApprovedBy FOREIGN KEY (ApprovedBy) REFERENCES dbo.Users (UserId),
        CONSTRAINT CK_Payout_Status CHECK (Status IN
            (N'Draft', N'Approved', N'Processing', N'Paid', N'Failed', N'Cancelled'))
    );

    -- At most one open batch per shop, so entries can never land in two batches.
    CREATE UNIQUE INDEX UX_Payout_OpenPerShop ON dbo.PayoutBatches (ShopId)
        WHERE Status IN (N'Draft', N'Approved', N'Processing');
    CREATE INDEX IX_Payout_Status ON dbo.PayoutBatches (Status, CreatedAt DESC);
    PRINT N'Created dbo.PayoutBatches';
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Settle_Batch')
BEGIN
    ALTER TABLE dbo.SettlementEntries
        ADD CONSTRAINT FK_Settle_Batch FOREIGN KEY (PayoutBatchId)
            REFERENCES dbo.PayoutBatches (PayoutBatchId);
    PRINT N'Added FK_Settle_Batch';
END;
GO

/* -------------------------------------------------------------------------- */
/* 4. WalletTransactions — track the pending side too                         */
/* -------------------------------------------------------------------------- */

IF COL_LENGTH('dbo.WalletTransactions', 'PendingAfter') IS NULL
BEGIN
    ALTER TABLE dbo.WalletTransactions ADD PendingAfter DECIMAL(18,2) NULL;
    PRINT N'Added WalletTransactions.PendingAfter';
END;
GO

/* -------------------------------------------------------------------------- */
/* 5. Platform commission reporting                                           */
/* -------------------------------------------------------------------------- */

CREATE OR ALTER VIEW dbo.vw_PlatformCommission
AS
/*
  Commission is recognised when the batch is approved (money released to the
  seller), not while the order is still in the hold window — an order in hold can
  still be returned.
*/
SELECT
    s.ShopId,
    sh.ShopName,
    CAST(b.ApprovedAt AS DATE) AS RecognizedDate,
    COUNT(*)                   AS OrderCount,
    SUM(s.GrossAmount)         AS Gmv,
    SUM(s.CommissionAmount)    AS Commission,
    SUM(s.NetAmount)           AS PaidToSeller
FROM dbo.SettlementEntries s
INNER JOIN dbo.PayoutBatches b ON b.PayoutBatchId = s.PayoutBatchId
INNER JOIN dbo.Shops sh ON sh.ShopId = s.ShopId
WHERE s.Status IN (N'Approved', N'Paid')
  AND b.ApprovedAt IS NOT NULL
GROUP BY s.ShopId, sh.ShopName, CAST(b.ApprovedAt AS DATE);
GO

PRINT N'Settlement schema ready.';
GO
