/*
  AIDR — Refresh catalog for an electronics storefront.
  Deactivates non-electronics/junk categories, normalizes shops,
  upserts electronics products, sets mock image URLs
  (https://cdn.aidr.local/mock/...) for later replacement.

  Prerequisites: schema + seed-demo-accounts (TechZone shop).
  Dev: POST /api/dev/seed-electronics-refresh
*/

SET NOCOUNT ON;

DECLARE
    @Now DATETIME2(3) = SYSUTCDATETIME(),
    @ShopId UNIQUEIDENTIFIER = 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD',
    @BuyerId UNIQUEIDENTIFIER = 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC',
    @MockBase NVARCHAR(128) = N'/theme/images/product-image-1.png',
    @CatPhone INT,
    @CatLaptop INT,
    @CatTablet INT,
    @CatAudio INT,
    @CatAccess INT,
    @CatWearable INT,
    @CatTv INT,
    @CatSmartHome INT,
    @CatGaming INT;

IF NOT EXISTS (SELECT 1 FROM dbo.Shops WHERE ShopId = @ShopId)
    SELECT TOP (1) @ShopId = ShopId FROM dbo.Shops WHERE Status = N'Active' ORDER BY CreatedAt;

IF @ShopId IS NULL
BEGIN
    RAISERROR(N'Demo shop missing. Run seed-demo-accounts first.', 16, 1);
    RETURN;
END;

/* 1. Shops */
UPDATE dbo.Shops SET
    ShopName = N'TechZone Official',
    Slug = N'techzone-official',
    Tagline = N'Authentic phones, laptops & gadgets',
    ShortDescription = N'Authorized electronics retailer for smartphones, laptops, audio and accessories.',
    Description = N'TechZone Official stocks genuine electronics with manufacturer warranty, fast delivery, and transparent pricing.',
    LogoUrl = @MockBase + N'/shops/techzone-logo.png',
    BannerUrl = @MockBase + N'/shops/techzone-banner.png',
    Email = N'shop@techzone.vn',
    Phone = N'0900000002',
    ReturnPolicy = N'7-day return for manufacturer defects with original box and invoice.',
    ShippingPolicy = N'Shipping 1-3 days in Hanoi metro; 2-5 days nationwide.',
    UpdatedAt = @Now
WHERE ShopId = @ShopId;

UPDATE dbo.Shops SET
    ShopName = N'AudioPulse Store',
    Slug = N'audiopulse-store',
    Tagline = N'Headphones, earbuds & speakers',
    ShortDescription = N'Premium audio gear and wearable tech.',
    Description = N'AudioPulse focuses on headphones, TWS earbuds, Bluetooth speakers and fitness wearables.',
    LogoUrl = @MockBase + N'/shops/audiopulse-logo.png',
    BannerUrl = @MockBase + N'/shops/audiopulse-banner.png',
    UpdatedAt = @Now
WHERE Slug IN (N'sportify-gear', N'audiopulse-store') OR ShopName LIKE N'Sportify%';

UPDATE dbo.Shops SET
    ShopName = N'PixelNest Gadgets',
    Slug = N'pixelnest-gadgets',
    Tagline = N'Tablets, chargers & smart home',
    ShortDescription = N'Tablets, charging gear, and smart-home devices.',
    Description = N'PixelNest Gadgets sells tablets, GaN chargers, smart plugs, and home cameras.',
    LogoUrl = @MockBase + N'/shops/pixelnest-logo.png',
    BannerUrl = @MockBase + N'/shops/pixelnest-banner.png',
    UpdatedAt = @Now
WHERE Slug IN (N'book-corner-vn', N'pixelnest-gadgets') OR ShopName LIKE N'Book Corner%';

