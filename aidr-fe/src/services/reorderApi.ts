import type { ReorderOrderApiResult, ReorderOrderResponse } from '../types/v2Features';
import { apiClient } from './apiClient';

export async function reorderOrder(orderId: string) {
  const { data } = await apiClient.post<ReorderOrderApiResult>(`/orders/${orderId}/reorder`);
  return data;
}

export function requireReorderResult(result: ReorderOrderApiResult): ReorderOrderResponse {
  if (!result.success || !result.data) {
    throw new Error(result.message ?? 'Unable to reorder items.');
  }
  return result.data;
}
