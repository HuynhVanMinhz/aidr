import type { FollowFeedApiResult, FollowFeedResult } from '../types/v2Features';
import { apiClient } from './apiClient';

export async function getFollowingFeed(page = 1, pageSize = 20) {
  const { data } = await apiClient.get<FollowFeedApiResult>('/following/feed', {
    params: { page, pageSize },
  });
  return data;
}

export function requireFollowingFeed(result: FollowFeedApiResult): FollowFeedResult {
  if (!result.success || !result.data) {
    throw new Error(result.message ?? 'Unable to load shop feed.');
  }
  return result.data;
}