/* 2. Deactivate non-electronics / junk */
UPDATE dbo.Categories SET IsActive = 0, UpdatedAt = @Now
WHERE Slug IN (
    N'thoi-trang', N'thoi-trang-nam', N'thoi-trang-nu', N'thoi-trang-giay',
    N'sach-van-phong-pham', N'sach-ky-nang', N'sach-thieu-nhi',
    N'the-thao-ngoai-troi', N'the-thao-yoga', N'the-thao-bong-da',
    N'my-pham', N'my-pham-skincare', N'my-pham-makeup',
    N'me-be', N'me-be-sua',
    N'o-to-xe-may', N'xe-may-phu-kien',
    N'thiet-bi-gia-dung', N'gia-dung-bep', N'gia-dung-lam-sach',
    N'a', N'aaasasfsf', N'aaasasfsf1', N'aaasasfsf12'
) OR Name IN (N'a', N'aaasasfsf', N'aaasasfsf1', N'aaasasfsf12');

UPDATE dbo.Categories SET
    Name = CASE WHEN Name LIKE N'[[]Inactive]%' THEN Name ELSE N'[Inactive] ' + Name END,
    Description = N'Deactivated — not used in electronics catalog.',
    UpdatedAt = @Now
WHERE IsActive = 0 AND (
    Slug IN (
      N'thoi-trang', N'thoi-trang-nam', N'thoi-trang-nu', N'thoi-trang-giay',
      N'sach-van-phong-pham', N'sach-ky-nang', N'sach-thieu-nhi',
      N'the-thao-ngoai-troi', N'the-thao-yoga', N'the-thao-bong-da',
      N'my-pham', N'my-pham-skincare', N'my-pham-makeup',
      N'me-be', N'me-be-sua', N'o-to-xe-may', N'xe-may-phu-kien',
      N'thiet-bi-gia-dung', N'gia-dung-bep', N'gia-dung-lam-sach',
      N'a', N'aaasasfsf', N'aaasasfsf1', N'aaasasfsf12'
    ) OR Name IN (N'a', N'aaasasfsf', N'aaasasfsf1', N'aaasasfsf12')
);

