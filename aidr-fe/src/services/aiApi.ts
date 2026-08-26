import type {
  ApiResult,
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
