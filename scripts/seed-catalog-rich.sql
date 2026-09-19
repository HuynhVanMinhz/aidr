/*
  seed-catalog-rich.sql - diverse Approved products across leaf + root categories.

  Prerequisites:
    - Demo shop TechZone (POST /api/dev/seed-demo-accounts)
    - Category hierarchy (POST /api/dev/seed-categories or seed-electronics-refresh)
    - Optional: base catalog already present

  Idempotent by fixed ProductId (namespace 22222222-2222-2222-2222-22222222xxxx).
  Also remaps well-known demo SKUs from root categories onto leaf categories
  so storefront filters (Apple iPhone, Gaming Laptops, ...) show non-zero counts.

  After this script: POST /api/dev/seed-inventory-lots
*/

SET NOCOUNT ON;

DECLARE
    @ShopId UNIQUEIDENTIFIER = (
        SELECT TOP 1 ShopId FROM dbo.Shops
        WHERE ShopId = 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD' OR Status = N'Active'
        ORDER BY CASE WHEN ShopId = 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD' THEN 0 ELSE 1 END, CreatedAt
    ),
    @Now DATETIME2(3) = SYSUTCDATETIME();

IF @ShopId IS NULL
BEGIN
    PRINT N'seed-catalog-rich: skipped - no Active shop. Run seed-demo-accounts first.';
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'dien-thoai-apple')
BEGIN
    PRINT N'seed-catalog-rich: leaf categories missing - run seed-categories / seed-electronics-refresh first.';
    RETURN;
END;

DECLARE
    @CatApple INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'dien-thoai-apple'),
    @CatSamsung INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'dien-thoai-samsung'),
    @CatXiaomi INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'dien-thoai-xiaomi'),
    @CatMacbook INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'laptop-macbook'),
    @CatLapGaming INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'laptop-gaming'),
    @CatLapOffice INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'laptop-van-phong'),
    @CatCharger INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'phu-kien-sac'),
    @CatHeadphone INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'phu-kien-tai-nghe'),
    @CatTablet INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'tablet'),
    @CatWearable INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'deo-thong-minh');

UPDATE dbo.Products SET CategoryId = @CatApple, UpdatedAt = @Now
WHERE Slug IN (N'iphone-15-128gb') AND @CatApple IS NOT NULL;

UPDATE dbo.Products SET CategoryId = @CatSamsung, UpdatedAt = @Now
WHERE Slug IN (N'samsung-galaxy-s24-256gb') AND @CatSamsung IS NOT NULL;

UPDATE dbo.Products SET CategoryId = @CatXiaomi, UpdatedAt = @Now
WHERE Slug IN (N'xiaomi-14-256gb') AND @CatXiaomi IS NOT NULL;

UPDATE dbo.Products SET CategoryId = @CatMacbook, UpdatedAt = @Now
WHERE Slug IN (N'macbook-air-m3-13') AND @CatMacbook IS NOT NULL;

UPDATE dbo.Products SET CategoryId = @CatLapOffice, UpdatedAt = @Now
WHERE Slug IN (N'asus-vivobook-15-oled') AND @CatLapOffice IS NOT NULL;

UPDATE dbo.Products SET CategoryId = @CatLapGaming, UpdatedAt = @Now
WHERE Slug IN (N'dell-xps-15-9530') AND @CatLapGaming IS NOT NULL;

UPDATE dbo.Products SET CategoryId = @CatCharger, UpdatedAt = @Now
WHERE Slug IN (N'anker-735-gan-charger') AND @CatCharger IS NOT NULL;

UPDATE dbo.Products SET CategoryId = @CatHeadphone, UpdatedAt = @Now
WHERE Slug IN (N'airpods-pro-2', N'sony-wh-1000xm5') AND @CatHeadphone IS NOT NULL;

UPDATE dbo.Products SET CategoryId = @CatWearable, UpdatedAt = @Now
WHERE Slug = N'samsung-galaxy-watch-6' AND @CatWearable IS NOT NULL;

UPDATE dbo.Products SET CategoryId = @CatTablet, UpdatedAt = @Now
WHERE Slug = N'ipad-air-m2-128gb' AND @CatTablet IS NOT NULL;
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
    PRINT N'seed-catalog-rich: skipped - no Active shop.';
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
('22222222-2222-2222-2222-222222220001', N'dien-thoai-apple', N'iPhone 16 Pro 256GB', N'rich-iphone-16-pro-256', N'Titanium design, A18 Pro, 48MP camera system', N'Flagship iPhone 16 Pro with ProMotion display and USB-C.', N'Apple', N'IP16P-256',
 32990000, 31490000, 28, 12, N'{"ram":"8GB","storage":"256GB","screen":"6.3","chip":"A18 Pro"}', N'["RICH","PHONE","APPLE"]', 4.80, 42, 120, 1),
('22222222-2222-2222-2222-222222220002', N'dien-thoai-apple', N'iPhone 16 128GB', N'rich-iphone-16-128', N'A18 chip, Camera Control, long battery life', N'Everyday iPhone 16 with bright Super Retina XDR display.', N'Apple', N'IP16-128',
 22990000, 21990000, 40, 12, N'{"ram":"8GB","storage":"128GB","screen":"6.1","chip":"A18"}', N'["RICH","PHONE","APPLE"]', 4.70, 55, 210, 1),