/* 3. Ensure electronics roots */
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'dien-thoai')
  INSERT INTO dbo.Categories (Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Phones', N'dien-thoai', N'Smartphones from major brands', @MockBase + N'/categories/phones.jpg', 1, 1, @Now, @Now);
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'laptop')
  INSERT INTO dbo.Categories (Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Laptops', N'laptop', N'Notebooks for work, study and creation', @MockBase + N'/categories/laptops.jpg', 2, 1, @Now, @Now);
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'tablet')
  INSERT INTO dbo.Categories (Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Tablets', N'tablet', N'iPad and Android tablets', @MockBase + N'/categories/tablets.jpg', 3, 1, @Now, @Now);
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'phu-kien')
  INSERT INTO dbo.Categories (Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Accessories', N'phu-kien', N'Chargers, cases, cables and more', @MockBase + N'/categories/accessories.jpg', 4, 1, @Now, @Now);
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'am-thanh')
  INSERT INTO dbo.Categories (Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Audio', N'am-thanh', N'Headphones, earbuds and speakers', @MockBase + N'/categories/audio.jpg', 5, 1, @Now, @Now);

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'deo-thong-minh')
  INSERT INTO dbo.Categories (Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Wearables', N'deo-thong-minh', N'Smartwatches and fitness trackers', @MockBase + N'/categories/wearables.jpg', 6, 1, @Now, @Now);
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'tivi-man-hinh')
  INSERT INTO dbo.Categories (Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'TVs & Monitors', N'tivi-man-hinh', N'Smart TVs and PC monitors', @MockBase + N'/categories/tv-monitors.jpg', 7, 1, @Now, @Now);
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'nha-thong-minh')
  INSERT INTO dbo.Categories (Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Smart Home', N'nha-thong-minh', N'Cameras, plugs and smart lighting', @MockBase + N'/categories/smart-home.jpg', 8, 1, @Now, @Now);
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'gaming-gear')
  INSERT INTO dbo.Categories (Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Gaming Gear', N'gaming-gear', N'Keyboards, mice and game accessories', @MockBase + N'/categories/gaming.jpg', 9, 1, @Now, @Now);

SELECT @CatPhone = CategoryId FROM dbo.Categories WHERE Slug = N'dien-thoai';
SELECT @CatLaptop = CategoryId FROM dbo.Categories WHERE Slug = N'laptop';
SELECT @CatTablet = CategoryId FROM dbo.Categories WHERE Slug = N'tablet';
SELECT @CatAccess = CategoryId FROM dbo.Categories WHERE Slug = N'phu-kien';
SELECT @CatAudio = CategoryId FROM dbo.Categories WHERE Slug = N'am-thanh';
SELECT @CatWearable = CategoryId FROM dbo.Categories WHERE Slug = N'deo-thong-minh';
SELECT @CatTv = CategoryId FROM dbo.Categories WHERE Slug = N'tivi-man-hinh';
SELECT @CatSmartHome = CategoryId FROM dbo.Categories WHERE Slug = N'nha-thong-minh';
SELECT @CatGaming = CategoryId FROM dbo.Categories WHERE Slug = N'gaming-gear';

UPDATE dbo.Categories SET Name = N'Phones', Description = N'Smartphones from major brands', ImageUrl = @MockBase + N'/categories/phones.jpg', SortOrder = 1, IsActive = 1, UpdatedAt = @Now WHERE Slug = N'dien-thoai';
UPDATE dbo.Categories SET Name = N'Laptops', Description = N'Notebooks for work, study and creation', ImageUrl = @MockBase + N'/categories/laptops.jpg', SortOrder = 2, IsActive = 1, UpdatedAt = @Now WHERE Slug = N'laptop';
UPDATE dbo.Categories SET Name = N'Tablets', Description = N'iPad and Android tablets', ImageUrl = @MockBase + N'/categories/tablets.jpg', SortOrder = 3, IsActive = 1, UpdatedAt = @Now WHERE Slug = N'tablet';
UPDATE dbo.Categories SET Name = N'Accessories', Description = N'Chargers, cases, cables and more', ImageUrl = @MockBase + N'/categories/accessories.jpg', SortOrder = 4, IsActive = 1, UpdatedAt = @Now WHERE Slug = N'phu-kien';
UPDATE dbo.Categories SET Name = N'Audio', Description = N'Headphones, earbuds and speakers', ImageUrl = @MockBase + N'/categories/audio.jpg', SortOrder = 5, IsActive = 1, UpdatedAt = @Now WHERE Slug = N'am-thanh';
UPDATE dbo.Categories SET Name = N'Wearables', Description = N'Smartwatches and fitness trackers', ImageUrl = @MockBase + N'/categories/wearables.jpg', SortOrder = 6, IsActive = 1, UpdatedAt = @Now WHERE Slug = N'deo-thong-minh';
UPDATE dbo.Categories SET Name = N'TVs & Monitors', Description = N'Smart TVs and PC monitors', ImageUrl = @MockBase + N'/categories/tv-monitors.jpg', SortOrder = 7, IsActive = 1, UpdatedAt = @Now WHERE Slug = N'tivi-man-hinh';
UPDATE dbo.Categories SET Name = N'Smart Home', Description = N'Cameras, plugs and smart lighting', ImageUrl = @MockBase + N'/categories/smart-home.jpg', SortOrder = 8, IsActive = 1, UpdatedAt = @Now WHERE Slug = N'nha-thong-minh';
UPDATE dbo.Categories SET Name = N'Gaming Gear', Description = N'Keyboards, mice and game accessories', ImageUrl = @MockBase + N'/categories/gaming.jpg', SortOrder = 9, IsActive = 1, UpdatedAt = @Now WHERE Slug = N'gaming-gear';

/* Children */
IF @CatPhone IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'dien-thoai-apple')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@CatPhone, N'Apple iPhone', N'dien-thoai-apple', N'iPhone lineup', @MockBase + N'/categories/iphone.jpg', 1, 1, @Now, @Now);
IF @CatPhone IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'dien-thoai-samsung')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@CatPhone, N'Samsung Galaxy', N'dien-thoai-samsung', N'Galaxy S / A / Z', @MockBase + N'/categories/samsung-phone.jpg', 2, 1, @Now, @Now);
IF @CatPhone IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'dien-thoai-xiaomi')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@CatPhone, N'Xiaomi', N'dien-thoai-xiaomi', N'Redmi / Xiaomi / POCO', @MockBase + N'/categories/xiaomi-phone.jpg', 3, 1, @Now, @Now);
IF @CatPhone IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'dien-thoai-oppo')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@CatPhone, N'OPPO', N'dien-thoai-oppo', N'OPPO Reno / Find', @MockBase + N'/categories/oppo-phone.jpg', 4, 1, @Now, @Now);

