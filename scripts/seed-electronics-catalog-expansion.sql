/*
  seed-electronics-catalog-expansion.sql — round the active catalog out to
  25 categories (smart devices & consumer electronics only) and populate the
  6 new categories with realistic Approved products.

  Adds (all English, all electronics, purely additive — no existing rows are
  deleted, renamed, or reparented):
    Root:  Cameras & Drones (cameras), Networking (networking)
    Child: Speakers (audio-speakers, under Audio)
           Keyboards & Mice (gaming-keyboards-mice, under Gaming Gear)
           Power Banks & Wireless Charging (accessories-power-banks, under Accessories)
           Robot Vacuums (smart-home-robot-vacuums, under Smart Home)

  Prerequisites:
    - Demo shop TechZone (POST /api/dev/seed-demo-accounts)
    - Category hierarchy (POST /api/dev/seed-categories or seed-electronics-refresh)

  Idempotent by Slug (categories) and fixed ProductId (namespace
  66666666-6666-6666-6666-6666666601xx..0605).

  Dev: POST /api/dev/seed-electronics-expansion
*/

SET NOCOUNT ON;

DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();
DECLARE @MockBase NVARCHAR(128) = N'/theme/images/category-item-image-';

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'am-thanh')
BEGIN
    PRINT N'seed-electronics-catalog-expansion: base categories missing — run seed-categories / seed-electronics-refresh first.';
    RETURN;
END;

/* 1. Two new root categories */
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'cameras')
  INSERT INTO dbo.Categories (Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Cameras & Drones', N'cameras', N'Digital cameras, action cameras, and drones', @MockBase + N'2.png', 10, 1, @Now, @Now);

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'networking')
  INSERT INTO dbo.Categories (Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Networking', N'networking', N'Wi-Fi routers, mesh systems, and range extenders', @MockBase + N'5.png', 11, 1, @Now, @Now);

/* 2. Four new child categories under existing roots */
DECLARE
    @CatAudio INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'am-thanh'),
    @CatGaming INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'gaming-gear'),
    @CatAccess INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'phu-kien'),
    @CatSmartHome INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'nha-thong-minh');

IF @CatAudio IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'audio-speakers')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@CatAudio, N'Speakers', N'audio-speakers', N'Bluetooth and smart speakers', @MockBase + N'4.png', 2, 1, @Now, @Now);

IF @CatGaming IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'gaming-keyboards-mice')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@CatGaming, N'Keyboards & Mice', N'gaming-keyboards-mice', N'Mechanical keyboards and gaming mice', @MockBase + N'6.png', 1, 1, @Now, @Now);

IF @CatAccess IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'accessories-power-banks')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@CatAccess, N'Power Banks & Wireless Charging', N'accessories-power-banks', N'Portable power banks and wireless chargers', @MockBase + N'1.png', 3, 1, @Now, @Now);

IF @CatSmartHome IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'smart-home-robot-vacuums')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@CatSmartHome, N'Robot Vacuums', N'smart-home-robot-vacuums', N'Robotic vacuum cleaners and mops', @MockBase + N'3.png', 1, 1, @Now, @Now);

PRINT N'seed-electronics-catalog-expansion: category step done.';
GO

SET NOCOUNT ON;

DECLARE
    @ShopId UNIQUEIDENTIFIER = (
        SELECT TOP 1 ShopId FROM dbo.Shops
        WHERE ShopId = 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD' OR Status = N'Active'
        ORDER BY CASE WHEN ShopId = 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD' THEN 0 ELSE 1 END, CreatedAt
    ),
    @Now DATETIME2(3) = SYSUTCDATETIME(),
    @Img NVARCHAR(128) = N'/theme/images/product-image-1.png';

IF @ShopId IS NULL
BEGIN
    PRINT N'seed-electronics-catalog-expansion: skipped — no Active shop.';
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'cameras')
BEGIN
    PRINT N'seed-electronics-catalog-expansion: new categories missing — run the category batch above first.';
    RETURN;
END;