('22222222-2222-2222-2222-222222220003', N'dien-thoai-apple', N'iPhone 15 Plus 256GB', N'rich-iphone-15-plus-256', N'6.7 inch display, Dynamic Island, USB-C', N'Large-screen iPhone 15 Plus for media and multitasking.', N'Apple', N'IP15P-256',
 24990000, NULL, 22, 12, N'{"ram":"6GB","storage":"256GB","screen":"6.7","chip":"A16"}', N'["RICH","PHONE","APPLE"]', 4.60, 31, 88, 0),
('22222222-2222-2222-2222-222222220004', N'dien-thoai-apple', N'iPhone SE 3rd Gen 128GB', N'rich-iphone-se-3-128', N'Compact Touch ID iPhone with A15', N'Affordable Apple phone with classic Home button design.', N'Apple', N'IPSE3-128',
 10990000, 9990000, 35, 12, N'{"ram":"4GB","storage":"128GB","screen":"4.7","chip":"A15"}', N'["RICH","PHONE","APPLE"]', 4.40, 19, 64, 0),
('22222222-2222-2222-2222-222222220011', N'dien-thoai-samsung', N'Samsung Galaxy S25 Ultra 512GB', N'rich-galaxy-s25-ultra-512', N'S-Pen, 200MP camera, AI features', N'Premium Galaxy Ultra for creators and power users.', N'Samsung', N'S25U-512',
 34990000, 33490000, 18, 12, N'{"ram":"12GB","storage":"512GB","screen":"6.8","chip":"Snapdragon 8 Elite"}', N'["RICH","PHONE","SAMSUNG"]', 4.85, 38, 95, 1),
('22222222-2222-2222-2222-222222220012', N'dien-thoai-samsung', N'Samsung Galaxy S24 FE 256GB', N'rich-galaxy-s24-fe-256', N'Flagship features at a mid-range price', N'Galaxy S24 FE with bright AMOLED and Galaxy AI tools.', N'Samsung', N'S24FE-256',
 14990000, 13990000, 45, 12, N'{"ram":"8GB","storage":"256GB","screen":"6.7"}', N'["RICH","PHONE","SAMSUNG"]', 4.55, 27, 140, 1),
('22222222-2222-2222-2222-222222220013', N'dien-thoai-samsung', N'Samsung Galaxy A55 5G 128GB', N'rich-galaxy-a55-128', N'IP67, 120Hz Super AMOLED, solid battery', N'Reliable mid-range Galaxy for everyday use.', N'Samsung', N'A55-128',
 9990000, 9290000, 60, 12, N'{"ram":"8GB","storage":"128GB","screen":"6.6"}', N'["RICH","PHONE","SAMSUNG"]', 4.45, 48, 260, 0),
('22222222-2222-2222-2222-222222220014', N'dien-thoai-samsung', N'Samsung Galaxy Z Flip6 256GB', N'rich-galaxy-z-flip6-256', N'Compact foldable with FlexMode', N'Fashion foldable phone with cover screen widgets.', N'Samsung', N'ZFLIP6-256',
 27990000, NULL, 12, 12, N'{"ram":"12GB","storage":"256GB","form":"foldable"}', N'["RICH","PHONE","SAMSUNG"]', 4.50, 16, 41, 1),
('22222222-2222-2222-2222-222222220021', N'dien-thoai-xiaomi', N'Xiaomi 14T Pro 512GB', N'rich-xiaomi-14t-pro-512', N'Leica optics, 120W HyperCharge', N'Xiaomi flagship killer with fast charging and vivid display.', N'Xiaomi', N'14TP-512',
 16990000, 15990000, 30, 12, N'{"ram":"12GB","storage":"512GB","charging":"120W"}', N'["RICH","PHONE","XIAOMI"]', 4.60, 33, 112, 1),
('22222222-2222-2222-2222-222222220022', N'dien-thoai-xiaomi', N'Redmi Note 13 Pro 256GB', N'rich-redmi-note-13-pro-256', N'200MP camera, AMOLED 120Hz', N'Popular Redmi Note series for value seekers.', N'Xiaomi', N'RN13P-256',
 7990000, 7490000, 70, 12, N'{"ram":"8GB","storage":"256GB","screen":"6.67"}', N'["RICH","PHONE","XIAOMI"]', 4.40, 61, 340, 0),
('22222222-2222-2222-2222-222222220023', N'dien-thoai-xiaomi', N'POCO X6 Pro 256GB', N'rich-poco-x6-pro-256', N'Dimensity 8300-Ultra, 120Hz flow AMOLED', N'Performance-focused POCO phone for gaming on a budget.', N'Xiaomi', N'X6P-256',
 8990000, NULL, 55, 12, N'{"ram":"12GB","storage":"256GB","chip":"Dimensity 8300"}', N'["RICH","PHONE","XIAOMI"]', 4.50, 29, 175, 0),
('22222222-2222-2222-2222-222222220024', N'dien-thoai-xiaomi', N'Xiaomi 13 Lite 128GB', N'rich-xiaomi-13-lite-128', N'Slim design, dual selfie cameras', N'Lightweight Xiaomi for social and daily apps.', N'Xiaomi', N'13L-128',
 6990000, 6490000, 40, 12, N'{"ram":"8GB","storage":"128GB","screen":"6.55"}', N'["RICH","PHONE","XIAOMI"]', 4.30, 18, 90, 0),
('22222222-2222-2222-2222-222222220031', N'dien-thoai-oppo', N'OPPO Find X7 Ultra 512GB', N'rich-oppo-find-x7-ultra-512', N'Hasselblad camera system, flagship SoC', N'OPPO ultra flagship focused on photography.', N'OPPO', N'FX7U-512',
 28990000, 27490000, 15, 12, N'{"ram":"16GB","storage":"512GB","camera":"Hasselblad"}', N'["RICH","PHONE","OPPO"]', 4.70, 21, 52, 1),
