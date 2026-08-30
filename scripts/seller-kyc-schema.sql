/*
  seller-kyc-schema.sql — eKYC identity verification for seller onboarding.

  See docs/solution-seller-onboarding-ekyc.md.

  Safe to re-run.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* -------------------------------------------------------------------------- */
/* 1. KycVerifications — one row per identity check attempt                   */
/* -------------------------------------------------------------------------- */

IF OBJECT_ID('dbo.KycVerifications', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.KycVerifications (
        KycVerificationId  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_KycVerifications PRIMARY KEY
                           CONSTRAINT DF_Kyc_Id DEFAULT (NEWSEQUENTIALID()),
        UserId             UNIQUEIDENTIFIER NOT NULL,
        Provider           NVARCHAR(30)     NOT NULL CONSTRAINT DF_Kyc_Provider DEFAULT (N'FPTAI'),
        DocumentType       NVARCHAR(30)     NULL,        -- CCCD | CMND | Passport
        -- Only the last 4 digits are readable; the full number lives as a hash.
        DocumentNumberMask NVARCHAR(32)     NULL,
        DocumentNumberHash CHAR(64)         NULL,        -- SHA-256, one identity = one shop
        FullName           NVARCHAR(150)    NULL,
        DateOfBirth        NVARCHAR(20)     NULL,
        Gender             NVARCHAR(20)     NULL,
        HomeTown           NVARCHAR(300)    NULL,
        PermanentAddress   NVARCHAR(500)    NULL,
        IssueDate          NVARCHAR(20)     NULL,
        ExpiryDate         NVARCHAR(20)     NULL,
        FrontImageUrl      NVARCHAR(512)    NULL,
        BackImageUrl       NVARCHAR(512)    NULL,
        SelfieImageUrl     NVARCHAR(512)    NULL,
        FaceMatchSimilarity DECIMAL(5,4)    NULL,
        FaceMatched        BIT              NOT NULL CONSTRAINT DF_Kyc_FaceMatched DEFAULT (0),
        Status             NVARCHAR(20)     NOT NULL CONSTRAINT DF_Kyc_Status DEFAULT (N'Pending'),
            -- Pending | Passed | ManualReview | Failed
        FailureReason      NVARCHAR(500)    NULL,
        RawOcrJson         NVARCHAR(MAX)    NULL,
        RawFaceJson        NVARCHAR(MAX)    NULL,
        CreatedAt          DATETIME2(3)     NOT NULL CONSTRAINT DF_Kyc_CreatedAt DEFAULT (SYSUTCDATETIME()),
        VerifiedAt         DATETIME2(3)     NULL,
        CONSTRAINT FK_Kyc_User FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
        CONSTRAINT CK_Kyc_Status CHECK (Status IN (N'Pending', N'Passed', N'ManualReview', N'Failed'))
    );

    CREATE INDEX IX_Kyc_User_CreatedAt ON dbo.KycVerifications (UserId, CreatedAt DESC);
    -- One verified identity may back only one seller account.
    CREATE UNIQUE INDEX UX_Kyc_PassedDocument ON dbo.KycVerifications (DocumentNumberHash)
        WHERE Status = N'Passed' AND DocumentNumberHash IS NOT NULL;

    PRINT N'Created dbo.KycVerifications';
END;
GO

/* -------------------------------------------------------------------------- */
/* 2. SellerRegistrationRequests — business profile + KYC link                */
/* -------------------------------------------------------------------------- */

IF COL_LENGTH('dbo.SellerRegistrationRequests', 'KycVerificationId') IS NULL
BEGIN
    ALTER TABLE dbo.SellerRegistrationRequests ADD
        KycVerificationId UNIQUEIDENTIFIER NULL,
        BusinessType      NVARCHAR(20)     NULL,   -- Individual | Household | Company
        TaxCode           NVARCHAR(32)     NULL,
        BusinessAddress   NVARCHAR(300)    NULL,
        ContactPhone      NVARCHAR(20)     NULL,
        ContactEmail      NVARCHAR(256)    NULL,
        LicenseImageUrl   NVARCHAR(512)    NULL,
        UpdatedAt         DATETIME2(3)     NULL;

    PRINT N'Extended dbo.SellerRegistrationRequests';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_SellerReg_Kyc')
BEGIN
    ALTER TABLE dbo.SellerRegistrationRequests
        ADD CONSTRAINT FK_SellerReg_Kyc FOREIGN KEY (KycVerificationId)
            REFERENCES dbo.KycVerifications (KycVerificationId);
    PRINT N'Added FK_SellerReg_Kyc';
END;
GO

/* Allow the new NeedsMoreInfo state so a thin application can be fixed
   instead of rejected outright. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_SellerReg_Status')
BEGIN
    ALTER TABLE dbo.SellerRegistrationRequests DROP CONSTRAINT CK_SellerReg_Status;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_SellerReg_Status')
BEGIN
    ALTER TABLE dbo.SellerRegistrationRequests
        ADD CONSTRAINT CK_SellerReg_Status
            CHECK (Status IN (N'Pending', N'Approved', N'Rejected', N'NeedsMoreInfo'));
    PRINT N'Rebuilt CK_SellerReg_Status with NeedsMoreInfo';
END;
GO

PRINT N'Seller KYC schema ready.';
GO
