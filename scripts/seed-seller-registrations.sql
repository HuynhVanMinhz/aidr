/*
  AIDR — Seller registration demo seed (UC-75 / UC-76)
  Idempotent: skips rows that already exist by RequestId / Email.
*/

SET NOCOUNT ON;

DECLARE
    @BuyerId        UNIQUEIDENTIFIER = 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC',
    @Applicant1Id   UNIQUEIDENTIFIER = 'C1111111-1111-1111-1111-111111111111',
    @Applicant2Id   UNIQUEIDENTIFIER = 'C2222222-2222-2222-2222-222222222222',
    @Applicant3Id   UNIQUEIDENTIFIER = 'C3333333-3333-3333-3333-333333333333',
    @ReqPending1    UNIQUEIDENTIFIER = 'A1111111-1111-1111-1111-111111111111',
    @ReqPending2    UNIQUEIDENTIFIER = 'A2222222-2222-2222-2222-222222222222',
    @ReqRejected    UNIQUEIDENTIFIER = 'A3333333-3333-3333-3333-333333333333',
    @AdminId        UNIQUEIDENTIFIER = 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
    @RoleBuyer      INT = (SELECT RoleId FROM dbo.Roles WHERE RoleCode = N'BUYER');

IF @RoleBuyer IS NULL
BEGIN
    RAISERROR(N'BUYER role is missing. Run database.sql seed first.', 16, 1);
    RETURN;
END;

-- Ensure base buyer exists (from database.sql)
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @BuyerId)
BEGIN
    INSERT INTO dbo.Users (UserId, Email, EmailConfirmed, FullName, Phone, Status)
    VALUES (@BuyerId, N'buyer@aidr.local', 1, N'Tran Thi Buyer', N'0900000003', N'Active');
    INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@BuyerId, @RoleBuyer);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @Applicant1Id)
BEGIN
    INSERT INTO dbo.Users (UserId, Email, EmailConfirmed, FullName, Phone, Status)
    VALUES (@Applicant1Id, N'applicant1@aidr.local', 1, N'Le Van Applicant', N'0911000001', N'Active');
    INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@Applicant1Id, @RoleBuyer);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @Applicant2Id)
BEGIN
    INSERT INTO dbo.Users (UserId, Email, EmailConfirmed, FullName, Phone, Status)
    VALUES (@Applicant2Id, N'applicant2@aidr.local', 1, N'Pham Thi Applicant', N'0911000002', N'Active');
    INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@Applicant2Id, @RoleBuyer);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @Applicant3Id)
BEGIN
    INSERT INTO dbo.Users (UserId, Email, EmailConfirmed, FullName, Phone, Status)
    VALUES (@Applicant3Id, N'applicant3@aidr.local', 1, N'Hoang Rejected Applicant', N'0911000003', N'Active');
    INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@Applicant3Id, @RoleBuyer);
END;

-- Pending: base buyer wants to open a shop
IF NOT EXISTS (SELECT 1 FROM dbo.SellerRegistrationRequests WHERE RequestId = @ReqPending1)
BEGIN
    INSERT INTO dbo.SellerRegistrationRequests (
        RequestId, UserId, ShopName, BusinessInfo, DocumentUrls, Status, CreatedAt
    )
    VALUES (
        @ReqPending1,
        @BuyerId,
        N'Green Mart Home',
        N'Household goods and kitchenware. Warehouse in District 7, HCMC.',
        N'["https://res.cloudinary.com/demo/image/upload/sample.jpg"]',
        N'Pending',
        DATEADD(DAY, -2, SYSUTCDATETIME())
    );
END;

-- Pending: applicant 1
IF NOT EXISTS (SELECT 1 FROM dbo.SellerRegistrationRequests WHERE RequestId = @ReqPending2)
BEGIN
    INSERT INTO dbo.SellerRegistrationRequests (
        RequestId, UserId, ShopName, BusinessInfo, DocumentUrls, Status, CreatedAt
    )
    VALUES (
        @ReqPending2,
        @Applicant1Id,
        N'Sportify Gear',
        N'Sports apparel and fitness accessories. Looking to sell nationwide.',
        N'["https://res.cloudinary.com/demo/image/upload/docs/license-sample.pdf","https://res.cloudinary.com/demo/image/upload/sample.jpg"]',
        N'Pending',
        DATEADD(HOUR, -8, SYSUTCDATETIME())
    );
END;

-- Rejected sample (for filter testing)
IF NOT EXISTS (SELECT 1 FROM dbo.SellerRegistrationRequests WHERE RequestId = @ReqRejected)
BEGIN
    INSERT INTO dbo.SellerRegistrationRequests (
        RequestId, UserId, ShopName, BusinessInfo, DocumentUrls, Status,
        AdminNote, ReviewedBy, ReviewedAt, CreatedAt
    )
    VALUES (
        @ReqRejected,
        @Applicant3Id,
        N'Suspicious Gadgets',
        N'Import electronics without clear warranty policy.',
        N'["https://res.cloudinary.com/demo/image/upload/sample.jpg"]',
        N'Rejected',
        N'Documents incomplete and business address could not be verified.',
        @AdminId,
        DATEADD(DAY, -1, SYSUTCDATETIME()),
        DATEADD(DAY, -3, SYSUTCDATETIME())
    );
END;

-- Optional second pending from applicant2 (only if no shop and no other pending for this user)
IF NOT EXISTS (
    SELECT 1 FROM dbo.SellerRegistrationRequests
    WHERE UserId = @Applicant2Id AND Status = N'Pending'
)
AND NOT EXISTS (SELECT 1 FROM dbo.Shops WHERE OwnerUserId = @Applicant2Id)
BEGIN
    INSERT INTO dbo.SellerRegistrationRequests (
        RequestId, UserId, ShopName, BusinessInfo, DocumentUrls, Status, CreatedAt
    )
    VALUES (
        'A4444444-4444-4444-4444-444444444444',
        @Applicant2Id,
        N'Book Corner VN',
        N'New and used books, educational materials for students.',
        NULL,
        N'Pending',
        DATEADD(HOUR, -1, SYSUTCDATETIME())
    );
END;

SELECT
    r.RequestId,
    r.ShopName,
    u.Email,
    r.Status,
    r.CreatedAt
FROM dbo.SellerRegistrationRequests r
INNER JOIN dbo.Users u ON u.UserId = r.UserId
ORDER BY r.CreatedAt DESC;
