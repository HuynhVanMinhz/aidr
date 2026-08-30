import type { ApiResult } from '../types/auth';
import type {
  ShopListItem,
  ShopListQuery,
  ShopProductsQuery,
  ShopPublicDetail,
  ShopSellerRating,
} from '../types/shop';
import type { PagedResult } from '../types/catalog';
import type { SellerShop, SellerShopApiResult, UpdateSellerShopPayload } from '../types/sellerShop';
import { apiClient } from './apiClient';

function toParams(query: ShopProductsQuery = {}): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.q?.trim()) params.q = query.q.trim();
  if (query.categoryId != null) params.categoryId = query.categoryId;
  if (query.brand?.trim()) params.brand = query.brand.trim();
  if (query.minPrice != null) params.minPrice = query.minPrice;
  if (query.maxPrice != null) params.maxPrice = query.maxPrice;
  if (query.minRating != null) params.minRating = query.minRating;
  if (query.sort) params.sort = query.sort;
  if (query.page != null) params.page = query.page;
  if (query.pageSize != null) params.pageSize = query.pageSize;
  return params;
}

export async function listShops(query: ShopListQuery = {}) {
  const params: Record<string, string | number> = {};
  if (query.page != null) params.page = query.page;
  if (query.pageSize != null) params.pageSize = query.pageSize;
  if (query.sort) params.sort = query.sort;

  const { data } = await apiClient.get<ApiResult<PagedResult<ShopListItem>>>('/shops', { params });
  return data;
}

export async function getShop(shopKey: string, query: ShopProductsQuery = {}) {
  const { data } = await apiClient.get<ApiResult<ShopPublicDetail>>(
    `/shops/${encodeURIComponent(shopKey)}`,
    { params: toParams(query) },
  );
  return data;
}

export async function getShopRating(shopKey: string) {
  const { data } = await apiClient.get<ApiResult<ShopSellerRating>>(
    `/shops/${encodeURIComponent(shopKey)}/rating`,
  );
  return data;
}

export async function getMyShop() {
  const { data } = await apiClient.get<SellerShopApiResult>('/seller/shop');
  return data;
}

export async function updateMyShop(payload: UpdateSellerShopPayload) {
  const { data } = await apiClient.put<SellerShopApiResult>('/seller/shop', payload);
  return data;
}

export function requireSellerShop(result: SellerShopApiResult): SellerShop {
  if (!result.success || !result.data) {
    throw new Error(result.message || 'Unable to load shop settings.');
  }
  return result.data;
}