('22222222-2222-2222-2222-222222220032', N'dien-thoai-oppo', N'OPPO Reno12 Pro 256GB', N'rich-oppo-reno12-pro-256', N'AI portrait, slim curved design', N'Stylish Reno series for creators and selfies.', N'OPPO', N'RENO12P-256',
 12990000, 11990000, 38, 12, N'{"ram":"12GB","storage":"256GB","screen":"6.7"}', N'["RICH","PHONE","OPPO"]', 4.50, 36, 148, 1),
('22222222-2222-2222-2222-222222220033', N'dien-thoai-oppo', N'OPPO A79 5G 128GB', N'rich-oppo-a79-128', N'Large battery, 5G, ColorOS', N'Entry OPPO with reliable daily performance.', N'OPPO', N'A79-128',
 5990000, 5490000, 80, 12, N'{"ram":"8GB","storage":"128GB","battery":"5000mAh"}', N'["RICH","PHONE","OPPO"]', 4.20, 44, 290, 0),
('22222222-2222-2222-2222-222222220034', N'dien-thoai-oppo', N'OPPO Find N3 Flip 256GB', N'rich-oppo-find-n3-flip-256', N'Flip form factor with cover screen', N'Compact foldable OPPO with Hasselblad camera.', N'OPPO', N'N3FLIP-256',
 21990000, NULL, 10, 12, N'{"ram":"12GB","storage":"256GB","form":"flip"}', N'["RICH","PHONE","OPPO"]', 4.55, 12, 28, 0),
('22222222-2222-2222-2222-222222220041', N'laptop-gaming', N'ASUS ROG Strix G16 RTX 4060', N'rich-asus-rog-strix-g16', N'Intel i7, 16GB RAM, RTX 4060, 165Hz', N'Gaming notebook for AAA titles and streaming.', N'ASUS', N'G16-4060',
 42990000, 40990000, 12, 24, N'{"cpu":"i7-13650HX","ram":"16GB","gpu":"RTX 4060","storage":"1TB"}', N'["RICH","LAPTOP","GAMING"]', 4.65, 24, 57, 1),
('22222222-2222-2222-2222-222222220042', N'laptop-gaming', N'MSI Katana 15 RTX 4050', N'rich-msi-katana-15-4050', N'Ryzen 7, 16GB, RTX 4050, 144Hz', N'Balanced gaming laptop for students and esports.', N'MSI', N'KATANA15',
 28990000, 27490000, 20, 24, N'{"cpu":"Ryzen 7 7735HS","ram":"16GB","gpu":"RTX 4050"}', N'["RICH","LAPTOP","GAMING"]', 4.40, 31, 89, 0),
('22222222-2222-2222-2222-222222220043', N'laptop-gaming', N'Acer Nitro V 15 RTX 4050', N'rich-acer-nitro-v15', N'Core i5, 16GB, RTX 4050', N'Value gaming laptop with strong thermals for the price.', N'Acer', N'NITRO-V15',
 24990000, 23490000, 25, 24, N'{"cpu":"i5-13420H","ram":"16GB","gpu":"RTX 4050"}', N'["RICH","LAPTOP","GAMING"]', 4.35, 28, 110, 0),
('22222222-2222-2222-2222-222222220044', N'laptop-gaming', N'Lenovo Legion 5 Pro RTX 4070', N'rich-lenovo-legion-5-pro', N'AMD Ryzen 7, 32GB, RTX 4070, QHD+', N'Creator/gamer hybrid with high-refresh QHD panel.', N'Lenovo', N'LEGION5P',
 48990000, NULL, 8, 24, N'{"cpu":"Ryzen 7 7745HX","ram":"32GB","gpu":"RTX 4070"}', N'["RICH","LAPTOP","GAMING"]', 4.75, 17, 39, 1),
('22222222-2222-2222-2222-222222220045', N'laptop-gaming', N'HP Victus 16 RTX 4060', N'rich-hp-victus-16-4060', N'Large 16 inch display, RTX 4060', N'Comfortable gaming laptop for home setups.', N'HP', N'VICTUS16',
 31990000, 29990000, 14, 24, N'{"cpu":"i7-13700H","ram":"16GB","gpu":"RTX 4060"}', N'["RICH","LAPTOP","GAMING"]', 4.45, 20, 61, 0),
('22222222-2222-2222-2222-222222220051', N'laptop-van-phong', N'Dell Inspiron 14 Plus', N'rich-dell-inspiron-14-plus', N'Intel Ultra 7, 16GB, OLED', N'Slim office laptop with vivid OLED for productivity.', N'Dell', N'INS14P',
 27990000, 26490000, 22, 24, N'{"cpu":"Intel Ultra 7","ram":"16GB","storage":"512GB","screen":"14 OLED"}', N'["RICH","LAPTOP","OFFICE"]', 4.55, 26, 74, 1),
('22222222-2222-2222-2222-222222220052', N'laptop-van-phong', N'Lenovo IdeaPad Slim 5', N'rich-lenovo-ideapad-slim-5', N'Ryzen 5, 16GB, 512GB SSD', N'Lightweight everyday notebook for study and office.', N'Lenovo', N'SLIM5',
 18990000, 17990000, 35, 24, N'{"cpu":"Ryzen 5 7530U","ram":"16GB","storage":"512GB"}', N'["RICH","LAPTOP","OFFICE"]', 4.40, 40, 180, 0),
