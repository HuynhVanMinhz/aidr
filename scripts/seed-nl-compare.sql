/*
  AIDR — NL Filter & Compare demo seed (UC-90 / UC-28)
  Prerequisites:
    - POST /api/dev/seed-catalog (Approved products with fixed GUIDs)

  Idempotent: skips when NL-COMPARE-SEED marker tag already present on S24.
  Seeds / enriches:
    - Richer SpecsJson on flagship phones + MacBook for AI compare demos
    - TagsJson marker so re-runs are no-ops
*/

SET NOCOUNT ON;

DECLARE @ApprovedCount INT;
SELECT @ApprovedCount = COUNT(*) FROM dbo.Products WHERE Status = N'Approved';
IF @ApprovedCount < 2
BEGIN
    RAISERROR(N'Not enough Approved products. Run POST /api/dev/seed-catalog first.', 16, 1);
    RETURN;
END;

DECLARE @S24 UNIQUEIDENTIFIER = COALESCE(
    (SELECT TOP 1 ProductId FROM dbo.Products WHERE ProductId = 'EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE' AND Status = N'Approved'),
    (SELECT TOP 1 ProductId FROM dbo.Products WHERE Slug = N'samsung-galaxy-s24-256gb' AND Status = N'Approved'));
DECLARE @IP15 UNIQUEIDENTIFIER = COALESCE(
    (SELECT TOP 1 ProductId FROM dbo.Products WHERE ProductId = '11111111-1111-1111-1111-111111111101' AND Status = N'Approved'),
    (SELECT TOP 1 ProductId FROM dbo.Products WHERE Slug = N'iphone-15-128gb' AND Status = N'Approved'));
DECLARE @X14 UNIQUEIDENTIFIER = COALESCE(
    (SELECT TOP 1 ProductId FROM dbo.Products WHERE ProductId = '11111111-1111-1111-1111-111111111102' AND Status = N'Approved'),
    (SELECT TOP 1 ProductId FROM dbo.Products WHERE Slug = N'xiaomi-14-256gb' AND Status = N'Approved'));
DECLARE @MBA UNIQUEIDENTIFIER = COALESCE(
    (SELECT TOP 1 ProductId FROM dbo.Products WHERE ProductId = '11111111-1111-1111-1111-111111111103' AND Status = N'Approved'),
    (SELECT TOP 1 ProductId FROM dbo.Products WHERE Slug = N'macbook-air-m3-13' AND Status = N'Approved'));

IF @S24 IS NULL OR @IP15 IS NULL
BEGIN
    RAISERROR(N'Demo compare products missing. Run POST /api/dev/seed-catalog first.', 16, 1);
    RETURN;
END;

IF EXISTS (
    SELECT 1
    FROM dbo.Products
    WHERE ProductId = @S24
      AND TagsJson LIKE N'%NL-COMPARE-SEED%'
)
BEGIN
    PRINT N'NL filter / compare demo seed already present — skipped.';
    RETURN;
END;

UPDATE dbo.Products
SET SpecsJson = N'{"ram":"8GB","storage":"256GB","screen":"6.2\"","battery":"4000mAh","chip":"Snapdragon 8 Gen 3","camera":"50MP","os":"Android 14"}',
    TagsJson = N'["flagship","samsung","5g","NL-COMPARE-SEED"]',
    UpdatedAt = SYSUTCDATETIME()
WHERE ProductId = @S24;

UPDATE dbo.Products
SET SpecsJson = N'{"ram":"6GB","storage":"128GB","screen":"6.1\"","battery":"3349mAh","chip":"A16 Bionic","camera":"48MP","os":"iOS 17"}',
    TagsJson = N'["apple","iphone","5g","NL-COMPARE-SEED"]',
    UpdatedAt = SYSUTCDATETIME()
WHERE ProductId = @IP15;

IF @X14 IS NOT NULL
BEGIN
    UPDATE dbo.Products
    SET SpecsJson = N'{"ram":"12GB","storage":"256GB","screen":"6.36\"","battery":"4610mAh","chip":"Snapdragon 8 Gen 3","camera":"50MP Leica","os":"HyperOS"}',
        TagsJson = N'["xiaomi","leica","5g","NL-COMPARE-SEED"]',
        UpdatedAt = SYSUTCDATETIME()
    WHERE ProductId = @X14;
END;

IF @MBA IS NOT NULL
BEGIN
    UPDATE dbo.Products
    SET SpecsJson = N'{"ram":"16GB","storage":"512GB","screen":"13.6\"","battery":"18h","chip":"Apple M3","gpu":"10-core","os":"macOS Sonoma","weight":"1.24kg"}',
        TagsJson = N'["apple","laptop","m3","NL-COMPARE-SEED"]',
        UpdatedAt = SYSUTCDATETIME()
    WHERE ProductId = @MBA;
END;

PRINT N'NL filter / compare demo seed completed.';
