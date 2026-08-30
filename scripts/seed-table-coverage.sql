/*
  seed-table-coverage.sql — fill tables that other demo seeds leave empty.

  Prerequisites: POST /api/dev/seed-demo-accounts + seed-catalog (+ seed-all recommended).
  Also applies settlement-schema when ShopBankAccounts is missing.

  Covers:
    ProductVariants, ProductPriceHistories, SellerRatings,
    ShopBankAccounts, PayoutBatches, PasswordResetTokens,
    extra Addresses, SellerFollows

  Idempotent: fixed GUIDs / marker prefixes (COV-SEED-*).
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE
    @ShopId       UNIQUEIDENTIFIER = 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD',
    @SellerId     UNIQUEIDENTIFIER = 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB',
    @BuyerId      UNIQUEIDENTIFIER = 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC',
    @AdminId      UNIQUEIDENTIFIER = 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
    @iPhoneId     UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111101',
    @S24Id        UNIQUEIDENTIFIER = 'EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE',
    @Variant128   UNIQUEIDENTIFIER = 'F1111111-1111-1111-1111-111111111101',
    @Variant256   UNIQUEIDENTIFIER = 'F1111111-1111-1111-1111-111111111102',
    @BankAcctId   UNIQUEIDENTIFIER = 'B1111111-1111-1111-1111-111111111101',
    @PayoutId     UNIQUEIDENTIFIER = 'C1111111-1111-1111-1111-111111111101',
    @ResetTokenId UNIQUEIDENTIFIER = 'D1111111-1111-1111-1111-111111111101',
    @Addr2Id      UNIQUEIDENTIFIER = 'A1111111-1111-1111-1111-111111111102',
    @Now          DATETIME2(3) = SYSUTCDATETIME();

IF NOT EXISTS (SELECT 1 FROM dbo.Shops WHERE ShopId = @ShopId)
    SELECT TOP (1) @ShopId = ShopId FROM dbo.Shops WHERE Status = N'Active' ORDER BY CreatedAt;

IF @ShopId IS NULL
BEGIN
    RAISERROR(N'Demo shop missing. Run POST /api/dev/seed-demo-accounts first.', 16, 1);
    RETURN;
END;

/* ---- ProductVariants (iPhone 15 storage options) ---- */
IF EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @iPhoneId)
   AND NOT EXISTS (SELECT 1 FROM dbo.ProductVariants WHERE VariantId = @Variant128)
BEGIN
    INSERT INTO dbo.ProductVariants (
        VariantId, ProductId, Sku, VariantName, AttributesJson, Price,
        LastCostPrice, AvgCostPrice, StockQuantity, IsActive, CreatedAt, UpdatedAt
    ) VALUES
    (@Variant128, @iPhoneId, N'TZ-IP15-128-BK', N'128GB / Black',
     N'{"storage":"128GB","color":"Black"}', 20990000, 16500000, 16500000, 15, 1, @Now, @Now),
    (@Variant256, @iPhoneId, N'TZ-IP15-256-BK', N'256GB / Black',
     N'{"storage":"256GB","color":"Black"}', 23990000, 18500000, 18500000, 10, 1, @Now, @Now);
END;

/* ---- ProductPriceHistories (catalog price change audit) ---- */
IF EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @iPhoneId)
   AND NOT EXISTS (
       SELECT 1 FROM dbo.ProductPriceHistories h
       WHERE h.ProductId = @iPhoneId AND h.Reason LIKE N'COV-SEED:%')
BEGIN
    INSERT INTO dbo.ProductPriceHistories (
        ProductId, OldBasePrice, NewBasePrice, OldSalePrice, NewSalePrice, ChangedBy, Reason, ChangedAt
    ) VALUES
    (@iPhoneId, 22990000, 21990000, NULL, 20990000, @SellerId,
     N'COV-SEED: Launch promo adjustment', DATEADD(DAY, -20, @Now)),
    (@iPhoneId, 21990000, 21990000, 20990000, 20490000, @SellerId,
     N'COV-SEED: Weekend flash sale', DATEADD(DAY, -7, @Now));
END;

IF EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @S24Id)
   AND NOT EXISTS (
       SELECT 1 FROM dbo.ProductPriceHistories h
       WHERE h.ProductId = @S24Id AND h.Reason LIKE N'COV-SEED:%')
BEGIN
    INSERT INTO dbo.ProductPriceHistories (
        ProductId, OldBasePrice, NewBasePrice, ChangedBy, Reason, ChangedAt
    ) VALUES
    (@S24Id, 12500000, 11990000, @SellerId,
     N'COV-SEED: Match competitor pricing', DATEADD(DAY, -14, @Now));
END;

/* ---- SellerRatings (from completed/delivered orders) ---- */
IF NOT EXISTS (SELECT 1 FROM dbo.SellerRatings WHERE Comment LIKE N'COV-SEED:%')
BEGIN
    INSERT INTO dbo.SellerRatings (SellerRatingId, ShopId, BuyerUserId, OrderId, Score, Comment, CreatedAt, UpdatedAt)
    SELECT TOP (8)
        NEWID(),
        o.ShopId,
        o.BuyerUserId,
        o.OrderId,
        CAST((ABS(CHECKSUM(o.OrderId)) % 5) + 1 AS TINYINT),
        N'COV-SEED: Great shop — fast shipping and genuine products.',
        DATEADD(DAY, -3, @Now),
        DATEADD(DAY, -3, @Now)
    FROM dbo.Orders o
    WHERE o.ShopId = @ShopId
      AND o.Status IN (N'Completed', N'Delivered')
      AND NOT EXISTS (
          SELECT 1 FROM dbo.SellerRatings sr
          WHERE sr.BuyerUserId = o.BuyerUserId AND sr.ShopId = o.ShopId AND sr.OrderId = o.OrderId)
    ORDER BY o.CreatedAt DESC;
