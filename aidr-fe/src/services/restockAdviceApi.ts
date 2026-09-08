import type { RestockAdviceApiResult, RestockAdviceResult } from '../types/v2Features';
import { apiClient } from './apiClient';

export async function getRestockAdvice(days = 14) {
  const { data } = await apiClient.get<RestockAdviceApiResult>(
    '/seller/inventory/restock-advice',
    { params: { days } },
  );
  return data;
}

export function requireRestockAdvice(result: RestockAdviceApiResult): RestockAdviceResult {
  if (!result.success || !result.data) {
    throw new Error(result.message ?? 'Unable to load restock advice.');
  }
  return result.data;
}
