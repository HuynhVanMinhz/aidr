/** Theme placeholders when API image is missing or a non-resolvable mock CDN URL. */
const PRODUCT_PLACEHOLDERS = [
  '/theme/images/product-image-1.png',
  '/theme/images/product-image-2.png',
  '/theme/images/product-image-3.png',
  '/theme/images/product-image-4.png',
  '/theme/images/product-image-5.png',
  '/theme/images/product-image-6.png',
  '/theme/images/product-image-7.png',
  '/theme/images/product-image-8.png',
  '/theme/images/product-image-9.png',
];

const CATEGORY_PLACEHOLDERS = [
  '/theme/images/category-item-image-1.png',
  '/theme/images/category-item-image-2.png',
  '/theme/images/category-item-image-3.png',
  '/theme/images/category-item-image-4.png',
  '/theme/images/category-item-image-5.png',
  '/theme/images/category-item-image-6.png',
];

function isUnusableImageUrl(url: string | null | undefined): boolean {
  if (!url || !url.trim()) return true;
  const u = url.trim().toLowerCase();
  return (
    u.includes('cdn.aidr.local') ||
    u.includes('example.com') ||
    u.includes('placeholder') ||
    u === 'null' ||
    u === 'undefined'
  );
}

export function resolveProductImageUrl(
  url: string | null | undefined,
  seed = 0,
): string {
  if (!isUnusableImageUrl(url)) return url!.trim();
  return PRODUCT_PLACEHOLDERS[Math.abs(seed) % PRODUCT_PLACEHOLDERS.length];
}

export function resolveCategoryImageUrl(
  url: string | null | undefined,
  seed = 0,
): string {
  if (!isUnusableImageUrl(url)) return url!.trim();
  return CATEGORY_PLACEHOLDERS[Math.abs(seed) % CATEGORY_PLACEHOLDERS.length];
}

export const PRODUCT_IMAGE_PLACEHOLDER = PRODUCT_PLACEHOLDERS[0];