('22222222-2222-2222-2222-222222220053', N'laptop-van-phong', N'HP Pavilion 15', N'rich-hp-pavilion-15', N'Core i5, 16GB, FHD IPS', N'Reliable all-rounder for homework and meetings.', N'HP', N'PAV15',
 16990000, NULL, 40, 24, N'{"cpu":"i5-1335U","ram":"16GB","storage":"512GB"}', N'["RICH","LAPTOP","OFFICE"]', 4.30, 33, 205, 0),
('22222222-2222-2222-2222-222222220054', N'laptop-van-phong', N'ASUS Zenbook 14 OLED', N'rich-asus-zenbook-14-oled', N'Ultra-portable OLED ultraportable', N'Premium thin-and-light for professionals on the go.', N'ASUS', N'ZB14',
 29990000, 28490000, 16, 24, N'{"cpu":"Intel Ultra 5","ram":"16GB","screen":"14 OLED"}', N'["RICH","LAPTOP","OFFICE"]', 4.70, 22, 68, 1),
('22222222-2222-2222-2222-222222220055', N'laptop-van-phong', N'Acer Aspire 5', N'rich-acer-aspire-5', N'Budget office laptop, Wi-Fi 6', N'Affordable Acer for students and remote work.', N'Acer', N'ASP5',
 13990000, 12990000, 48, 24, N'{"cpu":"i5-1235U","ram":"8GB","storage":"512GB"}', N'["RICH","LAPTOP","OFFICE"]', 4.20, 51, 260, 0),
('22222222-2222-2222-2222-222222220061', N'laptop-macbook', N'MacBook Air 15 M3 256GB', N'rich-macbook-air-15-m3', N'Larger Air with M3 and all-day battery', N'MacBook Air 15-inch for multitasking without a fan.', N'Apple', N'MBA15-M3',
 34990000, 33490000, 14, 12, N'{"chip":"M3","ram":"8GB","storage":"256GB","screen":"15.3"}', N'["RICH","LAPTOP","APPLE"]', 4.80, 29, 77, 1),
('22222222-2222-2222-2222-222222220062', N'laptop-macbook', N'MacBook Pro 14 M3 Pro 512GB', N'rich-macbook-pro-14-m3-pro', N'ProMotion, MagSafe, pro ports', N'MacBook Pro 14 for developers and video editors.', N'Apple', N'MBP14-M3P',
 52990000, NULL, 9, 12, N'{"chip":"M3 Pro","ram":"18GB","storage":"512GB"}', N'["RICH","LAPTOP","APPLE"]', 4.85, 18, 41, 1),
('22222222-2222-2222-2222-222222220063', N'laptop-macbook', N'MacBook Air 13 M2 256GB', N'rich-macbook-air-13-m2', N'Classic Air silhouette, silent fanless design', N'Entry MacBook Air still excellent for students.', N'Apple', N'MBA13-M2',
 24990000, 23490000, 20, 12, N'{"chip":"M2","ram":"8GB","storage":"256GB"}', N'["RICH","LAPTOP","APPLE"]', 4.70, 45, 190, 0),
('22222222-2222-2222-2222-222222220064', N'laptop-macbook', N'MacBook Pro 16 M3 Max 1TB', N'rich-macbook-pro-16-m3-max', N'Maximum GPU cores for heavy workloads', N'Top-tier MacBook Pro 16 for 3D and color grading.', N'Apple', N'MBP16-M3M',
 79990000, 77990000, 5, 12, N'{"chip":"M3 Max","ram":"36GB","storage":"1TB"}', N'["RICH","LAPTOP","APPLE"]', 4.90, 9, 15, 1),
('22222222-2222-2222-2222-222222220071', N'phu-kien-sac', N'Anker 737 GaNPrime 120W', N'rich-anker-737-120w', N'3-port GaN charger for laptop + phone', N'High-wattage Anker charger for travel desks.', N'Anker', N'737-120W',
 1890000, 1690000, 55, 18, N'{"max_watt":"120W","ports":"2xUSB-C,1xUSB-A"}', N'["RICH","ACCESSORY","CHARGER"]', 4.70, 62, 310, 1),
('22222222-2222-2222-2222-222222220072', N'phu-kien-sac', N'Baseus 65W GaN Charger', N'rich-baseus-65w-gan', N'Compact dual USB-C PD charger', N'Pocket GaN brick for phones and ultrabooks.', N'Baseus', N'B65W',
 590000, 490000, 90, 12, N'{"max_watt":"65W","connector":"USB-C"}', N'["RICH","ACCESSORY","CHARGER"]', 4.40, 71, 420, 0),
('22222222-2222-2222-2222-222222220073', N'phu-kien-sac', N'UGREEN USB-C to USB-C Cable 100W 2m', N'rich-ugreen-usbc-100w-2m', N'E-Marker cable, braided, 2 meters', N'Durable 100W cable for fast laptop charging.', N'UGREEN', N'UC100-2M',
 290000, NULL, 120, 12, N'{"max_watt":"100W","length":"2m"}', N'["RICH","ACCESSORY","CABLE"]', 4.50, 88, 560, 0),
('22222222-2222-2222-2222-222222220074', N'phu-kien-sac', N'Samsung 45W Super Fast Charger', N'rich-samsung-45w-charger', N'Official Samsung PPS charger', N'Best match for Galaxy Super Fast Charging 2.0.', N'Samsung', N'S45W',
 790000, 690000, 70, 12, N'{"max_watt":"45W","protocol":"PPS"}', N'["RICH","ACCESSORY","CHARGER"]', 4.55, 40, 220, 0),
