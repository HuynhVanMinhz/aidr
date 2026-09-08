import type { BuyerProtectionTimeline, BuyerProtectionTimelineApiResult } from '../types/v2Features';
import { apiClient } from './apiClient';

export async function getBuyerProtectionTimeline(orderId: string) {
  const { data } = await apiClient.get<BuyerProtectionTimelineApiResult>(
    `/orders/${orderId}/protection-timeline`,
  );
  return data;
}

export function requireBuyerProtectionTimeline(
  result: BuyerProtectionTimelineApiResult,
): BuyerProtectionTimeline {
  if (!result.success || !result.data) {
    throw new Error(result.message ?? 'Unable to load buyer protection timeline.');
  }
  return result.data;
}
