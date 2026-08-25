import type {
  ApiResult,
  PagedResult,
  ProductDetail,
  ProductListItem,
  ProductQuery,
} from '../types/catalog';
import { apiClient } from './apiClient';
import { getOrCreateSessionId } from '../utils/sessionId';

function toParams(query: ProductQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.q?.trim()) params.q = query.q.trim();
  if (query.shopId?.trim()) params.shopId = query.shopId.trim();
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

export async function listProducts(query: ProductQuery = {}) {
  const { data } = await apiClient.get<ApiResult<PagedResult<ProductListItem>>>('/products', {
    params: toParams(query),
  });
  return data;
}

export async function searchProducts(query: ProductQuery) {
  const { data } = await apiClient.get<ApiResult<PagedResult<ProductListItem>>>('/products/search', {
    params: toParams(query),
  });
  return data;
}

export async function getProduct(productId: string) {
  const { data } = await apiClient.get<ApiResult<ProductDetail>>(`/products/${productId}`, {
    headers: {
      'X-Session-Id': getOrCreateSessionId(),
    },
  });
  return data;
}