('22222222-2222-2222-2222-222222220075', N'phu-kien-sac', N'Apple 35W Dual USB-C Charger', N'rich-apple-35w-dual', N'Charge iPhone + AirPods together', N'Compact Apple dual-port USB-C power adapter.', N'Apple', N'A35W',
 1290000, NULL, 45, 12, N'{"max_watt":"35W","ports":"2xUSB-C"}', N'["RICH","ACCESSORY","CHARGER"]', 4.60, 25, 95, 0),
('22222222-2222-2222-2222-222222220081', N'phu-kien-op', N'Spigen Ultra Hybrid iPhone 16 Pro', N'rich-spigen-ultra-hybrid-ip16p', N'Clear back, Military-grade drop protection', N'Spigen hybrid case designed for iPhone 16 Pro.', N'Spigen', N'SUH-IP16P',
 490000, 390000, 80, 6, N'{"model":"iPhone 16 Pro","material":"TPU+PC"}', N'["RICH","ACCESSORY","CASE"]', 4.60, 54, 300, 1),
('22222222-2222-2222-2222-222222220082', N'phu-kien-op', N'OtterBox Defender Galaxy S25 Ultra', N'rich-otterbox-defender-s25u', N'Multi-layer rugged case with holster', N'Maximum protection OtterBox for Galaxy Ultra.', N'OtterBox', N'DEF-S25U',
 1190000, NULL, 35, 12, N'{"model":"Galaxy S25 Ultra","rating":"MIL-STD"}', N'["RICH","ACCESSORY","CASE"]', 4.50, 19, 48, 0),
('22222222-2222-2222-2222-222222220083', N'phu-kien-op', N'ESR Classic Clear MagSafe Case', N'rich-esr-magsafe-clear', N'MagSafe compatible, yellowing-resistant', N'Clear MagSafe case for modern iPhones.', N'ESR', N'ESR-MS',
 390000, 320000, 100, 6, N'{"magsafe":"true","material":"TPU"}', N'["RICH","ACCESSORY","CASE"]', 4.40, 66, 410, 0),
('22222222-2222-2222-2222-222222220084', N'phu-kien-op', N'Ringke Fusion Xiaomi 14', N'rich-ringke-fusion-xiaomi-14', N'Slim clear case with matte frame', N'Everyday protection case for Xiaomi 14.', N'Ringke', N'RF-X14',
 290000, NULL, 75, 6, N'{"model":"Xiaomi 14"}', N'["RICH","ACCESSORY","CASE"]', 4.30, 22, 130, 0),
('22222222-2222-2222-2222-222222220085', N'phu-kien-op', N'Nillkin CamShield OPPO Reno12', N'rich-nillkin-camshield-reno12', N'Sliding camera cover, hard PC shell', N'Camera-protecting hard case for Reno12.', N'Nillkin', N'NC-R12',
 250000, 199000, 85, 6, N'{"model":"OPPO Reno12","camera_cover":"true"}', N'["RICH","ACCESSORY","CASE"]', 4.25, 17, 98, 0),
('22222222-2222-2222-2222-222222220091', N'phu-kien-tai-nghe', N'Sony WF-1000XM5', N'rich-sony-wf-1000xm5', N'Best-in-class ANC earbuds', N'True wireless Sony earbuds for commute and focus.', N'Sony', N'WF1000XM5',
 6490000, 5990000, 30, 12, N'{"type":"earbuds","anc":"true","battery":"24h"}', N'["RICH","AUDIO","HEADPHONE"]', 4.75, 47, 155, 1),
('22222222-2222-2222-2222-222222220092', N'phu-kien-tai-nghe', N'Bose QuietComfort Ultra Headphones', N'rich-bose-qc-ultra', N'Immersive Audio, premium ANC', N'Over-ear Bose for long flights and deep focus.', N'Bose', N'QCULTRA',
 10990000, 9990000, 18, 12, N'{"type":"over-ear","anc":"true"}', N'["RICH","AUDIO","HEADPHONE"]', 4.80, 28, 72, 1),
('22222222-2222-2222-2222-222222220093', N'phu-kien-tai-nghe', N'Sennheiser Momentum 4 Wireless', N'rich-sennheiser-momentum-4', N'60h battery, audiophile tuning', N'Hi-fi wireless headphones with long endurance.', N'Sennheiser', N'MOM4',
 8990000, NULL, 16, 24, N'{"type":"over-ear","battery":"60h"}', N'["RICH","AUDIO","HEADPHONE"]', 4.70, 21, 54, 0),
('22222222-2222-2222-2222-222222220094', N'phu-kien-tai-nghe', N'JBL Tune 760NC', N'rich-jbl-tune-760nc', N'Affordable ANC over-ear', N'Everyday JBL headphones with punchy bass.', N'JBL', N'T760NC',
 2490000, 2190000, 50, 12, N'{"type":"over-ear","anc":"true"}', N'["RICH","AUDIO","HEADPHONE"]', 4.30, 63, 280, 0),
('22222222-2222-2222-2222-222222220095', N'phu-kien-tai-nghe', N'Samsung Galaxy Buds3 Pro', N'rich-galaxy-buds3-pro', N'Galaxy AI audio, IP57', N'Best Galaxy companion earbuds with ANC.', N'Samsung', N'BUDS3P',
 5490000, 4990000, 40, 12, N'{"type":"earbuds","anc":"true"}', N'["RICH","AUDIO","HEADPHONE"]', 4.55, 34, 140, 0),