DECLARE @Rows TABLE (
    ProductId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    CatSlug NVARCHAR(80) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Slug NVARCHAR(200) NOT NULL,
    ShortDescription NVARCHAR(300) NOT NULL,
    Description NVARCHAR(1000) NOT NULL,
    Brand NVARCHAR(80) NOT NULL,
    ModelNumber NVARCHAR(80) NOT NULL,
    BasePrice DECIMAL(18,2) NOT NULL,
    SalePrice DECIMAL(18,2) NULL,
    Stock INT NOT NULL,
    Warranty INT NOT NULL,
    SpecsJson NVARCHAR(MAX) NOT NULL,
    TagsJson NVARCHAR(200) NOT NULL,
    AvgRating DECIMAL(3,2) NOT NULL,
    ReviewCount INT NOT NULL,
    SoldCount INT NOT NULL,
    IsFeatured BIT NOT NULL
);

INSERT INTO @Rows (
    ProductId, CatSlug, Name, Slug, ShortDescription, Description, Brand, ModelNumber,
    BasePrice, SalePrice, Stock, Warranty, SpecsJson, TagsJson, AvgRating, ReviewCount, SoldCount, IsFeatured
) VALUES
/* Cameras & Drones */
('66666666-6666-6666-6666-666666660101', N'cameras', N'Sony Alpha a6400 Mirrorless Camera', N'expand-sony-a6400', N'24.2MP APS-C, real-time Eye AF, 4K30 video', N'Compact mirrorless camera with fast autofocus for travel and vlogging.', N'Sony', N'ILCE-6400',
 22990000, 21490000, 12, 24, N'{"sensor":"24.2MP APS-C","video":"4K30","iso":"100-32000"}', N'["CAMERA","SONY","MIRRORLESS"]', 4.75, 34, 58, 1),
('66666666-6666-6666-6666-666666660102', N'cameras', N'Canon EOS R50 Mirrorless Camera', N'expand-canon-eos-r50', N'24.2MP, Dual Pixel AF II, vari-angle screen', N'Beginner-friendly mirrorless camera with fast, reliable autofocus.', N'Canon', N'EOS-R50',
 18990000, 17990000, 15, 24, N'{"sensor":"24.2MP APS-C","video":"4K30","mount":"RF"}', N'["CAMERA","CANON","MIRRORLESS"]', 4.60, 21, 39, 0),
('66666666-6666-6666-6666-666666660103', N'cameras', N'GoPro HERO12 Black', N'expand-gopro-hero12-black', N'5.3K60 video, HyperSmooth 6.0, waterproof to 10m', N'Rugged action camera built for adventure sports and diving.', N'GoPro', N'HERO12',
 9990000, 9290000, 30, 12, N'{"video":"5.3K60","waterproof":"10m","stabilization":"HyperSmooth 6.0"}', N'["CAMERA","ACTION-CAM","GOPRO"]', 4.65, 47, 132, 1),
('66666666-6666-6666-6666-666666660104', N'cameras', N'DJI Mini 4 Pro Drone', N'expand-dji-mini-4-pro', N'Sub-249g, 4K/60fps HDR video, 34-minute flight time', N'Lightweight travel drone with omnidirectional obstacle sensing.', N'DJI', N'Mini-4-Pro',
 21990000, 20490000, 10, 12, N'{"weight":"249g","video":"4K60 HDR","flightTime":"34min"}', N'["CAMERA","DRONE","DJI"]', 4.80, 19, 27, 1),
('66666666-6666-6666-6666-666666660105', N'cameras', N'Insta360 X4 360 Action Camera', N'expand-insta360-x4', N'8K360 capture, waterproof to 10m, AI reframing', N'360-degree action camera that lets you reframe shots after filming.', N'Insta360', N'X4',
 11990000, 10990000, 18, 12, N'{"video":"8K360","waterproof":"10m","storage":"microSD"}', N'["CAMERA","ACTION-CAM","INSTA360"]', 4.55, 14, 22, 0),
