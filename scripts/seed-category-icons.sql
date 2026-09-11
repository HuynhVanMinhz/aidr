/*
  AIDR — Assign dedicated transparent-background SVG icons to each active
  category (one icon per slug, matching its content: phone, laptop, tablet,
  charger, headphones, router, ...). Safe to re-run.

  Assets live under aidr-fe/public/theme/images/category-icons/<slug>.svg.
  Run this AFTER seed-catalog-images (which otherwise cycles generic photos)
  so it has the final say on category ImageUrl.

  Dev: POST /api/dev/seed-category-icons
*/
SET NOCOUNT ON;

UPDATE dbo.Categories
SET ImageUrl = N'/theme/images/category-icons/' + Slug + N'.svg',
    UpdatedAt = SYSUTCDATETIME()
WHERE IsActive = 1;

PRINT N'seed-category-icons: category icon URLs assigned.';
GO
