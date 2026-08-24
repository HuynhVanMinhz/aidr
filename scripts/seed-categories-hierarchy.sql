/*
  AIDR — Hierarchical categories demo seed
  Idempotent by Slug. Creates parent + child categories for pagination / tree UI.
*/

SET NOCOUNT ON;

DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

-- Root categories
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'dien-thoai')
  INSERT INTO dbo.Categories (Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Điện thoại', N'dien-thoai', N'Smartphone các hãng', 1, 1, @Now, @Now);

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'laptop')
  INSERT INTO dbo.Categories (Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Laptop', N'laptop', N'Máy tính xách tay', 2, 1, @Now, @Now);

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'phu-kien')
  INSERT INTO dbo.Categories (Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Phụ kiện', N'phu-kien', N'Sạc, ốp, tai nghe...', 3, 1, @Now, @Now);

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'thiet-bi-gia-dung')
  INSERT INTO dbo.Categories (Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Thiết bị gia dụng', N'thiet-bi-gia-dung', N'Đồ điện gia dụng', N'https://res.cloudinary.com/demo/image/upload/sample.jpg', 4, 1, @Now, @Now);

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'thoi-trang')
  INSERT INTO dbo.Categories (Name, Slug, Description, ImageUrl, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Thời trang', N'thoi-trang', N'Thời trang nam nữ', N'https://res.cloudinary.com/demo/image/upload/sample.jpg', 5, 1, @Now, @Now);

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'sach-van-phong-pham')
  INSERT INTO dbo.Categories (Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Sách & Văn phòng phẩm', N'sach-van-phong-pham', N'Sách, dụng cụ học tập', 6, 1, @Now, @Now);

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'the-thao-ngoai-troi')
  INSERT INTO dbo.Categories (Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Thể thao & Ngoài trời', N'the-thao-ngoai-troi', N'Dụng cụ thể thao', 7, 0, @Now, @Now);

DECLARE
    @Phone INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'dien-thoai'),
    @Laptop INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'laptop'),
    @Access INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'phu-kien'),
    @Home INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'thiet-bi-gia-dung'),
    @Fashion INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'thoi-trang'),
    @Book INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'sach-van-phong-pham'),
    @Sport INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'the-thao-ngoai-troi');

-- Children of Điện thoại
IF @Phone IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'dien-thoai-apple')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Phone, N'Apple iPhone', N'dien-thoai-apple', N'Dòng iPhone chính hãng', 1, 1, @Now, @Now);

IF @Phone IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'dien-thoai-samsung')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Phone, N'Samsung Galaxy', N'dien-thoai-samsung', N'Dòng Galaxy S / A / Z', 2, 1, @Now, @Now);

IF @Phone IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'dien-thoai-xiaomi')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Phone, N'Xiaomi', N'dien-thoai-xiaomi', N'Redmi / Xiaomi / POCO', 3, 1, @Now, @Now);

IF @Phone IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'dien-thoai-oppo')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Phone, N'OPPO', N'dien-thoai-oppo', N'OPPO Reno / Find', 4, 1, @Now, @Now);

-- Children of Laptop
IF @Laptop IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'laptop-gaming')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Laptop, N'Laptop Gaming', N'laptop-gaming', N'Laptop chơi game', 1, 1, @Now, @Now);

IF @Laptop IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'laptop-van-phong')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Laptop, N'Laptop văn phòng', N'laptop-van-phong', N'Laptop học tập, làm việc', 2, 1, @Now, @Now);

IF @Laptop IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'laptop-macbook')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Laptop, N'MacBook', N'laptop-macbook', N'MacBook Air / Pro', 3, 1, @Now, @Now);

-- Children of Phụ kiện
IF @Access IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'phu-kien-sac')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Access, N'Sạc & Cáp', N'phu-kien-sac', N'Sạc nhanh, cáp USB-C', 1, 1, @Now, @Now);

IF @Access IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'phu-kien-op')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Access, N'Ốp lưng', N'phu-kien-op', N'Ốp điện thoại', 2, 1, @Now, @Now);

