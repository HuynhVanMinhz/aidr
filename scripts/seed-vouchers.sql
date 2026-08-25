/*
  AIDR — Seed demo vouchers (System + Shop) for local testing.

  Prefer: POST http://localhost:5080/api/dev/seed-vouchers  (Development only)
  Prerequisite: POST /api/dev/seed-demo-accounts

  Codes:
    AIDR10   — System 10% (max 50k), min 100k, active
    AIDR50K  — System flat 50k, min 200k, active
    AIDR_OFF — System 5%, inactive (activate/disable test)
    SHOP20K  — Shop flat 20k, min 50k, active (demo seller shop)
    SHOP15   — Shop 15% (max 30k), min 80k, active
    SHOP_OLD — Shop flat 10k, expired

  Demo IDs (must match DemoAccountsSeeder / VoucherDemoSeeder):
    Admin  AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA
    Seller BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB
    Shop   DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRAN;

DECLARE @AdminId  UNIQUEIDENTIFIER = 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA';
DECLARE @SellerId UNIQUEIDENTIFIER = 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB';
DECLARE @ShopId   UNIQUEIDENTIFIER = 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD';
DECLARE @Now      DATETIME2(3) = SYSUTCDATETIME();

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @AdminId)
BEGIN
    RAISERROR(N'Seed demo accounts first (admin missing).', 16, 1);
    ROLLBACK TRAN;
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Shops WHERE ShopId = @ShopId)
BEGIN
    RAISERROR(N'Demo shop missing. Seed demo accounts first.', 16, 1);
    ROLLBACK TRAN;
    RETURN;
END;

;MERGE dbo.Vouchers AS t
USING (VALUES
    (
        CONVERT(UNIQUEIDENTIFIER, 'EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE'),
        N'AIDR10', N'AIDR Welcome 10%',
        N'System-wide 10% off (max 50,000 VND). Min order 100,000 VND.',
        N'System', CAST(NULL AS UNIQUEIDENTIFIER),
        N'Percent', CAST(10 AS DECIMAL(18,2)), CAST(50000 AS DECIMAL(18,2)), CAST(100000 AS DECIMAL(18,2)),
        1000, 3,
        DATEADD(DAY, -1, @Now), DATEADD(MONTH, 6, @Now), CAST(1 AS BIT), @AdminId
    ),
    (
        CONVERT(UNIQUEIDENTIFIER, 'EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEE01'),
        N'AIDR50K', N'AIDR Flat 50K',
        N'System-wide 50,000 VND off. Min order 200,000 VND.',
        N'System', CAST(NULL AS UNIQUEIDENTIFIER),
        N'FixedAmount', CAST(50000 AS DECIMAL(18,2)), CAST(NULL AS DECIMAL(18,2)), CAST(200000 AS DECIMAL(18,2)),
        200, 1,
        DATEADD(DAY, -1, @Now), DATEADD(MONTH, 3, @Now), CAST(1 AS BIT), @AdminId
    ),
    (
        CONVERT(UNIQUEIDENTIFIER, 'EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEE02'),
        N'AIDR_OFF', N'AIDR Disabled (test)',
        N'Inactive system voucher — use to test activate/disable.',
        N'System', CAST(NULL AS UNIQUEIDENTIFIER),
        N'Percent', CAST(5 AS DECIMAL(18,2)), CAST(20000 AS DECIMAL(18,2)), CAST(0 AS DECIMAL(18,2)),
        100, 1,
        DATEADD(DAY, -1, @Now), DATEADD(MONTH, 6, @Now), CAST(0 AS BIT), @AdminId
    ),
    (
        CONVERT(UNIQUEIDENTIFIER, 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF'),
        N'SHOP20K', N'Shop Flat 20K',
        N'Demo shop voucher: 20,000 VND off. Min order 50,000 VND.',
        N'Shop', @ShopId,
        N'FixedAmount', CAST(20000 AS DECIMAL(18,2)), CAST(NULL AS DECIMAL(18,2)), CAST(50000 AS DECIMAL(18,2)),
        500, 5,
        DATEADD(DAY, -1, @Now), DATEADD(MONTH, 6, @Now), CAST(1 AS BIT), @SellerId
    ),
    (
        CONVERT(UNIQUEIDENTIFIER, 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFF01'),
        N'SHOP15', N'Shop 15% Off',
        N'Demo shop 15% off (max 30,000 VND). Min order 80,000 VND.',
        N'Shop', @ShopId,
        N'Percent', CAST(15 AS DECIMAL(18,2)), CAST(30000 AS DECIMAL(18,2)), CAST(80000 AS DECIMAL(18,2)),
        300, 2,
        DATEADD(DAY, -1, @Now), DATEADD(MONTH, 6, @Now), CAST(1 AS BIT), @SellerId
    ),
    (
        CONVERT(UNIQUEIDENTIFIER, 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFF02'),
        N'SHOP_OLD', N'Shop Expired (test)',
        N'Expired shop voucher — appears in Expired KPI, not eligible for apply.',
        N'Shop', @ShopId,
        N'FixedAmount', CAST(10000 AS DECIMAL(18,2)), CAST(NULL AS DECIMAL(18,2)), CAST(0 AS DECIMAL(18,2)),
        50, 1,
        DATEADD(MONTH, -3, @Now), DATEADD(DAY, -7, @Now), CAST(1 AS BIT), @SellerId
    )
) AS s (
    VoucherId, Code, Name, Description, Scope, ShopId,
    DiscountType, DiscountValue, MaxDiscountAmount, MinOrderAmount,
    UsageLimit, PerUserLimit, StartsAt, EndsAt, IsActive, CreatedBy
)
ON t.VoucherId = s.VoucherId OR t.Code = s.Code
WHEN MATCHED THEN UPDATE SET
    t.Code = s.Code,
    t.Name = s.Name,
    t.Description = s.Description,
    t.Scope = s.Scope,
    t.ShopId = s.ShopId,
    t.DiscountType = s.DiscountType,
    t.DiscountValue = s.DiscountValue,
    t.MaxDiscountAmount = s.MaxDiscountAmount,
    t.MinOrderAmount = s.MinOrderAmount,
    t.UsageLimit = s.UsageLimit,
    t.PerUserLimit = s.PerUserLimit,
    t.StartsAt = s.StartsAt,
    t.EndsAt = s.EndsAt,
    t.IsActive = s.IsActive,
    t.UpdatedAt = @Now
WHEN NOT MATCHED THEN INSERT (
    VoucherId, Code, Name, Description, Scope, ShopId,
    DiscountType, DiscountValue, MaxDiscountAmount, MinOrderAmount,
    UsageLimit, PerUserLimit, UsedCount, StartsAt, EndsAt, IsActive,
    CreatedBy, CreatedAt, UpdatedAt
) VALUES (
    s.VoucherId, s.Code, s.Name, s.Description, s.Scope, s.ShopId,
    s.DiscountType, s.DiscountValue, s.MaxDiscountAmount, s.MinOrderAmount,
    s.UsageLimit, s.PerUserLimit, 0, s.StartsAt, s.EndsAt, s.IsActive,
    s.CreatedBy, @Now, @Now
);

COMMIT TRAN;

SELECT Code, Scope, ShopId, DiscountType, DiscountValue, MinOrderAmount, IsActive, StartsAt, EndsAt
FROM dbo.Vouchers
WHERE Code IN (N'AIDR10', N'AIDR50K', N'AIDR_OFF', N'SHOP20K', N'SHOP15', N'SHOP_OLD')
ORDER BY Scope, Code;
