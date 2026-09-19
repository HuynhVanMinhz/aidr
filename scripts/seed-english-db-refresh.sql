/*
  AIDR - Normalize ALL demo/catalog text to English.
  Safe to re-run. Image URLs stay as https://cdn.aidr.local/mock/...

  Dev: POST /api/dev/seed-english-refresh
*/

SET NOCOUNT ON;

DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();
DECLARE @MockBase NVARCHAR(128) = N'/theme/images/product-image-1.png';

/* -------------------------------------------------------------------------- */
/* Users                                                                      */
/* -------------------------------------------------------------------------- */

UPDATE dbo.Users SET FullName = N'System Admin', UpdatedAt = @Now WHERE Email = N'admin@aidr.local';
UPDATE dbo.Users SET FullName = N'Alex Seller', UpdatedAt = @Now WHERE Email = N'seller@aidr.local';
UPDATE dbo.Users SET FullName = N'Jamie Buyer', UpdatedAt = @Now WHERE Email = N'buyer@aidr.local';
UPDATE dbo.Users SET FullName = N'Lee Applicant', UpdatedAt = @Now WHERE Email = N'applicant1@aidr.local';
UPDATE dbo.Users SET FullName = N'Pat Applicant', UpdatedAt = @Now WHERE Email = N'applicant2@aidr.local';
UPDATE dbo.Users SET FullName = N'Chris Rejected Applicant', UpdatedAt = @Now WHERE Email = N'applicant3@aidr.local';
UPDATE dbo.Users SET FullName = N'Approved Demo Seller', UpdatedAt = @Now WHERE Email = N'applicant-approved@aidr.local';

/* -------------------------------------------------------------------------- */
/* Addresses                                                                  */
/* -------------------------------------------------------------------------- */

UPDATE dbo.Addresses SET
    ReceiverName = CASE WHEN ReceiverName LIKE N'%Buyer%' OR ReceiverName LIKE N'Tran%' THEN N'Jamie Buyer' ELSE ReceiverName END,
    Province = N'Hanoi',
    District = N'Cau Giay',
    Ward = N'Dich Vong',
    StreetAddress = CASE
        WHEN StreetAddress LIKE N'%Cat Linh%' THEN N'25 Cat Linh Street'
        WHEN StreetAddress LIKE N'%Xuan Thuy%' THEN N'88 Xuan Thuy Street'
        ELSE StreetAddress
    END,
    UpdatedAt = @Now;

/* -------------------------------------------------------------------------- */
/* Shops                                                                      */
/* -------------------------------------------------------------------------- */

UPDATE dbo.Shops SET
    ShopName = N'TechZone Official',
    Slug = N'techzone-official',
    Tagline = N'Authentic phones, laptops and gadgets',
    ShortDescription = N'Authorized electronics retailer for smartphones, laptops, audio and accessories.',
    Description = N'TechZone Official stocks genuine electronics with manufacturer warranty, fast delivery, and transparent pricing.',
    Province = N'Hanoi',
    District = N'Cau Giay',
    Ward = N'Dich Vong',
    StreetAddress = N'12 Xuan Thuy Street',
    ReturnPolicy = N'7-day return for manufacturer defects with original box and invoice.',
    ShippingPolicy = N'Shipping 1-3 days in Hanoi metro; 2-5 days nationwide.',
    LogoUrl = ISNULL(NULLIF(LogoUrl, N''), @MockBase + N'/shops/techzone-logo.png'),
    BannerUrl = ISNULL(NULLIF(BannerUrl, N''), @MockBase + N'/shops/techzone-banner.png'),
    UpdatedAt = @Now
WHERE Slug IN (N'techzone-official') OR ShopId = 'DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD';