/* Networking */
('66666666-6666-6666-6666-666666660201', N'networking', N'TP-Link Archer AX73 Wi-Fi 6 Router', N'expand-tplink-archer-ax73', N'AX5400 dual-band, 6 antennas, OneMesh', N'High-speed Wi-Fi 6 router for smart homes with many devices.', N'TP-Link', N'Archer-AX73',
 2490000, 2290000, 40, 24, N'{"wifi":"Wi-Fi 6","speed":"AX5400","bands":"dual"}', N'["NETWORKING","ROUTER","TPLINK"]', 4.60, 58, 210, 1),
('66666666-6666-6666-6666-666666660202', N'networking', N'ASUS ZenWiFi AX Mini Mesh System (2-Pack)', N'expand-asus-zenwifi-ax-mini', N'AX1800 whole-home mesh, up to 4,500 sq ft coverage', N'Easy-to-set-up mesh Wi-Fi system that eliminates dead zones.', N'ASUS', N'ZenWiFi-AX-Mini',
 3990000, 3690000, 25, 24, N'{"wifi":"Wi-Fi 6","coverage":"4500 sqft","pack":"2"}', N'["NETWORKING","MESH","ASUS"]', 4.55, 33, 88, 0),
('66666666-6666-6666-6666-666666660203', N'networking', N'Netgear Nighthawk RAX50 Wi-Fi 6 Router', N'expand-netgear-nighthawk-rax50', N'AX5400, 8 streams, adaptive QoS', N'Powerful Nighthawk router built for gaming and 4K streaming.', N'Netgear', N'RAX50',
 3290000, NULL, 20, 24, N'{"wifi":"Wi-Fi 6","speed":"AX5400","streams":"8"}', N'["NETWORKING","ROUTER","NETGEAR"]', 4.50, 21, 47, 0),
('66666666-6666-6666-6666-666666660204', N'networking', N'TP-Link RE605X Wi-Fi 6 Range Extender', N'expand-tplink-re605x', N'AX1800 dual-band, Gigabit Ethernet port', N'Extend Wi-Fi 6 coverage to every room without a full mesh setup.', N'TP-Link', N'RE605X',
 1290000, 1090000, 45, 24, N'{"wifi":"Wi-Fi 6","speed":"AX1800","ports":"1xGbE"}', N'["NETWORKING","EXTENDER","TPLINK"]', 4.40, 27, 95, 0),
('66666666-6666-6666-6666-666666660205', N'networking', N'Ubiquiti UniFi Dream Router', N'expand-ubiquiti-unifi-dream-router', N'Built-in UniFi controller, 4x GbE ports, Wi-Fi 6', N'Prosumer router with enterprise-grade network management.', N'Ubiquiti', N'UDR',
 6990000, 6490000, 8, 24, N'{"wifi":"Wi-Fi 6","ports":"4xGbE","controller":"built-in"}', N'["NETWORKING","ROUTER","UBIQUITI"]', 4.70, 12, 19, 1),
/* Speakers */
('66666666-6666-6666-6666-666666660301', N'audio-speakers', N'JBL Flip 6 Portable Speaker', N'expand-jbl-flip-6', N'Powerful JBL Pro Sound, IP67 waterproof, 12h battery', N'Compact Bluetooth speaker built for pool days and hikes.', N'JBL', N'Flip6',
 2690000, 2490000, 40, 12, N'{"bluetooth":"5.1","ip":"IP67","battery":"12h"}', N'["AUDIO","SPEAKER","JBL"]', 4.65, 62, 240, 1),
('66666666-6666-6666-6666-666666660302', N'audio-speakers', N'Sonos One (Gen 2) Smart Speaker', N'expand-sonos-one-gen2', N'Room-filling sound with Alexa and Google Assistant built in', N'Wi-Fi smart speaker that pairs for stereo or multi-room audio.', N'Sonos', N'One-Gen2',
 4990000, NULL, 15, 12, N'{"wifi":"yes","voiceAssistant":"Alexa/Google","multiroom":"yes"}', N'["AUDIO","SPEAKER","SMART","SONOS"]', 4.70, 25, 51, 0),
