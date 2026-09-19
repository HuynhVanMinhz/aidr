import type { ApiResult } from './auth';

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'rating';

export type ProductQuery = {
  q?: string;
  shopId?: string;
  categoryId?: number;
  categoryIds?: number[];
  brand?: string;
  brands?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  onSale?: boolean;
  inStock?: boolean;
  conditions?: string[];
  specFilters?: Record<string, string>;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
};

export type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type ProductListItem = {
  productId: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  brand?: string | null;
  basePrice: number;
  salePrice?: number | null;
  /** Cheapest way to buy it - with variants, the cheapest variant. */
  effectivePrice: number;
  /** Dearest active variant; equals effectivePrice when the product has none. */
  maxEffectivePrice: number;
  variantCount: number;
  currency: string;
  stockQuantity: number;
  availableQuantity: number;
  avgRating: number;
  reviewCount: number;
  soldCount: number;
  isFeatured: boolean;
  primaryImageUrl?: string | null;
  categoryId: number;
  categoryName: string;
  shopId: string;
  shopName: string;
  publishedAt?: string | null;
};

/** One axis of the variant picker, e.g. Color -> [Orange, White]. */
export type ProductVariantOption = {
  name: string;
  values: string[];
};

/**
 * One buyable configuration. The picker matches the shopper's selection against
 * `attributes` to find the variant, then prices and stocks the page from it.
 */
export type ProductVariant = {
  variantId: string;
  variantName: string;
  sku?: string | null;
  attributes: Record<string, string>;
  price: number;
  salePrice?: number | null;
  effectivePrice: number;
  stockQuantity: number;
  availableQuantity: number;
  imageUrl?: string | null;
  sortOrder: number;
};

export type ProductImage = {
  productImageId: string;
  imageUrl: string;
  sortOrder: number;
  isPrimary: boolean;
};

export type ProductShopSummary = {
  shopId: string;
  shopName: string;
  slug: string;
  logoUrl?: string | null;
  isVerified: boolean;
  avgRating: number;
  ratingCount: number;
};

export type ProductCategorySummary = {
  categoryId: number;
  name: string;
  slug: string;
};

export type ProductReviewSummary = {
  reviewId: string;
  rating: number;
  title?: string | null;
  content?: string | null;
  buyerName: string;
  createdAt: string;
};

export type ProductDetail = {
  productId: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;
  brand?: string | null;
  modelNumber?: string | null;
  conditionType: string;
  basePrice: number;
  salePrice?: number | null;
  effectivePrice: number;
  currency: string;
  stockQuantity: number;
  availableQuantity: number;
  warrantyMonths?: number | null;
  originCountry?: string | null;
  specsJson?: string | null;
  tagsJson?: string | null;
  avgRating: number;
  reviewCount: number;
  soldCount: number;
  viewCount: number;
  isFeatured: boolean;
  publishedAt?: string | null;
  category: ProductCategorySummary;
  shop: ProductShopSummary;
  images: ProductImage[];
  recentReviews: ProductReviewSummary[];
  /** Empty when the product is sold as a single configuration. */
  variantOptions: ProductVariantOption[];
  /** Active variants only. */
  variants: ProductVariant[];
  maxEffectivePrice: number;
};

export type CategoryTreeNode = {
  categoryId: number;
  parentId?: number | null;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  productCount?: number;
  children: CategoryTreeNode[];
};

export type BrandFilterOption = {
  brand: string;
  productCount: number;
};

export type { ApiResult };
