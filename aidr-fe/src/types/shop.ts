import type { ApiResult, PagedResult, ProductListItem, ProductSort } from './catalog';

export type ShopProductsQuery = {
  q?: string;
  categoryId?: number;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
};

export type ShopPublicContact = {
  email?: string | null;
  phone?: string | null;
  hotline?: string | null;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
};

export type ShopPublicAddress = {
  province?: string | null;
  district?: string | null;
  ward?: string | null;
  streetAddress?: string | null;
};

export type ShopSellerRating = {
  shopId: string;
  shopName: string;
  slug: string;
  avgRating: number;
  ratingCount: number;
};

export type ShopListItem = {
  shopId: string;
  shopName: string;
  slug: string;
  tagline?: string | null;
  logoUrl?: string | null;
  isVerified: boolean;
  avgRating: number;
  ratingCount: number;
  followerCount: number;
  productCount: number;
};

export type ShopListQuery = {
  page?: number;
  pageSize?: number;
  /** rating | followers | newest */
  sort?: 'rating' | 'followers' | 'newest' | string;
};

export type ShopTrustBadge = {
  code: string;
  label: string;
  description: string;
};

export type ShopPublicDetail = {
  shopId: string;
  shopName: string;
  slug: string;
  tagline?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  isVerified: boolean;
  verifiedAt?: string | null;
  avgRating: number;
  ratingCount: number;
  followerCount: number;
  productCount: number;
  returnPolicy?: string | null;
  shippingPolicy?: string | null;
  openingHoursJson?: string | null;
  contact: ShopPublicContact;
  address: ShopPublicAddress;
  createdAt: string;
  badges?: ShopTrustBadge[];
  products: PagedResult<ProductListItem>;
};

export type { ApiResult, PagedResult };
