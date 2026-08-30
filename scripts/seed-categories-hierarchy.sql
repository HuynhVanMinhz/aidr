/*
  AIDR — Electronics category hierarchy (storefront-aligned).
  Idempotent by Slug. Prefer seed-electronics-refresh.sql to normalize an existing DB.
*/

SET NOCOUNT ON;

DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();
DECLARE @MockBase NVARCHAR(128) = N'/theme/images/product-image-1.png';

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

DECLARE
    @Phone INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'dien-thoai'),
    @Laptop INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'laptop'),
    @Access INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'phu-kien'),
    @Audio INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'am-thanh');

IF @Phone IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'dien-thoai-apple')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Phone, N'Apple iPhone', N'dien-thoai-apple', N'iPhone lineup', @MockBase + N'/categories/iphone.jpg', 1, 1, @Now, @Now);

IF @Phone IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'dien-thoai-samsung')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Phone, N'Samsung Galaxy', N'dien-thoai-samsung', N'Galaxy S / A / Z', @MockBase + N'/categories/samsung-phone.jpg', 2, 1, @Now, @Now);

IF @Phone IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'dien-thoai-xiaomi')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Phone, N'Xiaomi', N'dien-thoai-xiaomi', N'Redmi / Xiaomi / POCO', @MockBase + N'/categories/xiaomi-phone.jpg', 3, 1, @Now, @Now);

IF @Phone IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'dien-thoai-oppo')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Phone, N'OPPO', N'dien-thoai-oppo', N'OPPO Reno / Find', @MockBase + N'/categories/oppo-phone.jpg', 4, 1, @Now, @Now);

IF @Laptop IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'laptop-gaming')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Laptop, N'Gaming Laptops', N'laptop-gaming', N'High-performance gaming notebooks', @MockBase + N'/categories/laptop-gaming.jpg', 1, 1, @Now, @Now);

IF @Laptop IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'laptop-van-phong')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Laptop, N'Office Laptops', N'laptop-van-phong', N'Everyday study and office notebooks', @MockBase + N'/categories/laptop-office.jpg', 2, 1, @Now, @Now);

IF @Laptop IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'laptop-macbook')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Laptop, N'MacBook', N'laptop-macbook', N'MacBook Air / Pro', @MockBase + N'/categories/macbook.jpg', 3, 1, @Now, @Now);

IF @Access IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'phu-kien-sac')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Access, N'Chargers & Cables', N'phu-kien-sac', N'GaN chargers and USB-C cables', @MockBase + N'/categories/chargers.jpg', 1, 1, @Now, @Now);

IF @Access IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'phu-kien-op')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Access, N'Phone Cases', N'phu-kien-op', N'Protective cases', @MockBase + N'/categories/cases.jpg', 2, 1, @Now, @Now);

IF @Audio IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'phu-kien-tai-nghe')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Audio, N'Headphones', N'phu-kien-tai-nghe', N'Wired and wireless headphones', @MockBase + N'/categories/headphones.jpg', 1, 1, @Now, @Now);

PRINT N'Electronics category hierarchy seed completed.';
GO

