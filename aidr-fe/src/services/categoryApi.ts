import type { ApiResult, CategoryTreeNode } from '../types/catalog';
import { apiClient } from './apiClient';

export async function getCategoryTree() {
  const { data } = await apiClient.get<ApiResult<CategoryTreeNode[]>>('/categories');
  return data;
}