('22222222-2222-2222-2222-222222220101', N'am-thanh', N'Sony SRS-XG300 Party Speaker', N'rich-sony-srs-xg300', N'Portable Bluetooth party speaker', N'Loud portable Sony speaker with lighting effects.', N'Sony', N'XG300',
 6990000, 6490000, 20, 12, N'{"type":"speaker","battery":"25h","ip":"IP67"}', N'["RICH","AUDIO","SPEAKER"]', 4.50, 19, 61, 1),
('22222222-2222-2222-2222-222222220102', N'am-thanh', N'JBL Charge 5', N'rich-jbl-charge-5', N'Powerbank speaker, IP67', N'Iconic JBL portable speaker that can charge your phone.', N'JBL', N'CHARGE5',
 3990000, 3590000, 35, 12, N'{"type":"speaker","battery":"20h"}', N'["RICH","AUDIO","SPEAKER"]', 4.60, 72, 340, 1),
('22222222-2222-2222-2222-222222220103', N'am-thanh', N'Marshall Emberton II', N'rich-marshall-emberton-ii', N'Compact Marshall signature sound', N'Stylish travel speaker with classic Marshall look.', N'Marshall', N'EMB2',
 4490000, NULL, 22, 12, N'{"type":"speaker","battery":"30h"}', N'["RICH","AUDIO","SPEAKER"]', 4.55, 26, 98, 0),
('22222222-2222-2222-2222-222222220104', N'am-thanh', N'Apple HomePod mini', N'rich-homepod-mini', N'Siri, Spatial Audio, smart home hub', N'Compact Apple smart speaker for rooms and HomeKit.', N'Apple', N'HPmini',
 2490000, 2290000, 28, 12, N'{"type":"smart-speaker","assistant":"Siri"}', N'["RICH","AUDIO","SMART"]', 4.40, 41, 170, 0),
('22222222-2222-2222-2222-222222220111', N'tablet', N'iPad Pro 11 M4 256GB', N'rich-ipad-pro-11-m4', N'Ultra Retina XDR, Apple Pencil Pro', N'Pro tablet for illustration and productivity.', N'Apple', N'IPADP11-M4',
 27990000, 26990000, 14, 12, N'{"chip":"M4","storage":"256GB","screen":"11"}', N'["RICH","TABLET"]', 4.85, 23, 58, 1),
('22222222-2222-2222-2222-222222220112', N'tablet', N'iPad 10th Gen 64GB', N'rich-ipad-10-64', N'USB-C, colorful all-screen design', N'Affordable iPad for streaming and notes.', N'Apple', N'IPAD10-64',
 10990000, 9990000, 30, 12, N'{"chip":"A14","storage":"64GB"}', N'["RICH","TABLET"]', 4.50, 55, 210, 0),
('22222222-2222-2222-2222-222222220113', N'tablet', N'Samsung Galaxy Tab S9 FE', N'rich-galaxy-tab-s9-fe', N'S-Pen included, IP68', N'Android tablet for notes and media at home.', N'Samsung', N'TABS9FE',
 11990000, 10990000, 24, 12, N'{"storage":"128GB","s_pen":"true"}', N'["RICH","TABLET"]', 4.45, 29, 95, 1),
('22222222-2222-2222-2222-222222220114', N'tablet', N'Xiaomi Pad 6 256GB', N'rich-xiaomi-pad-6-256', N'144Hz display, Snapdragon 870', N'Value Android tablet for entertainment.', N'Xiaomi', N'PAD6-256',
 7990000, 7490000, 32, 12, N'{"ram":"8GB","storage":"256GB","refresh":"144Hz"}', N'["RICH","TABLET"]', 4.40, 37, 150, 0),
('22222222-2222-2222-2222-222222220115', N'tablet', N'Lenovo Tab P12', N'rich-lenovo-tab-p12', N'Large entertainment tablet with pen option', N'Family tablet for kids apps and movies.', N'Lenovo', N'TABP12',
 8990000, NULL, 18, 12, N'{"storage":"128GB","screen":"12.7"}', N'["RICH","TABLET"]', 4.20, 14, 46, 0),
('22222222-2222-2222-2222-222222220121', N'deo-thong-minh', N'Apple Watch Series 10 45mm', N'rich-apple-watch-s10-45', N'Thinner design, health sensors, watchOS', N'Latest Apple Watch for fitness and notifications.', N'Apple', N'AWS10-45',
 11990000, 11490000, 22, 12, N'{"size":"45mm","gps":"true"}', N'["RICH","WEARABLE"]', 4.75, 31, 88, 1),
('22222222-2222-2222-2222-222222220122', N'deo-thong-minh', N'Apple Watch SE 2 40mm', N'rich-apple-watch-se2-40', N'Essential Apple Watch features', N'Affordable Apple Watch for everyday tracking.', N'Apple', N'AWSE2-40',
 6490000, 5990000, 35, 12, N'{"size":"40mm","gps":"true"}', N'["RICH","WEARABLE"]', 4.50, 48, 200, 0),
('22222222-2222-2222-2222-222222220123', N'deo-thong-minh', N'Garmin Forerunner 265', N'rich-garmin-forerunner-265', N'AMOLED running watch, training readiness', N'Garmin GPS watch for runners and triathletes.', N'Garmin', N'FR265',
 9990000, NULL, 15, 12, N'{"gps":"multi-band","battery":"13d"}', N'["RICH","WEARABLE"]', 4.70, 17, 42, 1),