('66666666-6666-6666-6666-666666660303', N'audio-speakers', N'Bose SoundLink Flex', N'expand-bose-soundlink-flex', N'PositionIQ technology, IP67, durable outdoor design', N'Rugged portable speaker with consistent Bose sound at any angle.', N'Bose', N'SoundLink-Flex',
 4290000, 3990000, 20, 12, N'{"bluetooth":"4.2","ip":"IP67","battery":"12h"}', N'["AUDIO","SPEAKER","BOSE"]', 4.60, 18, 40, 0),
('66666666-6666-6666-6666-666666660304', N'audio-speakers', N'Marshall Stanmore III Speaker', N'expand-marshall-stanmore-iii', N'80W retro-styled home speaker with Bluetooth 5.2', N'Iconic Marshall design for living-room and studio setups.', N'Marshall', N'Stanmore-III',
 8990000, 8490000, 8, 12, N'{"power":"80W","bluetooth":"5.2","style":"home"}', N'["AUDIO","SPEAKER","MARSHALL"]', 4.75, 9, 16, 0),
('66666666-6666-6666-6666-666666660305', N'audio-speakers', N'Anker Soundcore Motion+ Speaker', N'expand-anker-soundcore-motion-plus', N'Hi-Res audio, 30W drivers, IPX7 waterproof', N'Budget-friendly portable speaker with surprisingly deep bass.', N'Anker', N'Motion-Plus',
 2290000, 1990000, 35, 12, N'{"power":"30W","ip":"IPX7","battery":"12h"}', N'["AUDIO","SPEAKER","ANKER"]', 4.50, 44, 160, 0),
/* Keyboards & Mice */
('66666666-6666-6666-6666-666666660401', N'gaming-keyboards-mice', N'Corsair K70 RGB PRO Mechanical Keyboard', N'expand-corsair-k70-rgb-pro', N'Cherry MX switches, per-key RGB, aircraft-grade frame', N'Tournament-grade mechanical keyboard for competitive gaming.', N'Corsair', N'K70-RGB-PRO',
 3790000, 3490000, 25, 24, N'{"switch":"Cherry MX","layout":"full","rgb":"yes"}', N'["GAMING","KEYBOARD","CORSAIR"]', 4.65, 30, 74, 1),
('66666666-6666-6666-6666-666666660402', N'gaming-keyboards-mice', N'Logitech G502 X Plus Wireless Mouse', N'expand-logitech-g502-x-plus', N'LIGHTFORCE hybrid switches, 25K DPI sensor, RGB', N'High-precision wireless gaming mouse with hybrid optical-mechanical switches.', N'Logitech', N'G502-X-Plus',
 2990000, 2690000, 32, 24, N'{"dpi":"25600","wireless":"yes","weight":"89g"}', N'["GAMING","MOUSE","LOGITECH"]', 4.70, 38, 105, 1),
('66666666-6666-6666-6666-666666660403', N'gaming-keyboards-mice', N'SteelSeries Apex Pro Mini Keyboard', N'expand-steelseries-apex-pro-mini', N'Adjustable OmniPoint switches, 60% compact layout', N'Compact mechanical keyboard with per-key actuation tuning.', N'SteelSeries', N'Apex-Pro-Mini',
 4990000, 4590000, 14, 24, N'{"switch":"OmniPoint","layout":"60%","hotswap":"no"}', N'["GAMING","KEYBOARD","STEELSERIES"]', 4.60, 16, 29, 0),
('66666666-6666-6666-6666-666666660404', N'gaming-keyboards-mice', N'Razer DeathAdder V3 Gaming Mouse', N'expand-razer-deathadder-v3', N'Focus Pro 30K sensor, ergonomic shape, 90-hour battery', N'Esports-proven mouse shape with a new-generation sensor.', N'Razer', N'DeathAdder-V3',
 1590000, 1390000, 50, 24, N'{"dpi":"30000","wireless":"yes","weight":"63g"}', N'["GAMING","MOUSE","RAZER"]', 4.55, 52, 190, 0),
('66666666-6666-6666-6666-666666660405', N'gaming-keyboards-mice', N'HyperX Alloy Origins Core Keyboard', N'expand-hyperx-alloy-origins-core', N'HyperX mechanical switches, tenkeyless, aluminum body', N'Compact TKL keyboard built for travel and LAN parties.', N'HyperX', N'Alloy-Origins-Core',
 1990000, 1790000, 28, 24, N'{"switch":"HyperX Red","layout":"TKL","rgb":"yes"}', N'["GAMING","KEYBOARD","HYPERX"]', 4.45, 22, 63, 0),