UPDATE dbo.Shops SET
    ShopName = N'AudioPulse Store',
    Slug = N'audiopulse-store',
    Tagline = N'Headphones, earbuds and speakers',
    ShortDescription = N'Premium audio gear and wearable tech.',
    Description = N'AudioPulse focuses on headphones, TWS earbuds, Bluetooth speakers and fitness wearables.',
    Province = N'Ho Chi Minh City',
    District = N'District 1',
    Ward = N'Ben Nghe',
    StreetAddress = N'45 Nguyen Hue Boulevard',
    ReturnPolicy = N'7-day DOA exchange with unboxing video.',
    ShippingPolicy = N'Same-day delivery in District 1; 2-4 days nationwide.',
    LogoUrl = ISNULL(NULLIF(LogoUrl, N''), @MockBase + N'/shops/audiopulse-logo.png'),
    BannerUrl = ISNULL(NULLIF(BannerUrl, N''), @MockBase + N'/shops/audiopulse-banner.png'),
    UpdatedAt = @Now
WHERE Slug IN (N'audiopulse-store', N'sportify-gear');

UPDATE dbo.Shops SET
    ShopName = N'PixelNest Gadgets',
    Slug = N'pixelnest-gadgets',
    Tagline = N'Tablets, chargers and smart home',
    ShortDescription = N'Tablets, charging gear, and smart-home devices.',
    Description = N'PixelNest Gadgets sells tablets, GaN chargers, smart plugs, and home cameras.',
    Province = N'Da Nang',
    District = N'Hai Chau',
    Ward = N'Thach Thang',
    StreetAddress = N'18 Bach Dang Street',
    ReturnPolicy = N'14-day return for sealed accessories; 7 days for opened gadgets with defect.',
    ShippingPolicy = N'2-5 day shipping nationwide.',
    LogoUrl = ISNULL(NULLIF(LogoUrl, N''), @MockBase + N'/shops/pixelnest-logo.png'),
    BannerUrl = ISNULL(NULLIF(BannerUrl, N''), @MockBase + N'/shops/pixelnest-banner.png'),
    UpdatedAt = @Now
WHERE Slug IN (N'pixelnest-gadgets', N'book-corner-vn');

/* -------------------------------------------------------------------------- */
/* Categories (active + inactive labels in English)                           */
/* -------------------------------------------------------------------------- */

UPDATE dbo.Categories SET Name = N'Phones', Description = N'Smartphones from major brands', UpdatedAt = @Now WHERE Slug = N'dien-thoai';
UPDATE dbo.Categories SET Name = N'Laptops', Description = N'Notebooks for work, study and creation', UpdatedAt = @Now WHERE Slug = N'laptop';
UPDATE dbo.Categories SET Name = N'Tablets', Description = N'iPad and Android tablets', UpdatedAt = @Now WHERE Slug = N'tablet';
UPDATE dbo.Categories SET Name = N'Accessories', Description = N'Chargers, cases, cables and more', UpdatedAt = @Now WHERE Slug = N'phu-kien';
UPDATE dbo.Categories SET Name = N'Audio', Description = N'Headphones, earbuds and speakers', UpdatedAt = @Now WHERE Slug = N'am-thanh';
UPDATE dbo.Categories SET Name = N'Wearables', Description = N'Smartwatches and fitness trackers', UpdatedAt = @Now WHERE Slug = N'deo-thong-minh';
UPDATE dbo.Categories SET Name = N'TVs & Monitors', Description = N'Smart TVs and PC monitors', UpdatedAt = @Now WHERE Slug = N'tivi-man-hinh';
UPDATE dbo.Categories SET Name = N'Smart Home', Description = N'Cameras, plugs and smart lighting', UpdatedAt = @Now WHERE Slug = N'nha-thong-minh';
UPDATE dbo.Categories SET Name = N'Gaming Gear', Description = N'Keyboards, mice and game accessories', UpdatedAt = @Now WHERE Slug = N'gaming-gear';