('22222222-2222-2222-2222-222222220124', N'deo-thong-minh', N'Xiaomi Smart Band 8 Pro', N'rich-xiaomi-band-8-pro', N'Large AMOLED, GPS version', N'Budget fitness band with rich health metrics.', N'Xiaomi', N'BAND8P',
 1490000, 1290000, 80, 12, N'{"display":"AMOLED","gps":"true"}', N'["RICH","WEARABLE"]', 4.35, 90, 520, 0),
('22222222-2222-2222-2222-222222220125', N'deo-thong-minh', N'Google Pixel Watch 2', N'rich-pixel-watch-2', N'Fitbit coaching, Wear OS', N'Pixel Watch with Fitbit insights for Android users.', N'Google', N'PW2',
 8990000, 8490000, 18, 12, N'{"os":"Wear OS","fitbit":"true"}', N'["RICH","WEARABLE"]', 4.40, 20, 55, 0),
('22222222-2222-2222-2222-222222220131', N'tivi-man-hinh', N'LG OLED C4 55 inch', N'rich-lg-oled-c4-55', N'OLED evo, webOS, Dolby Vision', N'Cinema-grade OLED TV for movies and console gaming.', N'LG', N'C4-55',
 32990000, 30990000, 10, 24, N'{"size":"55","panel":"OLED","hdmi":"4"}', N'["RICH","TV"]', 4.80, 22, 48, 1),
('22222222-2222-2222-2222-222222220132', N'tivi-man-hinh', N'Sony Bravia 7 65 inch Mini LED', N'rich-sony-bravia-7-65', N'XR processor, Gaming features', N'Bright Mini LED TV for living rooms.', N'Sony', N'BRAVIA7-65',
 44990000, NULL, 7, 24, N'{"size":"65","panel":"MiniLED"}', N'["RICH","TV"]', 4.75, 11, 19, 1),
('22222222-2222-2222-2222-222222220133', N'tivi-man-hinh', N'Dell UltraSharp U2723QE 27 inch', N'rich-dell-u2723qe', N'4K IPS Black, USB-C 90W', N'Productivity monitor for designers and developers.', N'Dell', N'U2723QE',
 12990000, 11990000, 20, 36, N'{"size":"27","resolution":"4K","panel":"IPS"}', N'["RICH","MONITOR"]', 4.70, 35, 110, 0),
('22222222-2222-2222-2222-222222220134', N'tivi-man-hinh', N'ASUS TUF Gaming VG27AQ 27 inch', N'rich-asus-tuf-vg27aq', N'1440p 165Hz, G-Sync Compatible', N'Esports monitor with Adaptive-Sync.', N'ASUS', N'VG27AQ',
 6990000, 6490000, 28, 36, N'{"size":"27","refresh":"165Hz","resolution":"1440p"}', N'["RICH","MONITOR"]', 4.55, 44, 180, 0),
('22222222-2222-2222-2222-222222220135', N'tivi-man-hinh', N'Samsung Odyssey G5 32 inch', N'rich-samsung-odyssey-g5-32', N'1000R curve, 144Hz, 1440p', N'Immersive curved gaming monitor.', N'Samsung', N'G5-32',
 7490000, NULL, 22, 24, N'{"size":"32","refresh":"144Hz","curve":"1000R"}', N'["RICH","MONITOR"]', 4.40, 27, 95, 0),
('22222222-2222-2222-2222-222222220141', N'nha-thong-minh', N'Google Nest Cam (battery)', N'rich-google-nest-cam-battery', N'Wireless security camera, HDR', N'Wire-free Nest Cam with intelligent alerts.', N'Google', N'NESTCAM-B',
 3990000, 3590000, 25, 12, N'{"power":"battery","resolution":"1080p"}', N'["RICH","SMARTHOME"]', 4.45, 30, 88, 1),
('22222222-2222-2222-2222-222222220142', N'nha-thong-minh', N'Amazon Echo Dot 5th Gen', N'rich-echo-dot-5', N'Alexa smart speaker, temperature sensor', N'Compact Echo for smart home routines.', N'Amazon', N'ECHODOT5',
 1490000, 1290000, 60, 12, N'{"assistant":"Alexa"}', N'["RICH","SMARTHOME"]', 4.40, 70, 360, 0),
('22222222-2222-2222-2222-222222220143', N'nha-thong-minh', N'Philips Hue Starter Kit E27', N'rich-philips-hue-starter', N'Bridge + 3 bulbs, app scenes', N'Color smart lighting kit for whole-room ambience.', N'Philips', N'HUE-KIT',
 3990000, NULL, 20, 24, N'{"protocol":"Zigbee","bulbs":"3"}', N'["RICH","SMARTHOME"]', 4.60, 24, 70, 1),
('22222222-2222-2222-2222-222222220144', N'nha-thong-minh', N'TP-Link Tapo P110 Mini Smart Plug', N'rich-tapo-p110', N'Energy monitoring, schedules', N'Affordable Wi-Fi plug for lamps and fans.', N'TP-Link', N'P110',
 290000, 249000, 100, 12, N'{"wifi":"2.4GHz","energy_monitor":"true"}', N'["RICH","SMARTHOME"]', 4.50, 95, 640, 0),
