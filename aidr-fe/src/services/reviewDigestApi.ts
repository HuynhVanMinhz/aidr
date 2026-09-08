import type { ReviewDigest, ReviewDigestApiResult } from '../types/v2Features';
import { apiClient } from './apiClient';

export async function getProductReviewDigest(productId: string) {
  const { data } = await apiClient.get<ReviewDigestApiResult>(
    `/products/${productId}/review-digest`,
  );
  return data;
}

export function requireReviewDigest(result: ReviewDigestApiResult): ReviewDigest {
  if (!result.success || !result.data) {
    throw new Error(result.message ?? 'Unable to load review digest.');
  }
  return result.data;
}