UPDATE dbo.Categories SET Name = N'Apple iPhone', Description = N'iPhone lineup', UpdatedAt = @Now WHERE Slug = N'dien-thoai-apple';
UPDATE dbo.Categories SET Name = N'Samsung Galaxy', Description = N'Galaxy S / A / Z', UpdatedAt = @Now WHERE Slug = N'dien-thoai-samsung';
UPDATE dbo.Categories SET Name = N'Xiaomi', Description = N'Redmi / Xiaomi / POCO', UpdatedAt = @Now WHERE Slug = N'dien-thoai-xiaomi';
UPDATE dbo.Categories SET Name = N'OPPO', Description = N'OPPO Reno / Find', UpdatedAt = @Now WHERE Slug = N'dien-thoai-oppo';
UPDATE dbo.Categories SET Name = N'Gaming Laptops', Description = N'High-performance gaming notebooks', UpdatedAt = @Now WHERE Slug = N'laptop-gaming';
UPDATE dbo.Categories SET Name = N'Office Laptops', Description = N'Everyday study and office notebooks', UpdatedAt = @Now WHERE Slug = N'laptop-van-phong';
UPDATE dbo.Categories SET Name = N'MacBook', Description = N'MacBook Air / Pro', UpdatedAt = @Now WHERE Slug = N'laptop-macbook';
UPDATE dbo.Categories SET Name = N'Chargers & Cables', Description = N'GaN chargers and USB-C cables', UpdatedAt = @Now WHERE Slug = N'phu-kien-sac';
UPDATE dbo.Categories SET Name = N'Phone Cases', Description = N'Protective cases', UpdatedAt = @Now WHERE Slug = N'phu-kien-op';
UPDATE dbo.Categories SET Name = N'Headphones', Description = N'Wired and wireless headphones', UpdatedAt = @Now WHERE Slug = N'phu-kien-tai-nghe';

UPDATE dbo.Categories SET Name = N'[Inactive] Home Appliances', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'thiet-bi-gia-dung';
UPDATE dbo.Categories SET Name = N'[Inactive] Kitchen Appliances', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'gia-dung-bep';
UPDATE dbo.Categories SET Name = N'[Inactive] Home Cleaning', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'gia-dung-lam-sach';
UPDATE dbo.Categories SET Name = N'[Inactive] Fashion', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'thoi-trang';
UPDATE dbo.Categories SET Name = N'[Inactive] Men Fashion', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'thoi-trang-nam';
UPDATE dbo.Categories SET Name = N'[Inactive] Women Fashion', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'thoi-trang-nu';
UPDATE dbo.Categories SET Name = N'[Inactive] Footwear', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'thoi-trang-giay';
UPDATE dbo.Categories SET Name = N'[Inactive] Books & Stationery', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'sach-van-phong-pham';
UPDATE dbo.Categories SET Name = N'[Inactive] Self-help Books', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'sach-ky-nang';
UPDATE dbo.Categories SET Name = N'[Inactive] Kids Books', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'sach-thieu-nhi';
UPDATE dbo.Categories SET Name = N'[Inactive] Sports & Outdoors', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'the-thao-ngoai-troi';
UPDATE dbo.Categories SET Name = N'[Inactive] Yoga & Fitness', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'the-thao-yoga';
UPDATE dbo.Categories SET Name = N'[Inactive] Football', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'the-thao-bong-da';
UPDATE dbo.Categories SET Name = N'[Inactive] Beauty', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'my-pham';
UPDATE dbo.Categories SET Name = N'[Inactive] Skincare', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'my-pham-skincare';
UPDATE dbo.Categories SET Name = N'[Inactive] Makeup', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'my-pham-makeup';
UPDATE dbo.Categories SET Name = N'[Inactive] Mother & Baby', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'me-be';
UPDATE dbo.Categories SET Name = N'[Inactive] Baby Nutrition', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'me-be-sua';
UPDATE dbo.Categories SET Name = N'[Inactive] Auto & Motorbike', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'o-to-xe-may';
UPDATE dbo.Categories SET Name = N'[Inactive] Motorbike Accessories', Description = N'Deactivated - not used in electronics catalog.', UpdatedAt = @Now WHERE Slug = N'xe-may-phu-kien';
UPDATE dbo.Categories SET Name = N'[Inactive] Junk Category A', Description = N'Deactivated junk category.', UpdatedAt = @Now WHERE Slug = N'a';
UPDATE dbo.Categories SET Name = N'[Inactive] Junk Category B', Description = N'Deactivated junk category.', UpdatedAt = @Now WHERE Slug = N'aaasasfsf';
UPDATE dbo.Categories SET Name = N'[Inactive] Junk Category C', Description = N'Deactivated junk category.', UpdatedAt = @Now WHERE Slug = N'aaasasfsf1';
UPDATE dbo.Categories SET Name = N'[Inactive] Junk Category D', Description = N'Deactivated junk category.', UpdatedAt = @Now WHERE Slug = N'aaasasfsf12';

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

