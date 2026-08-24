import type { ApiResult } from '../types/catalog';
import type {
  AdjustSellerInventoryPayload,
  ImportStockLotPayload,
  SellerInventoryDetail,
  SellerInventoryListResult,
  SellerInventoryQuery,
  SellerPriceUpdate,
  UpdateSellerInventoryPayload,
  UpdateSellingPricePayload,
} from '../types/sellerInventory';
import { apiClient } from './apiClient';

function toParams(query: SellerInventoryQuery): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (query.q?.trim()) params.q = query.q.trim();
  if (query.lowStock != null) params.lowStock = query.lowStock;
  if (query.page != null) params.page = query.page;
  if (query.pageSize != null) params.pageSize = query.pageSize;
  return params;
}

export async function listSellerInventory(query: SellerInventoryQuery = {}) {
  const { data } = await apiClient.get<ApiResult<SellerInventoryListResult>>('/seller/inventory', {
    params: toParams(query),
  });
  return data;
}

export async function getSellerInventory(productId: string) {
  const { data } = await apiClient.get<ApiResult<SellerInventoryDetail>>(
    `/seller/products/${productId}/inventory`,
  );
  return data;
}

export async function updateSellerInventorySettings(
  productId: string,
  payload: UpdateSellerInventoryPayload,
) {
  const { data } = await apiClient.patch<ApiResult<SellerInventoryDetail>>(
    `/seller/products/${productId}/inventory`,
    payload,
  );
  return data;
}

export async function adjustSellerInventory(productId: string, payload: AdjustSellerInventoryPayload) {
  const { data } = await apiClient.post<ApiResult<SellerInventoryDetail>>(
    `/seller/products/${productId}/inventory/adjust`,
    payload,
  );
  return data;
}

export async function importSellerStockLot(productId: string, payload: ImportStockLotPayload) {
  const { data } = await apiClient.post<ApiResult<SellerInventoryDetail>>(
    `/seller/products/${productId}/lots`,
    payload,
  );
  return data;
}

export async function updateSellerSellingPrice(productId: string, payload: UpdateSellingPricePayload) {
  const { data } = await apiClient.patch<ApiResult<SellerPriceUpdate>>(
    `/seller/products/${productId}/price`,
    payload,
  );
  return data;
}
