/*
  seed-kyc-duplicate.sql - two pending seller apps sharing the same identity hash.

  Prerequisites: POST /api/dev/seed-demo-accounts
  Idempotent: fixed user + KYC ids.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ExistingSellerId UNIQUEIDENTIFIER = 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB';
DECLARE @DuplicateUserId UNIQUEIDENTIFIER = 'EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE';
DECLARE @DuplicateKycId UNIQUEIDENTIFIER = 'E3333333-3333-3333-3333-333333333333';
DECLARE @DuplicateRequestId UNIQUEIDENTIFIER = 'E4444444-4444-4444-4444-444444444444';
DECLARE @SharedHash CHAR(64) = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @ExistingSellerId)
BEGIN
    RAISERROR(N'Demo seller missing. Run seed-demo-accounts first.', 16, 1);
    RETURN;
END;

UPDATE dbo.KycVerifications
SET DocumentNumberHash = @SharedHash,
    Status = N'Passed',
    VerifiedAt = COALESCE(VerifiedAt, SYSUTCDATETIME())
WHERE UserId = @ExistingSellerId
  AND DocumentNumberHash IS NULL;

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @DuplicateUserId)
BEGIN
    INSERT INTO dbo.Users (UserId, Email, PasswordHash, FullName, Phone, Status, CreatedAt, UpdatedAt)
    VALUES (
        @DuplicateUserId,
        N'duplicate-seller@aidr.local',
        (SELECT TOP (1) PasswordHash FROM dbo.Users WHERE UserId = @ExistingSellerId),
        N'Duplicate Identity Demo',
        N'0900000099',
        N'Active',
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.KycVerifications WHERE KycVerificationId = @DuplicateKycId)
BEGIN
    INSERT INTO dbo.KycVerifications (
        KycVerificationId, UserId, Provider, DocumentType, DocumentNumberMask,
        DocumentNumberHash, FullName, Status, FaceMatched, CreatedAt, VerifiedAt)
    VALUES (
        @DuplicateKycId,
        @DuplicateUserId,
        N'MOCK',
        N'CCCD',
        N'****5678',
        @SharedHash,
        N'Duplicate Identity Demo',
        N'Passed',
        1,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.SellerRegistrationRequests WHERE RequestId = @DuplicateRequestId)
BEGIN
    INSERT INTO dbo.SellerRegistrationRequests (
        RequestId, UserId, ShopName, BusinessInfo, Status, KycVerificationId, CreatedAt)
    VALUES (
        @DuplicateRequestId,
        @DuplicateUserId,
        N'Duplicate Identity Shop',
        N'Demo registration for duplicate identity warning.',
        N'Pending',
        @DuplicateKycId,
        SYSUTCDATETIME()
    );
END;

PRINT N'KYC duplicate demo seed completed.';
GO