UPDATE dbo.Products SET OriginCountry = N'China', UpdatedAt = @Now
WHERE OriginCountry IN (N'Trung Quoc', N'Trung Quốc', N'TrungQuoc');

UPDATE dbo.Products SET OriginCountry = N'Vietnam', UpdatedAt = @Now
WHERE OriginCountry IN (N'Viet Nam', N'Việt Nam', N'VN');

UPDATE dbo.Products SET
    ShortDescription = N'Flagship Samsung, 6.2" display, Snapdragon 8 Gen 3',
    Description = N'Galaxy S24 with AI camera features, IP68 rating, and all-day battery. Official Samsung warranty.',
    UpdatedAt = @Now
WHERE Slug = N'samsung-galaxy-s24-256gb';

UPDATE dbo.Products SET
    ShortDescription = N'Apple A16 Bionic, Dynamic Island, 48MP camera',
    Description = N'iPhone 15 with USB-C, 5G, and a bright Super Retina XDR display. Genuine Apple warranty.',
    UpdatedAt = @Now
WHERE Slug = N'iphone-15-128gb';

UPDATE dbo.Products SET
    ShortDescription = N'Leica camera, Snapdragon 8 Gen 3, 90W charging',
    Description = N'Xiaomi 14 flagship with Leica optics and a smooth 120Hz AMOLED panel.',
    UpdatedAt = @Now
WHERE Slug = N'xiaomi-14-256gb';

UPDATE dbo.Products SET
    ShortDescription = N'Apple M3, 16GB RAM, 512GB SSD',
    Description = N'MacBook Air 13-inch - thin, silent, and all-day battery for work and study.',
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
    Description = N'iPad Air 11-inch with M2 - ideal for notes, drawing, and streaming.',
    UpdatedAt = @Now
WHERE Slug = N'ipad-air-m2-128gb';

/* -------------------------------------------------------------------------- */
/* Reviews                                                                    */
/* -------------------------------------------------------------------------- */

UPDATE dbo.ProductReviews SET
    Title = N'Very satisfied',
    Content = N'Brand-new device, solid battery life, and fast delivery.',
    UpdatedAt = @Now
WHERE Title LIKE N'R%t h%' OR Content LIKE N'M%y m_i%' OR Content LIKE N'May moi%';

UPDATE dbo.ProductReviews SET
    Title = N'Excellent ANC',
    Content = N'Comfortable fit and strong noise cancellation on flights.',
    UpdatedAt = @Now
WHERE Title LIKE N'ANC%' OR Content LIKE N'%ch_ng _n%' OR Content LIKE N'%may bay%';

UPDATE pr SET
    Title = N'Very satisfied',
    Content = N'Brand-new device, solid battery life, and fast delivery.',
    UpdatedAt = @Now
FROM dbo.ProductReviews pr
INNER JOIN dbo.Products p ON p.ProductId = pr.ProductId
WHERE p.Slug = N'samsung-galaxy-s24-256gb'
  AND (pr.Title NOT LIKE N'%[A-Za-z][A-Za-z]%' OR pr.Content LIKE N'%pin%' OR LEN(pr.Title) < 3);

UPDATE pr SET
    Title = N'Excellent ANC',
    Content = N'Comfortable fit and strong noise cancellation on flights.',
    UpdatedAt = @Now
FROM dbo.ProductReviews pr
INNER JOIN dbo.Products p ON p.ProductId = pr.ProductId
WHERE p.Slug = N'airpods-pro-2'
  AND pr.BuyerUserId = 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC'
  AND pr.Title <> N'Great daily phone';