/* Power Banks & Wireless Charging */
('66666666-6666-6666-6666-666666660501', N'accessories-power-banks', N'Anker PowerCore 10000 Power Bank', N'expand-anker-powercore-10000', N'10000mAh, pocket-size, 18W PD input/output', N'Compact power bank for a full phone charge on the go.', N'Anker', N'PowerCore-10000',
 690000, 590000, 60, 18, N'{"capacity":"10000mAh","maxWatt":"18W"}', N'["ACCESSORY","POWERBANK","ANKER"]', 4.55, 70, 320, 1),
('66666666-6666-6666-6666-666666660502', N'accessories-power-banks', N'Xiaomi 20000mAh Power Bank 3 Pro', N'expand-xiaomi-powerbank-3-pro', N'22.5W fast charging, dual USB-C/USB-A output', N'High-capacity power bank for charging phones and tablets twice over.', N'Xiaomi', N'PB3-Pro-20K',
 590000, 490000, 55, 12, N'{"capacity":"20000mAh","maxWatt":"22.5W"}', N'["ACCESSORY","POWERBANK","XIAOMI"]', 4.45, 58, 265, 0),
('66666666-6666-6666-6666-666666660503', N'accessories-power-banks', N'Baseus Blade 20000mAh Power Bank', N'expand-baseus-blade-20000', N'Slim 1.4cm profile, 20W two-way fast charging', N'Ultra-thin power bank that slides easily into a bag pocket.', N'Baseus', N'Blade-20K',
 690000, 590000, 40, 12, N'{"capacity":"20000mAh","maxWatt":"20W"}', N'["ACCESSORY","POWERBANK","BASEUS"]', 4.40, 33, 140, 0),
('66666666-6666-6666-6666-666666660504', N'accessories-power-banks', N'Anker MagGo Wireless Charging Pad', N'expand-anker-maggo-wireless-pad', N'15W MagSafe-compatible magnetic charging', N'Snap-on wireless charger for a clutter-free nightstand setup.', N'Anker', N'MagGo-Pad',
 590000, 490000, 45, 12, N'{"maxWatt":"15W","magnetic":"yes"}', N'["ACCESSORY","WIRELESS-CHARGER","ANKER"]', 4.50, 29, 110, 0),
('66666666-6666-6666-6666-666666660505', N'accessories-power-banks', N'Samsung 15W Wireless Charger Duo', N'expand-samsung-wireless-charger-duo', N'Charges phone and watch simultaneously', N'Official Samsung pad for charging two devices at once.', N'Samsung', N'Charger-Duo',
 990000, 890000, 20, 12, N'{"maxWatt":"15W","devices":"2"}', N'["ACCESSORY","WIRELESS-CHARGER","SAMSUNG"]', 4.35, 17, 58, 0),
/* Robot Vacuums */
('66666666-6666-6666-6666-666666660601', N'smart-home-robot-vacuums', N'Xiaomi Robot Vacuum X10+', N'expand-xiaomi-robot-vacuum-x10-plus', N'LDS navigation, self-emptying dock, 4000Pa suction', N'Vacuum and mop robot with automatic dust collection.', N'Xiaomi', N'X10-Plus',
 8990000, 8290000, 15, 12, N'{"suction":"4000Pa","selfEmpty":"yes","mop":"yes"}', N'["SMARTHOME","VACUUM","XIAOMI"]', 4.60, 26, 61, 1),
('66666666-6666-6666-6666-666666660602', N'smart-home-robot-vacuums', N'Roborock Q Revo Robot Vacuum', N'expand-roborock-q-revo', N'5500Pa suction, hot-water mop washing, auto-empty', N'Flagship Roborock with reactive obstacle avoidance.', N'Roborock', N'Q-Revo',
 12990000, 11990000, 10, 12, N'{"suction":"5500Pa","selfEmpty":"yes","mop":"yes"}', N'["SMARTHOME","VACUUM","ROBOROCK"]', 4.75, 19, 34, 1),
