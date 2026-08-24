/*
  AIDR — Seller registration demo seed (UC-75 / UC-76)
  Idempotent: skips rows that already exist by RequestId / Email.
  Creates enough Pending rows to exercise list pagination.
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

IF NOT EXISTS (SELECT 1 FROM dbo.SellerRegistrationRequests WHERE RequestId = @ReqPending1)
BEGIN
    INSERT INTO dbo.SellerRegistrationRequests (
        RequestId, UserId, ShopName, BusinessInfo, DocumentUrls, Status, CreatedAt
    )
    VALUES (
        @ReqPending1, @BuyerId, N'Green Mart Home',
        N'Household goods and kitchenware. Warehouse in District 7, HCMC.',
        N'["https://res.cloudinary.com/demo/image/upload/sample.jpg"]',
        N'Pending', DATEADD(DAY, -2, SYSUTCDATETIME())
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.SellerRegistrationRequests WHERE RequestId = @ReqPending2)
BEGIN
    INSERT INTO dbo.SellerRegistrationRequests (
        RequestId, UserId, ShopName, BusinessInfo, DocumentUrls, Status, CreatedAt
    )
    VALUES (
        @ReqPending2, @Applicant1Id, N'Sportify Gear',
        N'Sports apparel and fitness accessories. Looking to sell nationwide.',
        N'["https://res.cloudinary.com/demo/image/upload/docs/license-sample.pdf","https://res.cloudinary.com/demo/image/upload/sample.jpg"]',
        N'Pending', DATEADD(HOUR, -8, SYSUTCDATETIME())
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.SellerRegistrationRequests WHERE RequestId = @ReqRejected)
BEGIN
    INSERT INTO dbo.SellerRegistrationRequests (
        RequestId, UserId, ShopName, BusinessInfo, DocumentUrls, Status,
        AdminNote, ReviewedBy, ReviewedAt, CreatedAt
    )
    VALUES (
        @ReqRejected, @Applicant3Id, N'Suspicious Gadgets',
        N'Import electronics without clear warranty policy.',
        N'["https://res.cloudinary.com/demo/image/upload/sample.jpg"]',
        N'Rejected',
        N'Documents incomplete and business address could not be verified.',
        @AdminId,
        DATEADD(DAY, -1, SYSUTCDATETIME()),
        DATEADD(DAY, -3, SYSUTCDATETIME())
    );
END;

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
        @Applicant2Id, N'Book Corner VN',
        N'New and used books, educational materials for students.',
        NULL, N'Pending', DATEADD(HOUR, -1, SYSUTCDATETIME())
    );
END;

/* Extra applicants + pending requests for pagination (10+/page). */
DECLARE @i INT = 4;
DECLARE @UserId UNIQUEIDENTIFIER;
DECLARE @ReqId UNIQUEIDENTIFIER;
DECLARE @Email NVARCHAR(256);
DECLARE @FullName NVARCHAR(128);
DECLARE @ShopName NVARCHAR(150);
DECLARE @Info NVARCHAR(1000);

WHILE @i <= 18
BEGIN
    SET @UserId = CONVERT(UNIQUEIDENTIFIER,
        'C' + RIGHT('0000000' + CONVERT(VARCHAR(7), @i), 7)
        + '-1111-1111-1111-111111111111');
    SET @ReqId = CONVERT(UNIQUEIDENTIFIER,
        'A' + RIGHT('0000000' + CONVERT(VARCHAR(7), @i), 7)
        + '-1111-1111-1111-111111111111');
    SET @Email = N'applicant' + CONVERT(NVARCHAR(10), @i) + N'@aidr.local';
    SET @FullName = N'Demo Applicant ' + CONVERT(NVARCHAR(10), @i);
    SET @ShopName = N'Demo Shop ' + CONVERT(NVARCHAR(10), @i);
    SET @Info = N'Demo seller application #' + CONVERT(NVARCHAR(10), @i) + N' for onboarding queue testing.';

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @UserId OR Email = @Email)
    BEGIN
        INSERT INTO dbo.Users (UserId, Email, EmailConfirmed, FullName, Phone, Status)
        VALUES (
            @UserId, @Email, 1, @FullName,
            N'0911' + RIGHT('000000' + CONVERT(VARCHAR(6), @i), 6),
            N'Active'
        );
        INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@UserId, @RoleBuyer);
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.SellerRegistrationRequests WHERE RequestId = @ReqId)
    AND NOT EXISTS (SELECT 1 FROM dbo.Shops WHERE OwnerUserId = @UserId)
    BEGIN
        INSERT INTO dbo.SellerRegistrationRequests (
            RequestId, UserId, ShopName, BusinessInfo, DocumentUrls, Status, CreatedAt
        )
        VALUES (
            @ReqId, @UserId, @ShopName, @Info,
            CASE WHEN @i % 3 = 0 THEN NULL
                 ELSE N'["https://res.cloudinary.com/demo/image/upload/sample.jpg"]' END,
            N'Pending',
            DATEADD(HOUR, -@i, SYSUTCDATETIME())
        );
    END;

    SET @i = @i + 1;
END;

/* One approved sample (user without existing shop). */
DECLARE @ApprovedUserId UNIQUEIDENTIFIER = 'C9999999-1111-1111-1111-111111111111';
DECLARE @ApprovedReqId UNIQUEIDENTIFIER = 'A9999999-1111-1111-1111-111111111111';

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @ApprovedUserId)
BEGIN
    INSERT INTO dbo.Users (UserId, Email, EmailConfirmed, FullName, Phone, Status)
    VALUES (@ApprovedUserId, N'applicant-approved@aidr.local', 1, N'Approved Demo Seller', N'0911999999', N'Active');
    INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@ApprovedUserId, @RoleBuyer);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.SellerRegistrationRequests WHERE RequestId = @ApprovedReqId)
BEGIN
    INSERT INTO dbo.SellerRegistrationRequests (
        RequestId, UserId, ShopName, BusinessInfo, DocumentUrls, Status,
        AdminNote, ReviewedBy, ReviewedAt, CreatedAt
    )
    VALUES (
        @ApprovedReqId, @ApprovedUserId, N'Approved Craft House',
        N'Handmade crafts — approved for filter testing.',
        N'["https://res.cloudinary.com/demo/image/upload/sample.jpg"]',
        N'Approved',
        N'Documents verified.',
        @AdminId,
        DATEADD(HOUR, -12, SYSUTCDATETIME()),
        DATEADD(DAY, -4, SYSUTCDATETIME())
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
