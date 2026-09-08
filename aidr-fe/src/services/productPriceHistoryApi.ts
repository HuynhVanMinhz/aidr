import type { ProductPriceHistory, ProductPriceHistoryApiResult } from '../types/v2Features';
import { apiClient } from './apiClient';

export async function getProductPriceHistory(productId: string, days = 90) {
  const { data } = await apiClient.get<ProductPriceHistoryApiResult>(
    `/products/${productId}/price-history`,
    { params: { days } },
  );
  return data;
}

export function requireProductPriceHistory(result: ProductPriceHistoryApiResult): ProductPriceHistory {
  if (!result.success || !result.data) {
    throw new Error(result.message ?? 'Unable to load price history.');
  }
  return result.data;
}
