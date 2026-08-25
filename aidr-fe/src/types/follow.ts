import type { ApiResult } from './auth';
import type { PagedResult } from './catalog';

export type FollowedShop = {
  shopId: string;
  shopName: string;
  slug: string;
  tagline?: string | null;
  shortDescription?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  isVerified: boolean;
  avgRating: number;
  ratingCount: number;
  followerCount: number;
  productCount: number;
  followedAt: string;
};

export type FollowShopRequest = {
  shopId: string;
};

export type UnfollowShopResponse = {
  shopId: string;
};

export type FollowListQuery = {
  page?: number;
  pageSize?: number;
};

export type FollowListResult = PagedResult<FollowedShop>;

export type FollowListApiResult = ApiResult<FollowListResult>;
export type FollowedShopApiResult = ApiResult<FollowedShop>;
export type UnfollowShopApiResult = ApiResult<UnfollowShopResponse>;