IF @CatLaptop IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'laptop-gaming')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@CatLaptop, N'Gaming Laptops', N'laptop-gaming', N'High-performance gaming notebooks', @MockBase + N'/categories/laptop-gaming.jpg', 1, 1, @Now, @Now);
IF @CatLaptop IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'laptop-van-phong')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@CatLaptop, N'Office Laptops', N'laptop-van-phong', N'Everyday study and office notebooks', @MockBase + N'/categories/laptop-office.jpg', 2, 1, @Now, @Now);
IF @CatLaptop IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'laptop-macbook')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@CatLaptop, N'MacBook', N'laptop-macbook', N'MacBook Air / Pro', @MockBase + N'/categories/macbook.jpg', 3, 1, @Now, @Now);

IF @CatAccess IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'phu-kien-sac')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@CatAccess, N'Chargers & Cables', N'phu-kien-sac', N'GaN chargers and USB-C cables', @MockBase + N'/categories/chargers.jpg', 1, 1, @Now, @Now);
IF @CatAccess IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'phu-kien-op')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@CatAccess, N'Phone Cases', N'phu-kien-op', N'Protective cases', @MockBase + N'/categories/cases.jpg', 2, 1, @Now, @Now);
IF @CatAudio IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'phu-kien-tai-nghe')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@CatAudio, N'Headphones', N'phu-kien-tai-nghe', N'Wired and wireless headphones', @MockBase + N'/categories/headphones.jpg', 1, 1, @Now, @Now);

UPDATE dbo.Categories SET IsActive = 1, ImageUrl = @MockBase + N'/categories/' + Slug + N'.jpg', UpdatedAt = @Now
WHERE Slug IN (
  N'dien-thoai-apple', N'dien-thoai-samsung', N'dien-thoai-xiaomi', N'dien-thoai-oppo',
  N'laptop-gaming', N'laptop-van-phong', N'laptop-macbook',
  N'phu-kien-sac', N'phu-kien-op', N'phu-kien-tai-nghe'
);

UPDATE dbo.Categories SET
    Name = N'Headphones', ParentId = @CatAudio, Description = N'Wired and wireless headphones',
    ImageUrl = @MockBase + N'/categories/headphones.jpg', IsActive = 1, UpdatedAt = @Now
WHERE Slug = N'phu-kien-tai-nghe' AND @CatAudio IS NOT NULL;



/* 4. Remap existing products into electronics categories */
UPDATE dbo.Products SET CategoryId = @CatPhone, UpdatedAt = @Now
WHERE Slug IN (N'samsung-galaxy-s24-256gb', N'iphone-15-128gb', N'xiaomi-14-256gb', N'xiaomi-14t-pro-pending', N'oppo-reno12-pending')
  AND @CatPhone IS NOT NULL;

UPDATE dbo.Products SET CategoryId = @CatLaptop, UpdatedAt = @Now
WHERE Slug IN (N'macbook-air-m3-13', N'asus-vivobook-15-oled', N'dell-xps-15-9530', N'asus-vivobook-15-pending')
  AND @CatLaptop IS NOT NULL;

UPDATE dbo.Products SET CategoryId = @CatTablet, UpdatedAt = @Now
WHERE Slug IN (N'ipad-air-m2-128gb') AND @CatTablet IS NOT NULL;

UPDATE dbo.Products SET CategoryId = @CatAudio, UpdatedAt = @Now
WHERE Slug IN (N'airpods-pro-2', N'sony-wh-1000xm5', N'sony-wh-1000xm5-pending') AND @CatAudio IS NOT NULL;

UPDATE dbo.Products SET CategoryId = @CatAccess, UpdatedAt = @Now
WHERE Slug IN (N'anker-735-gan-charger', N'generic-cable-rejected') AND @CatAccess IS NOT NULL;

