import type {
  ApiResult,
  AiChatRequest,
  AiChatResult,
  AiConversationDetail,
  AiConversationSummary,
  CompareProductsRequest,
  CompareProductsResult,
  NlFilterRequest,
  NlFilterResult,
  PagedResult,
  RecommendationQuery,
  RecommendedProduct,
  SimilarProduct,
  SimilarProductsQuery,
} from '../types/ai';
import { apiClient } from './apiClient';

export async function getRecommendations(query: RecommendationQuery = {}) {
  const params: Record<string, number> = {};
  if (query.page != null) params.page = query.page;
  if (query.pageSize != null) params.pageSize = query.pageSize;

  const { data } = await apiClient.get<ApiResult<PagedResult<RecommendedProduct>>>('/recommendations', {
    params,
  });
  return data;
}

export async function getSimilarProducts(productId: string, query: SimilarProductsQuery = {}) {
  const params: Record<string, number> = {};
  if (query.limit != null) params.limit = query.limit;

  const { data } = await apiClient.get<ApiResult<SimilarProduct[]>>(`/products/${productId}/similar`, {
    params,
  });
  return data;
}

export async function parseNlFilter(body: NlFilterRequest) {
  const { data } = await apiClient.post<ApiResult<NlFilterResult>>('/ai/nl-filter', body);
  return data;
}

export async function compareProducts(body: CompareProductsRequest) {
  const { data } = await apiClient.post<ApiResult<CompareProductsResult>>('/ai/compare', body);
  return data;
}

export async function sendAiChat(body: AiChatRequest) {
  const { data } = await apiClient.post<ApiResult<AiChatResult>>('/ai/chat', body);
  return data;
}

export async function listAiConversations(page = 1, pageSize = 20) {
  const { data } = await apiClient.get<ApiResult<PagedResult<AiConversationSummary>>>('/ai/conversations', {
    params: { page, pageSize },
  });
  return data;
}

export async function getAiConversation(conversationId: string) {
  const { data } = await apiClient.get<ApiResult<AiConversationDetail>>(
    `/ai/conversations/${conversationId}`,
  );
  return data;
}
