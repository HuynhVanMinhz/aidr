import type {
  ApiResult,
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