UPDATE dbo.Products SET CategoryId = @CatWearable, UpdatedAt = @Now
WHERE Slug IN (N'samsung-galaxy-watch-6') AND @CatWearable IS NOT NULL;

/* 5. Mock product images for all products */
UPDATE pi SET ImageUrl = @MockBase + N'/products/' + p.Slug + N'.jpg'
FROM dbo.ProductImages pi
INNER JOIN dbo.Products p ON p.ProductId = pi.ProductId;

INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary)
SELECT p.ProductId, @MockBase + N'/products/' + p.Slug + N'.jpg', 0, 1
FROM dbo.Products p
WHERE NOT EXISTS (SELECT 1 FROM dbo.ProductImages i WHERE i.ProductId = p.ProductId);

/* 6. Enrich product copy (English) for existing approved demo SKUs */
UPDATE dbo.Products SET
    ShortDescription = N'Apple A16 Bionic, Dynamic Island, 48MP camera',
    Description = N'iPhone 15 with USB-C, 5G, and a bright Super Retina XDR display. Genuine Apple warranty.',
    UpdatedAt = @Now
WHERE Slug = N'iphone-15-128gb';

UPDATE dbo.Products SET
    ShortDescription = N'Flagship Samsung, 6.2" display, Snapdragon 8 Gen 3',
    Description = N'Galaxy S24 with AI camera features, IP68, and all-day battery. Official Samsung warranty.',
    UpdatedAt = @Now
WHERE Slug = N'samsung-galaxy-s24-256gb';

UPDATE dbo.Products SET
    ShortDescription = N'Leica camera, Snapdragon 8 Gen 3, 90W charging',
    Description = N'Xiaomi 14 flagship with Leica optics and a smooth 120Hz AMOLED panel.',
    UpdatedAt = @Now
WHERE Slug = N'xiaomi-14-256gb';

UPDATE dbo.Products SET
    ShortDescription = N'Apple M3, 16GB RAM, 512GB SSD',
    Description = N'MacBook Air 13-inch — thin, silent, and all-day battery for work and study.',
    UpdatedAt = @Now
WHERE Slug = N'macbook-air-m3-13';

UPDATE dbo.Products SET
    ShortDescription = N'Ryzen 7, 16GB RAM, 512GB SSD, OLED display',
    Description = N'ASUS Vivobook 15 OLED for students and office work with vivid colors.',
    UpdatedAt = @Now
WHERE Slug = N'asus-vivobook-15-oled';

UPDATE dbo.Products SET
    ShortDescription = N'Intel Core i7, 32GB RAM, RTX 4050, 3.5K OLED',
    Description = N'Dell XPS 15 creator laptop for developers and content creators.',
    UpdatedAt = @Now
WHERE Slug = N'dell-xps-15-9530';

UPDATE dbo.Products SET
    ShortDescription = N'Active Noise Cancellation, USB-C, Spatial Audio',
    Description = N'Apple AirPods Pro (2nd gen) true wireless earbuds with Adaptive Audio.',
    UpdatedAt = @Now
WHERE Slug = N'airpods-pro-2';

UPDATE dbo.Products SET
    ShortDescription = N'Industry-leading ANC, 30h battery, LDAC',
    Description = N'Sony WH-1000XM5 over-ear headphones for travel and critical listening.',
    UpdatedAt = @Now
WHERE Slug = N'sony-wh-1000xm5';

UPDATE dbo.Products SET
    ShortDescription = N'65W GaN II charger with 3 ports',
    Description = N'Anker 735 compact GaN charger for phones, tablets, and thin laptops.',
    UpdatedAt = @Now
WHERE Slug = N'anker-735-gan-charger';

UPDATE dbo.Products SET
    ShortDescription = N'Wear OS, health tracking, built-in GPS',
    Description = N'Samsung Galaxy Watch 6 44mm smartwatch for Android users.',
    UpdatedAt = @Now
WHERE Slug = N'samsung-galaxy-watch-6';

UPDATE dbo.Products SET
    ShortDescription = N'Apple M2, Liquid Retina, Apple Pencil support',
    Description = N'iPad Air 11-inch with M2 — ideal for notes, drawing, and streaming.',
    UpdatedAt = @Now