('66666666-6666-6666-6666-666666660603', N'smart-home-robot-vacuums', N'Ecovacs Deebot N10 Plus', N'expand-ecovacs-deebot-n10-plus', N'3800Pa suction, TrueMapping 2.0, auto-empty station', N'Reliable everyday robot vacuum with smart room mapping.', N'Ecovacs', N'N10-Plus',
 9990000, 9290000, 12, 12, N'{"suction":"3800Pa","selfEmpty":"yes","mop":"yes"}', N'["SMARTHOME","VACUUM","ECOVACS"]', 4.50, 14, 28, 0),
('66666666-6666-6666-6666-666666660604', N'smart-home-robot-vacuums', N'iRobot Roomba Combo j5+', N'expand-irobot-roomba-combo-j5-plus', N'Vacuum and mop in one, self-emptying base, pet-hair optimized', N'Trusted Roomba lineup with an obstacle-avoidance camera.', N'iRobot', N'Combo-j5-Plus',
 15990000, 14990000, 6, 12, N'{"selfEmpty":"yes","mop":"yes","petHair":"optimized"}', N'["SMARTHOME","VACUUM","IROBOT"]', 4.65, 11, 20, 0),
('66666666-6666-6666-6666-666666660605', N'smart-home-robot-vacuums', N'Xiaomi Robot Vacuum S10', N'expand-xiaomi-robot-vacuum-s10', N'Sonic mopping, 4000Pa suction, ultra-slim design', N'Slim-profile robot vacuum that fits under low furniture.', N'Xiaomi', N'S10',
 6990000, 6490000, 20, 12, N'{"suction":"4000Pa","mop":"sonic","height":"9.6cm"}', N'["SMARTHOME","VACUUM","XIAOMI"]', 4.45, 20, 45, 0);

INSERT INTO dbo.Products (
    ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
    Brand, ModelNumber, ConditionType, BasePrice, SalePrice, Currency,
    StockQuantity, ReservedQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
    Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount, IsFeatured, CreatedAt, UpdatedAt
)
SELECT
    r.ProductId, @ShopId, c.CategoryId, r.Name, r.Slug, r.ShortDescription, r.Description,
    r.Brand, r.ModelNumber, N'New', r.BasePrice, r.SalePrice, N'VND',
    r.Stock, 0, r.Warranty, N'China', r.SpecsJson, r.TagsJson,
    N'Approved', @Now, r.AvgRating, r.ReviewCount, r.SoldCount, 0, r.IsFeatured, @Now, @Now
FROM @Rows r
INNER JOIN dbo.Categories c ON c.Slug = r.CatSlug AND c.IsActive = 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.Products p WHERE p.ProductId = r.ProductId)
  AND NOT EXISTS (SELECT 1 FROM dbo.Products p2 WHERE p2.ShopId = @ShopId AND p2.Slug = r.Slug);

INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary)
SELECT p.ProductId, @Img, 0, 1
FROM dbo.Products p
INNER JOIN @Rows r ON r.ProductId = p.ProductId
WHERE NOT EXISTS (SELECT 1 FROM dbo.ProductImages i WHERE i.ProductId = p.ProductId);

UPDATE s
SET ProductCount = (
        SELECT COUNT(*) FROM dbo.Products p
        WHERE p.ShopId = s.ShopId AND p.Status = N'Approved'
    ),
    UpdatedAt = @Now
FROM dbo.Shops s
WHERE s.ShopId = @ShopId;

DECLARE @Inserted INT = (
    SELECT COUNT(*) FROM dbo.Products p
    INNER JOIN @Rows r ON r.ProductId = p.ProductId
);
DECLARE @ActiveCategories INT = (SELECT COUNT(*) FROM dbo.Categories WHERE IsActive = 1);

PRINT N'seed-electronics-catalog-expansion: new products present = ' + CAST(@Inserted AS NVARCHAR(20))
    + N'; active categories = ' + CAST(@ActiveCategories AS NVARCHAR(20));
GO
