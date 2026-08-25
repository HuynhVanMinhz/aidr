import type {
  FollowedShopApiResult,
  FollowListApiResult,
  FollowListQuery,
  FollowShopRequest,
  UnfollowShopApiResult,
} from '../types/follow';
import { apiClient } from './apiClient';

export async function getFollowedShops(query?: FollowListQuery) {
  const { data } = await apiClient.get<FollowListApiResult>('/follows', {
    params: {
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
    },
  });
  return data;
}

export async function followShop(request: FollowShopRequest) {
  const { data } = await apiClient.post<FollowedShopApiResult>('/follows/shops', request);
  return data;
}

export async function unfollowShop(shopId: string) {
  const { data } = await apiClient.delete<UnfollowShopApiResult>(`/follows/shops/${shopId}`);
  return data;
}
