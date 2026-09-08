import type {
  CreatePriceAlertRequest,
  PriceAlertItem,
  PriceAlertStatus,
  PriceAlertStatusApiResult,
} from '../types/v2Features';
import type { ApiResult, PagedResult } from '../types/catalog';
import { apiClient } from './apiClient';

export async function getProductPriceAlertStatus(productId: string) {
  const { data } = await apiClient.get<PriceAlertStatusApiResult>(
    `/price-alerts/products/${productId}/status`,
  );
  return data;
}

export async function createPriceAlert(request: CreatePriceAlertRequest) {
  const { data } = await apiClient.post<ApiResult<PriceAlertItem>>('/price-alerts', request);
  return data;
}

export async function removePriceAlertByProduct(productId: string, alertType: 'PriceDrop' | 'BackInStock') {
  const { data } = await apiClient.delete<ApiResult<{ priceAlertId: string; productId: string; alertType: string }>>(
    `/price-alerts/products/${productId}`,
    { params: { alertType } },
  );
  return data;
}

export async function removePriceAlert(priceAlertId: string) {
  const { data } = await apiClient.delete<ApiResult<{ priceAlertId: string; productId: string; alertType: string }>>(
    `/price-alerts/${priceAlertId}`,
  );
  return data;
}

export async function listPriceAlerts(page = 1, pageSize = 20) {
  const { data } = await apiClient.get<ApiResult<PagedResult<PriceAlertItem>>>('/price-alerts', {
    params: { page, pageSize },
  });
  return data;
}

export function requirePriceAlertStatus(result: PriceAlertStatusApiResult): PriceAlertStatus {
  if (!result.success || !result.data) {
    throw new Error(result.message ?? 'Unable to load price alert status.');
  }
  return result.data;
}
