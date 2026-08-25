import type {
  AddWishlistItemRequest,
  RemoveWishlistItemApiResult,
  WishlistItemApiResult,
  WishlistListApiResult,
  WishlistListQuery,
} from '../types/wishlist';
import { apiClient } from './apiClient';

export async function getWishlist(query?: WishlistListQuery) {
  const { data } = await apiClient.get<WishlistListApiResult>('/wishlist', {
    params: {
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
    },
  });
  return data;
}

export async function addWishlistItem(request: AddWishlistItemRequest) {
  const { data } = await apiClient.post<WishlistItemApiResult>('/wishlist/items', request);
  return data;
}

export async function removeWishlistItem(wishlistItemId: string) {
  const { data } = await apiClient.delete<RemoveWishlistItemApiResult>(
    `/wishlist/items/${wishlistItemId}`,
  );
  return data;
}

export async function removeWishlistProduct(productId: string) {
  const { data } = await apiClient.delete<RemoveWishlistItemApiResult>(
    `/wishlist/products/${productId}`,
  );
  return data;
}
