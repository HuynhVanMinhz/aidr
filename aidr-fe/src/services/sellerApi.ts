import type { ApiResult } from '../types/auth';
import type { ShopProductsQuery, ShopPublicDetail, ShopSellerRating } from '../types/shop';
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