WHERE Slug = N'ipad-air-m2-128gb';



/* 7. Extra approved electronics products */
DECLARE @P_TV UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111201';
DECLARE @P_MON UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111202';
DECLARE @P_CAM UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111203';
DECLARE @P_KB UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111204';
DECLARE @P_SPK UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111205';
DECLARE @P_SW UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111206';

IF @CatTv IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @P_TV)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount, IsFeatured
    ) VALUES (
        @P_TV, @ShopId, @CatTv,
        N'Samsung Neo QLED 55" QN90D', N'samsung-qn90d-55',
        N'4K Neo QLED, 144Hz, Object Tracking Sound',
        N'Premium Samsung smart TV with bright Neo QLED picture and gaming features.',
        N'Samsung', N'QN55QN90D', N'TZ-TV-QN90D55', N'New',
        32990000, 30990000, 8, 24, N'Vietnam',
        N'{"size":"55","resolution":"4K","hz":"144"}', N'["tv","samsung","qled"]',
        N'Approved', DATEADD(DAY, -4, @Now), 4.70, 6, 11, 240, 1
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary)
    VALUES (@P_TV, @MockBase + N'/products/samsung-qn90d-55.jpg', 0, 1);
END;

IF @CatTv IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @P_MON)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount, IsFeatured
    ) VALUES (
        @P_MON, @ShopId, @CatTv,
        N'LG UltraGear 27" 1440p 165Hz', N'lg-ultragear-27-165',
        N'QHD IPS gaming monitor, 1ms, G-SYNC Compatible',
        N'Fast IPS monitor for gaming and content creation.',
        N'LG', N'27GP850', N'TZ-MON-UG27', N'New',
        8990000, 8490000, 16, 36, N'China',
        N'{"size":"27","resolution":"1440p","hz":"165"}', N'["monitor","lg","gaming"]',
        N'Approved', DATEADD(DAY, -3, @Now), 4.60, 9, 28, 190, 0
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary)
    VALUES (@P_MON, @MockBase + N'/products/lg-ultragear-27-165.jpg', 0, 1);
END;

IF @CatSmartHome IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @P_CAM)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount, IsFeatured
    ) VALUES (
        @P_CAM, @ShopId, @CatSmartHome,
        N'Xiaomi Smart Camera C300', N'xiaomi-camera-c300',
        N'2K resolution, night vision, AI human detection',
        N'Indoor smart security camera with app alerts and two-way audio.',
        N'Xiaomi', N'C300', N'TZ-CAM-C300', N'New',
        790000, 690000, 40, 12, N'China',
        N'{"resolution":"2K","wifi":"yes","ai":"yes"}', N'["smart-home","camera","xiaomi"]',
        N'Approved', DATEADD(DAY, -2, @Now), 4.40, 14, 67, 310, 0
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary)
    VALUES (@P_CAM, @MockBase + N'/products/xiaomi-camera-c300.jpg', 0, 1);
END;

IF @CatGaming IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @P_KB)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount, IsFeatured
    ) VALUES (
        @P_KB, @ShopId, @CatGaming,
        N'Logitech G Pro X TKL Keyboard', N'logitech-g-pro-x-tkl',
        N'Hot-swappable switches, RGB, tournament-ready TKL',
        N'Compact mechanical gaming keyboard from Logitech G.',
        N'Logitech', N'920-009740', N'TZ-KB-GPROX', N'New',
        3290000, 2990000, 25, 24, N'China',
        N'{"form":"TKL","switch":"hot-swap","rgb":"yes"}', N'["gaming","keyboard","logitech"]',
        N'Approved', DATEADD(DAY, -6, @Now), 4.55, 11, 33, 175, 0
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary)
    VALUES (@P_KB, @MockBase + N'/products/logitech-g-pro-x-tkl.jpg', 0, 1);
END;

