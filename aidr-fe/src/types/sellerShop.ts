import type { ApiResult } from './auth';

export type SellerShop = {
  shopId: string;
  shopName: string;
  slug: string;
  tagline?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  hotline?: string | null;
  province?: string | null;
  district?: string | null;
  ward?: string | null;
  streetAddress?: string | null;
  /** Pickup point pinned on the map; the start of the order tracking route. */
  latitude?: number | null;
  longitude?: number | null;
  returnPolicy?: string | null;
  shippingPolicy?: string | null;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  openingHoursJson?: string | null;
  status: string;
  isVerified: boolean;
  verifiedAt?: string | null;
  avgRating: number;
  ratingCount: number;
  followerCount: number;
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export type UpdateSellerShopPayload = {
  shopName: string;
  tagline?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  hotline?: string | null;
  province?: string | null;
  district?: string | null;
  ward?: string | null;
  streetAddress?: string | null;
  /** Pickup point pinned on the map; the start of the order tracking route. */
  latitude?: number | null;
  longitude?: number | null;
  returnPolicy?: string | null;
  shippingPolicy?: string | null;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  openingHoursJson?: string | null;
};

export type SellerShopApiResult = ApiResult<SellerShop>;
