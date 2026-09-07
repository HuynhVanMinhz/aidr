import type { AiAnalyticsBrief, AiAnalyticsBriefQuery } from '../types/aiAnalytics';
import type { ApiResult } from '../types/catalog';
import { apiClient } from './apiClient';

export async function getAdminAnalyticsBrief(query: AiAnalyticsBriefQuery = {}) {
  const { data } = await apiClient.get<ApiResult<AiAnalyticsBrief>>('/admin/ai/analytics-brief', {
    params: {
      from: query.from || undefined,
      to: query.to || undefined,
      question: query.question || undefined,
    },
  });
  return data;
}

export async function getSellerAnalyticsBrief(query: AiAnalyticsBriefQuery = {}) {
  const { data } = await apiClient.get<ApiResult<AiAnalyticsBrief>>('/seller/ai/analytics-brief', {
    params: {
      from: query.from || undefined,
      to: query.to || undefined,
      question: query.question || undefined,
    },
  });
  return data;
}