/* Force-fix known demo reviews by product */
UPDATE pr SET Title = N'Very satisfied', Content = N'Brand-new device, solid battery life, and fast delivery.', UpdatedAt = @Now
FROM dbo.ProductReviews pr
INNER JOIN dbo.Products p ON p.ProductId = pr.ProductId
WHERE p.Slug = N'samsung-galaxy-s24-256gb'
  AND pr.Title NOT IN (N'Very satisfied', N'Great daily phone', N'Loud and durable');

UPDATE pr SET Title = N'Excellent ANC', Content = N'Comfortable fit and strong noise cancellation on flights.', UpdatedAt = @Now
FROM dbo.ProductReviews pr
INNER JOIN dbo.Products p ON p.ProductId = pr.ProductId
WHERE p.Slug = N'airpods-pro-2'
  AND pr.Title NOT IN (N'Excellent ANC', N'Great daily phone', N'Loud and durable', N'Very satisfied');

/* -------------------------------------------------------------------------- */
/* Seller registration queue → electronics English                            */
/* -------------------------------------------------------------------------- */

UPDATE dbo.SellerRegistrationRequests SET
    ShopName = N'AudioPulse Store',
    BusinessInfo = N'Premium headphones, earbuds, Bluetooth speakers and fitness wearables. Nationwide shipping.'
WHERE ShopName LIKE N'Sportify%' OR ShopName = N'AudioPulse Store';

UPDATE dbo.SellerRegistrationRequests SET
    ShopName = N'PixelNest Gadgets',
    BusinessInfo = N'Tablets, GaN chargers, smart plugs and home cameras for everyday electronics buyers.'
WHERE ShopName LIKE N'Book Corner%' OR ShopName = N'PixelNest Gadgets';

UPDATE dbo.SellerRegistrationRequests SET
    ShopName = N'GreenCircuit Home Tech',
    BusinessInfo = N'Smart home sensors, plugs and compact kitchen electronics. Warehouse in District 7, HCMC.'
WHERE ShopName LIKE N'Green Mart%';

UPDATE dbo.SellerRegistrationRequests SET
    ShopName = N'Crafted Circuit House',
    BusinessInfo = N'Boutique electronics accessories and custom PC cables - approved for filter testing.'
WHERE ShopName LIKE N'Approved Craft%';

UPDATE dbo.SellerRegistrationRequests SET
    ShopName = N'Suspicious Gadgets',
    BusinessInfo = N'Import electronics without a clear warranty policy.',
    AdminNote = N'Documents incomplete and business address could not be verified.'
WHERE ShopName LIKE N'Suspicious%';

UPDATE dbo.SellerRegistrationRequests SET
    ShopName = REPLACE(ShopName, N'Demo Shop ', N'Demo Electronics Shop '),
    BusinessInfo = N'Demo electronics seller application for onboarding queue testing.'
WHERE ShopName LIKE N'Demo Shop %';

/* -------------------------------------------------------------------------- */
/* Inventory notes                                                            */
/* -------------------------------------------------------------------------- */

UPDATE dbo.InventoryLots SET
    SupplierName = CASE WHEN SupplierName LIKE N'NCC%' THEN N'Samsung VN Distributor' ELSE ISNULL(SupplierName, N'Demo Supplier') END,
    Note = CASE
        WHEN Note LIKE N'L% nh_p%' OR Note LIKE N'%gi% v_n%' THEN N'Seed stock lot for inventory and margin demos.'
        WHEN Note IS NULL OR Note = N'' THEN N'Seed stock lot for inventory and margin demos.'
        ELSE Note
    END
WHERE Note LIKE N'L%' OR Note LIKE N'%gi%' OR SupplierName LIKE N'NCC%' OR Note LIKE N'Seed%';

UPDATE dbo.InventoryTransactions SET
    Note = N'Seed stock-in transaction'
WHERE Note LIKE N'Nh_p%' OR Note LIKE N'Seed lot%';

/* -------------------------------------------------------------------------- */
/* Ensure product images remain mock English-slug URLs                        */
/* -------------------------------------------------------------------------- */

UPDATE pi SET ImageUrl = @MockBase + N'/products/' + p.Slug + N'.jpg'
FROM dbo.ProductImages pi
INNER JOIN dbo.Products p ON p.ProductId = pi.ProductId;

PRINT N'English DB refresh completed.';
GO