('22222222-2222-2222-2222-222222220145', N'nha-thong-minh', N'Aqara Camera Hub G3', N'rich-aqara-g3', N'Zigbee hub + AI camera, HomeKit', N'All-in-one Aqara hub with gesture control camera.', N'Aqara', N'G3',
 3490000, 3190000, 16, 12, N'{"hub":"Zigbee","camera":"2K"}', N'["RICH","SMARTHOME"]', 4.55, 18, 42, 0),
('22222222-2222-2222-2222-222222220151', N'gaming-gear', N'Logitech G Pro X Superlight 2', N'rich-logitech-gpro-x-sl2', N'Ultra-light wireless esports mouse', N'Pro mouse for competitive FPS players.', N'Logitech', N'GPX-SL2',
 3490000, 3190000, 40, 24, N'{"dpi":"32000","weight":"60g","wireless":"true"}', N'["RICH","GAMING"]', 4.80, 58, 220, 1),
('22222222-2222-2222-2222-222222220152', N'gaming-gear', N'Razer BlackWidow V4 Pro', N'rich-razer-blackwidow-v4-pro', N'Hot-swappable mechanical, Command Dial', N'Flagship Razer keyboard with wrist rest.', N'Razer', N'BWV4P',
 5990000, NULL, 18, 24, N'{"switches":"Green","wireless":"hybrid"}', N'["RICH","GAMING"]', 4.60, 21, 67, 1),
('22222222-2222-2222-2222-222222220153', N'gaming-gear', N'SteelSeries Arctis Nova Pro Wireless', N'rich-arctis-nova-pro', N'Hi-Fi audio, dual batteries, GameDAC', N'Premium wireless headset for PC and console.', N'SteelSeries', N'NOVAPRO',
 7990000, 7490000, 14, 24, N'{"platform":"PC/PS","anc":"true"}', N'["RICH","GAMING"]', 4.70, 16, 39, 0),
('22222222-2222-2222-2222-222222220154', N'gaming-gear', N'Keychron Q1 HE', N'rich-keychron-q1-he', N'Magnetic Hall switches, gasket mount', N'Enthusiast mechanical keyboard for typists and gamers.', N'Keychron', N'Q1HE',
 5490000, 4990000, 20, 24, N'{"layout":"75%","switches":"magnetic"}', N'["RICH","GAMING"]', 4.75, 27, 81, 0),
('22222222-2222-2222-2222-222222220155', N'gaming-gear', N'Xbox Wireless Controller Carbon Black', N'rich-xbox-controller-carbon', N'Official Xbox / PC Bluetooth controller', N'Standard Xbox pad for PC Game Pass and console.', N'Microsoft', N'XBOXPAD',
 1690000, 1490000, 55, 12, N'{"platform":"Xbox/PC","wireless":"true"}', N'["RICH","GAMING"]', 4.55, 80, 410, 0),
('22222222-2222-2222-2222-222222220161', N'phu-kien', N'Anker Power Bank 20000mAh 30W', N'rich-anker-powerbank-20k', N'USB-C PD 30W bidirectional', N'Travel power bank for phone and tablet top-ups.', N'Anker', N'PB20K',
 1290000, 1090000, 65, 18, N'{"capacity":"20000mAh","max_watt":"30W"}', N'["RICH","ACCESSORY"]', 4.65, 74, 380, 1),
('22222222-2222-2222-2222-222222220162', N'phu-kien', N'Belkin MagSafe 3-in-1 Stand', N'rich-belkin-magsafe-3in1', N'Charge iPhone, Watch, AirPods together', N'Desk MagSafe charging stand for Apple users.', N'Belkin', N'MS3IN1',
 3990000, 3590000, 20, 12, N'{"magsafe":"true","watch":"true"}', N'["RICH","ACCESSORY"]', 4.50, 23, 70, 0),
('22222222-2222-2222-2222-222222220163', N'phu-kien', N'Peak Design Mobile Tripod', N'rich-peak-design-tripod', N'Ultra-portable phone tripod', N'Creator tripod that folds into a slim bar.', N'Peak Design', N'PDTRIPOD',
 2490000, NULL, 25, 12, N'{"compatible":"phones","material":"aluminum"}', N'["RICH","ACCESSORY"]', 4.70, 15, 44, 0),
('22222222-2222-2222-2222-222222220164', N'phu-kien', N'Sandisk Extreme Portable SSD 1TB', N'rich-sandisk-extreme-1tb', N'1050MB/s, IP65 rugged SSD', N'Pocket SSD for video offload and backups.', N'SanDisk', N'EXT1TB',
 3290000, 2990000, 30, 36, N'{"capacity":"1TB","speed":"1050MBs"}', N'["RICH","ACCESSORY"]', 4.60, 39, 130, 0);

INSERT INTO dbo.Products (
    ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
    Brand, ModelNumber, ConditionType, BasePrice, SalePrice, Currency,
    StockQuantity, ReservedQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
    Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount, IsFeatured, CreatedAt, UpdatedAt
)
SELECT
    r.ProductId, @ShopId, c.CategoryId, r.Name, r.Slug, r.ShortDescription, r.Description,
    r.Brand, r.ModelNumber, N'New', r.BasePrice, r.SalePrice, N'VND',
    r.Stock, 0, r.Warranty, N'Vietnam', r.SpecsJson, r.TagsJson,
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
DECLARE @Approved INT = (SELECT COUNT(*) FROM dbo.Products WHERE Status = N'Approved');

PRINT N'seed-catalog-rich: rich SKUs present = ' + CAST(@Inserted AS NVARCHAR(20))
    + N'; total Approved = ' + CAST(@Approved AS NVARCHAR(20));
GO
