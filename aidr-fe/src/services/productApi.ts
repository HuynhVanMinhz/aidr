import type {
  ApiResult,
  BrandFilterOption,
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
  if (query.categoryIds?.length) params.categoryIds = query.categoryIds.join(',');
  else if (query.categoryId != null) params.categoryId = query.categoryId;
  if (query.brands?.length) params.brands = query.brands.join(',');
  else if (query.brand?.trim()) params.brand = query.brand.trim();
  if (query.minPrice != null) params.minPrice = query.minPrice;
  if (query.maxPrice != null) params.maxPrice = query.maxPrice;
  if (query.minRating != null) params.minRating = query.minRating;
  if (query.onSale === true) params.onSale = '1';
  if (query.inStock === true) params.inStock = '1';
  if (query.conditions?.length) params.conditions = query.conditions.join(',');
  if (query.specFilters && Object.keys(query.specFilters).length > 0) {
    params.specFilters = Object.entries(query.specFilters)
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
  }
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

export async function getProductBrands() {
  const { data } = await apiClient.get<ApiResult<BrandFilterOption[]>>('/products/brands');
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