IF @Access IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'phu-kien-tai-nghe')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Access, N'Tai nghe', N'phu-kien-tai-nghe', N'Tai nghe có dây / không dây', 3, 1, @Now, @Now);

-- Children of Gia dụng
IF @Home IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'gia-dung-bep')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Home, N'Đồ dùng nhà bếp', N'gia-dung-bep', N'Nồi cơm, máy xay...', 1, 1, @Now, @Now);

IF @Home IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'gia-dung-lam-sach')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Home, N'Vệ sinh nhà cửa', N'gia-dung-lam-sach', N'Máy hút bụi, robot', 2, 1, @Now, @Now);

-- Children of Thời trang
IF @Fashion IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'thoi-trang-nam')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Fashion, N'Thời trang nam', N'thoi-trang-nam', N'Áo quần nam', 1, 1, @Now, @Now);

IF @Fashion IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'thoi-trang-nu')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Fashion, N'Thời trang nữ', N'thoi-trang-nu', N'Áo quần nữ', 2, 1, @Now, @Now);

IF @Fashion IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'thoi-trang-giay')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Fashion, N'Giày dép', N'thoi-trang-giay', N'Giày sneaker, sandal', 3, 0, @Now, @Now);

-- Children of Sách
IF @Book IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'sach-ky-nang')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Book, N'Sách kỹ năng', N'sach-ky-nang', N'Sách phát triển bản thân', 1, 1, @Now, @Now);

IF @Book IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'sach-thieu-nhi')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Book, N'Sách thiếu nhi', N'sach-thieu-nhi', N'Sách thiếu nhi', 2, 1, @Now, @Now);

-- Children of Thể thao
IF @Sport IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'the-thao-yoga')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Sport, N'Yoga & Fitness', N'the-thao-yoga', N'Tham chiếu, dây kháng lực', 1, 0, @Now, @Now);

IF @Sport IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'the-thao-bong-da')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Sport, N'Bóng đá', N'the-thao-bong-da', N'Giày, bóng, phụ kiện', 2, 1, @Now, @Now);

-- Extra root leaves for pagination volume
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'my-pham')
  INSERT INTO dbo.Categories (Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Mỹ phẩm', N'my-pham', N'Chăm sóc da & trang điểm', 8, 1, @Now, @Now);

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'me-be')
  INSERT INTO dbo.Categories (Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Mẹ & Bé', N'me-be', N'Sản phẩm cho mẹ và bé', 9, 1, @Now, @Now);

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'o-to-xe-may')
  INSERT INTO dbo.Categories (Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (N'Ô tô - Xe máy', N'o-to-xe-may', N'Phụ kiện xe', 10, 1, @Now, @Now);

DECLARE @Beauty INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'my-pham');
DECLARE @Baby INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'me-be');
DECLARE @Vehicle INT = (SELECT CategoryId FROM dbo.Categories WHERE Slug = N'o-to-xe-may');

IF @Beauty IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'my-pham-skincare')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Beauty, N'Skincare', N'my-pham-skincare', N'Dưỡng da', 1, 1, @Now, @Now);

IF @Beauty IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'my-pham-makeup')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Beauty, N'Makeup', N'my-pham-makeup', N'Trang điểm', 2, 1, @Now, @Now);

IF @Baby IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'me-be-sua')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Baby, N'Sữa & Dinh dưỡng', N'me-be-sua', N'Sữa bột, bột ăn dặm', 1, 1, @Now, @Now);

IF @Vehicle IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE Slug = N'xe-may-phu-kien')
  INSERT INTO dbo.Categories (ParentId, Name, Slug, Description, SortOrder, IsActive, CreatedAt, UpdatedAt)
  VALUES (@Vehicle, N'Phụ kiện xe máy', N'xe-may-phu-kien', N'Mũ bảo hiểm, găng tay', 1, 1, @Now, @Now);

SELECT
    c.CategoryId,
    c.Name,
    c.Slug,
    p.Name AS ParentName,
    c.IsActive
FROM dbo.Categories c
LEFT JOIN dbo.Categories p ON p.CategoryId = c.ParentId
ORDER BY ISNULL(c.ParentId, c.CategoryId), c.ParentId, c.SortOrder, c.Name;
