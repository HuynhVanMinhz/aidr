import type { ApiResult } from './auth';
import type { PagedResult } from './catalog';

export type WishlistItem = {
  wishlistItemId: string;
  productId: string;
  productName: string;
  productSlug: string;
  primaryImageUrl?: string | null;
  shopId: string;
  shopName: string;
  shopSlug: string;
  basePrice: number;
  salePrice?: number | null;
  effectivePrice: number;
  currency: string;
  availableQuantity: number;
  isAvailable: boolean;
  avgRating: number;
  createdAt: string;
};

export type AddWishlistItemRequest = {
  productId: string;
};

export type RemoveWishlistItemResponse = {
  wishlistItemId: string;
  productId: string;
};

export type WishlistListQuery = {
  page?: number;
  pageSize?: number;
};

export type WishlistListResult = PagedResult<WishlistItem>;

export type WishlistListApiResult = ApiResult<WishlistListResult>;
export type WishlistItemApiResult = ApiResult<WishlistItem>;
export type RemoveWishlistItemApiResult = ApiResult<RemoveWishlistItemResponse>;