END;

/* ---- PasswordResetTokens (unused demo token for buyer) ---- */
IF EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @BuyerId)
   AND NOT EXISTS (SELECT 1 FROM dbo.PasswordResetTokens WHERE TokenId = @ResetTokenId)
BEGIN
    INSERT INTO dbo.PasswordResetTokens (TokenId, UserId, TokenHash, ExpiresAt, CreatedAt)
    VALUES (
        @ResetTokenId, @BuyerId,
        N'COV-SEED-HASH-DEMO-RESET-TOKEN-NOT-USED',
        DATEADD(HOUR, 1, @Now),
        @Now
    );
END;

/* ---- Extra buyer address ---- */
IF EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @BuyerId)
   AND NOT EXISTS (SELECT 1 FROM dbo.Addresses WHERE AddressId = @Addr2Id)
BEGIN
    INSERT INTO dbo.Addresses (
        AddressId, UserId, ReceiverName, Phone, Province, District, Ward, StreetAddress, IsDefault, CreatedAt, UpdatedAt
    ) VALUES (
        @Addr2Id, @BuyerId, N'Jamie Buyer', N'0900000003',
        N'Ho Chi Minh', N'District 1', N'Ben Nghe', N'88 Nguyen Hue', 0, @Now, @Now
    );
END;

/* ---- SellerFollows (insight buyers follow demo shop) ---- */
INSERT INTO dbo.SellerFollows (BuyerUserId, ShopId, FollowedAt)
SELECT TOP (5) u.UserId, @ShopId, DATEADD(DAY, -u.RowNum, @Now)
FROM (
    SELECT UserId, RowNum = ROW_NUMBER() OVER (ORDER BY CreatedAt)
    FROM dbo.Users
    WHERE Email LIKE N'insight-buyer-%@aidr.local'
) u
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.SellerFollows f
    WHERE f.BuyerUserId = u.UserId AND f.ShopId = @ShopId);

/* ---- Settlement: bank account + payout batch (when schema exists) ---- */
IF OBJECT_ID(N'dbo.ShopBankAccounts', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.ShopBankAccounts WHERE ShopBankAccountId = @BankAcctId)
    BEGIN
        INSERT INTO dbo.ShopBankAccounts (
            ShopBankAccountId, ShopId, BankBin, BankName, AccountNumber, AccountName,
            Status, IsDefault, VerifiedBy, VerifiedAt, CreatedAt, UpdatedAt
        ) VALUES (
            @BankAcctId, @ShopId, N'970422', N'MB Bank',
            N'0123456789', N'ALEX SELLER TECHZONE',
            N'Verified', 1, @AdminId, DATEADD(DAY, -30, @Now), DATEADD(DAY, -30, @Now), @Now
        );
    END;

    IF OBJECT_ID(N'dbo.PayoutBatches', N'U') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.PayoutBatches WHERE PayoutBatchId = @PayoutId)
    BEGIN
        DECLARE @EntryCount INT = 0;
        DECLARE @Gross DECIMAL(18,2) = 0;
        DECLARE @Commission DECIMAL(18,2) = 0;
        DECLARE @Net DECIMAL(18,2) = 0;

        SELECT
            @EntryCount = COUNT(*),
            @Gross = SUM(GrossAmount),
            @Commission = SUM(CommissionAmount),
            @Net = SUM(NetAmount)
        FROM dbo.SettlementEntries
        WHERE ShopId = @ShopId
          AND Status = N'Paid'
          AND PayoutBatchId IS NULL;

        IF @EntryCount > 0
        BEGIN
            INSERT INTO dbo.PayoutBatches (
                PayoutBatchId, BatchCode, ShopId, ShopBankAccountId, PeriodTo,
                EntryCount, GrossAmount, CommissionAmount, NetAmount, Currency, Status,
                ApprovedBy, ApprovedAt, PaidAt, CreatedAt, UpdatedAt
            ) VALUES (
                @PayoutId, N'PAY-COV-SEED-001', @ShopId, @BankAcctId, @Now,
                @EntryCount, @Gross, @Commission, @Net, N'VND', N'Paid',
                @AdminId, DATEADD(DAY, -1, @Now), DATEADD(DAY, -1, @Now), DATEADD(DAY, -2, @Now), @Now
            );

            UPDATE dbo.SettlementEntries
            SET PayoutBatchId = @PayoutId, UpdatedAt = @Now
            WHERE ShopId = @ShopId
              AND Status = N'Paid'
              AND PayoutBatchId IS NULL;
        END;
    END;
END;

/* ---- Sync shop rating counters ---- */
UPDATE s
SET
    s.RatingCount = ISNULL(sr.Cnt, 0),
    s.AvgRating = ISNULL(sr.AvgScore, 0),
    s.FollowerCount = ISNULL(fc.Cnt, 0),
    s.UpdatedAt = @Now
FROM dbo.Shops s
LEFT JOIN (
    SELECT ShopId, Cnt = COUNT(*), AvgScore = CAST(AVG(CAST(Score AS DECIMAL(5,2))) AS DECIMAL(3,2))
    FROM dbo.SellerRatings GROUP BY ShopId
) sr ON sr.ShopId = s.ShopId
LEFT JOIN (
    SELECT ShopId, Cnt = COUNT(*) FROM dbo.SellerFollows GROUP BY ShopId
) fc ON fc.ShopId = s.ShopId
WHERE s.ShopId = @ShopId;

PRINT N'Table coverage seed completed.';
GO
