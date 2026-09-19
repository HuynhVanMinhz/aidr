/*
  AIDR - NL Filter & Compare demo seed (UC-90 / UC-28)
  Prerequisites:
    - POST /api/dev/seed-catalog (Approved products with fixed GUIDs)

  Idempotent content: always refreshes SpecsJson / TagsJson on demo phones + MacBook.
  Seeds / enriches:
    - Richer SpecsJson on flagship phones + MacBook for AI compare demos
    - TagsJson marker for NL filter demos
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

UPDATE dbo.Products
SET SpecsJson = N'{"ram":"8GB","storage":"256GB","screen":"6.2","refresh_rate":"120Hz","battery":"4000mAh","charging":"25W","chip":"Snapdragon 8 Gen 3","gpu":"Adreno 750","camera":"50MP","front_camera":"12MP","os":"Android 14","sim":"Dual SIM","connectivity":"5G, Wi-Fi 6E, BT 5.3","weight":"167g","color":"Onyx Black"}',
    TagsJson = N'["flagship","samsung","5g","NL-COMPARE-SEED"]',
    OriginCountry = COALESCE(OriginCountry, N'Vietnam'),
    UpdatedAt = SYSUTCDATETIME()
WHERE ProductId = @S24;

UPDATE dbo.Products
SET SpecsJson = N'{"ram":"6GB","storage":"128GB","screen":"6.1","refresh_rate":"60Hz","battery":"3349mAh","charging":"20W","chip":"A16 Bionic","gpu":"5-core GPU","camera":"48MP","front_camera":"12MP","os":"iOS 17","sim":"eSIM","connectivity":"5G, Wi-Fi 6, BT 5.3","weight":"171g","color":"Blue"}',
    TagsJson = N'["apple","iphone","5g","NL-COMPARE-SEED"]',
    OriginCountry = COALESCE(OriginCountry, N'Vietnam'),
    UpdatedAt = SYSUTCDATETIME()
WHERE ProductId = @IP15;

IF @X14 IS NOT NULL
BEGIN
    UPDATE dbo.Products
    SET SpecsJson = N'{"ram":"12GB","storage":"256GB","screen":"6.36","refresh_rate":"120Hz","battery":"4610mAh","charging":"90W","chip":"Snapdragon 8 Gen 3","gpu":"Adreno 750","camera":"50MP Leica","front_camera":"32MP","os":"HyperOS","sim":"Dual SIM","connectivity":"5G, Wi-Fi 7, BT 5.4","weight":"193g","color":"Black"}',
        TagsJson = N'["xiaomi","leica","5g","NL-COMPARE-SEED"]',
        OriginCountry = COALESCE(OriginCountry, N'Vietnam'),
        UpdatedAt = SYSUTCDATETIME()
    WHERE ProductId = @X14;
END;

IF @MBA IS NOT NULL
BEGIN
    UPDATE dbo.Products
    SET SpecsJson = N'{"ram":"16GB","storage":"512GB","screen":"13.6","refresh_rate":"60Hz","battery":"18h","charging":"MagSafe 30W","chip":"Apple M3","gpu":"10-core","os":"macOS Sonoma","ports":"2x Thunderbolt / USB4","connectivity":"Wi-Fi 6E, BT 5.3","weight":"1.24kg","color":"Midnight","material":"Aluminum"}',
        TagsJson = N'["apple","laptop","m3","NL-COMPARE-SEED"]',
        OriginCountry = COALESCE(OriginCountry, N'Vietnam'),
        UpdatedAt = SYSUTCDATETIME()
    WHERE ProductId = @MBA;
END;

PRINT N'NL filter / compare demo seed completed (specs refreshed).';
