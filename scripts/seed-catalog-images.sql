/*
  AIDR - Map category/product images to local theme assets under /theme/images.
  Safe to re-run. Use when mock CDN URLs (cdn.aidr.local) break the storefront.

  Dev: POST /api/dev/seed-catalog-images
*/
SET NOCOUNT ON;

;WITH C AS (
  SELECT CategoryId, ROW_NUMBER() OVER (ORDER BY CategoryId) AS rn
  FROM dbo.Categories
  WHERE ImageUrl IS NULL OR ImageUrl = N'' OR ImageUrl NOT LIKE N'/theme/images/category-icons/%'
)
UPDATE cat
SET ImageUrl = N'/theme/images/category-item-image-' + CAST(((c.rn - 1) % 6) + 1 AS NVARCHAR(10)) + N'.png',
    UpdatedAt = SYSUTCDATETIME()
FROM dbo.Categories cat
INNER JOIN C c ON c.CategoryId = cat.CategoryId;

;WITH P AS (
  SELECT ProductId, ROW_NUMBER() OVER (ORDER BY ProductId) AS rn
  FROM dbo.Products
)
UPDATE pi
SET ImageUrl = N'/theme/images/product-image-' + CAST(((p.rn - 1) % 9) + 1 AS NVARCHAR(10)) + N'.png'
FROM dbo.ProductImages pi
INNER JOIN P p ON p.ProductId = pi.ProductId;

UPDATE dbo.Shops
SET LogoUrl = N'/theme/images/our-brands-image-1.svg',
    UpdatedAt = SYSUTCDATETIME()
WHERE LogoUrl IS NULL OR LogoUrl = N'' OR LogoUrl LIKE N'%cdn.aidr.local%';