IF @CatAudio IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @P_SPK)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount, IsFeatured
    ) VALUES (
        @P_SPK, @ShopId, @CatAudio,
        N'JBL Charge 5 Portable Speaker', N'jbl-charge-5',
        N'Powerful bass, IP67, powerbank function',
        N'Portable Bluetooth speaker with long battery life for outdoor use.',
        N'JBL', N'JBLCHARGE5', N'TZ-SPK-CH5', N'New',
        3990000, 3690000, 30, 12, N'China',
        N'{"bluetooth":"5.1","ip":"IP67","powerbank":"yes"}', N'["speaker","jbl","bluetooth"]',
        N'Approved', DATEADD(DAY, -5, @Now), 4.65, 16, 54, 280, 1
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary)
    VALUES (@P_SPK, @MockBase + N'/products/jbl-charge-5.jpg', 0, 1);
END;

IF @CatSmartHome IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId = @P_SW)
BEGIN
    INSERT INTO dbo.Products (
        ProductId, ShopId, CategoryId, Name, Slug, ShortDescription, Description,
        Brand, ModelNumber, Sku, ConditionType, BasePrice, SalePrice,
        StockQuantity, WarrantyMonths, OriginCountry, SpecsJson, TagsJson,
        Status, PublishedAt, AvgRating, ReviewCount, SoldCount, ViewCount, IsFeatured
    ) VALUES (
        @P_SW, @ShopId, @CatSmartHome,
        N'TP-Link Tapo P110 Mini Smart Plug', N'tapo-p110-smart-plug',
        N'Wi-Fi smart plug with energy monitoring',
        N'Schedule appliances and track power usage from the Tapo app.',
        N'TP-Link', N'Tapo P110', N'TZ-PLUG-P110', N'New',
        320000, 279000, 80, 24, N'China',
        N'{"wifi":"yes","energyMonitor":"yes"}', N'["smart-home","plug","tapo"]',
        N'Approved', DATEADD(DAY, -1, @Now), 4.35, 21, 140, 420, 0
    );
    INSERT INTO dbo.ProductImages (ProductId, ImageUrl, SortOrder, IsPrimary)
    VALUES (@P_SW, @MockBase + N'/products/tapo-p110-smart-plug.jpg', 0, 1);
END;

/* 8. Sample reviews in English */
IF @BuyerId IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Products WHERE Slug = N'iphone-15-128gb')
AND NOT EXISTS (
    SELECT 1 FROM dbo.ProductReviews r
    INNER JOIN dbo.Products p ON p.ProductId = r.ProductId
    WHERE p.Slug = N'iphone-15-128gb' AND r.BuyerUserId = @BuyerId
)
BEGIN
    INSERT INTO dbo.ProductReviews (ProductId, BuyerUserId, Rating, Title, Content, IsVisible, CreatedAt, UpdatedAt)
    SELECT ProductId, @BuyerId, 5, N'Great daily phone', N'Smooth performance, battery lasts a full day, delivery was fast.', 1, DATEADD(DAY, -2, @Now), DATEADD(DAY, -2, @Now)
    FROM dbo.Products WHERE Slug = N'iphone-15-128gb';
END;

IF @BuyerId IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Products WHERE Slug = N'jbl-charge-5')
AND NOT EXISTS (
    SELECT 1 FROM dbo.ProductReviews r
    INNER JOIN dbo.Products p ON p.ProductId = r.ProductId
    WHERE p.Slug = N'jbl-charge-5' AND r.BuyerUserId = @BuyerId
)
BEGIN
    INSERT INTO dbo.ProductReviews (ProductId, BuyerUserId, Rating, Title, Content, IsVisible, CreatedAt, UpdatedAt)
    SELECT ProductId, @BuyerId, 5, N'Loud and durable', N'Bass is strong outdoors and the battery easily lasts a weekend trip.', 1, DATEADD(DAY, -1, @Now), DATEADD(DAY, -1, @Now)
    FROM dbo.Products WHERE Slug = N'jbl-charge-5';
END;

/* 9. Refresh shop product counts */
UPDATE s SET
    ProductCount = (SELECT COUNT(*) FROM dbo.Products p WHERE p.ShopId = s.ShopId AND p.Status = N'Approved'),
    UpdatedAt = @Now
FROM dbo.Shops s
WHERE s.Status = N'Active';

PRINT N'Electronics catalog refresh completed.';
GO

