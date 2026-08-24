import type { ApiResult, PagedResult } from '../types/catalog';
import type {
  CreateSellerProductPayload,
  SellerProductDetail,
  SellerProductListItem,
  SellerProductQuery,
  UpdateSellerProductPayload,
  UploadSellerProductImagesPayload,
} from '../types/seller';
import { apiClient } from './apiClient';

function toParams(query: SellerProductQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.status) params.status = query.status;
  if (query.q?.trim()) params.q = query.q.trim();
  if (query.categoryId != null) params.categoryId = query.categoryId;
  if (query.page != null) params.page = query.page;
  if (query.pageSize != null) params.pageSize = query.pageSize;
  return params;
}

export async function listSellerProducts(query: SellerProductQuery = {}) {
  const { data } = await apiClient.get<ApiResult<PagedResult<SellerProductListItem>>>('/seller/products', {
    params: toParams(query),
  });
  return data;
}

export async function getSellerProduct(id: string) {
  const { data } = await apiClient.get<ApiResult<SellerProductDetail>>(`/seller/products/${id}`);
  return data;
}

export async function createSellerProduct(payload: CreateSellerProductPayload) {
  const { data } = await apiClient.post<ApiResult<SellerProductDetail>>('/seller/products', payload);
  return data;
}

export async function updateSellerProduct(id: string, payload: UpdateSellerProductPayload) {
  const { data } = await apiClient.put<ApiResult<SellerProductDetail>>(`/seller/products/${id}`, payload);
  return data;
}

export async function deleteSellerProduct(id: string) {
  const { data } = await apiClient.delete<ApiResult<object>>(`/seller/products/${id}`);
  return data;
}

export async function uploadSellerProductImages(id: string, payload: UploadSellerProductImagesPayload) {
  const { data } = await apiClient.post<ApiResult<SellerProductDetail>>(
    `/seller/products/${id}/images`,
    payload,
  );
  return data;
}
