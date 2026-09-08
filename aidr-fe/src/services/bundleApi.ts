import type { ProductBundle, ProductBundleApiResult } from '../types/v2Features';
import { apiClient } from './apiClient';

export async function getProductBundle(productId: string) {
  const { data } = await apiClient.get<ProductBundleApiResult>(`/products/${productId}/bundle`);
  return data;
}

export function requireProductBundle(result: ProductBundleApiResult): ProductBundle {
  if (!result.success || !result.data) {
    throw new Error(result.message ?? 'Unable to load product bundle.');
  }
  return result.data;
}
