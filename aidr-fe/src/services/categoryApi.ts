import type { ApiResult, CategoryTreeNode } from '../types/catalog';
import type { AdminCategory, CreateCategoryPayload, UpdateCategoryPayload } from '../types/admin';
import { apiClient } from './apiClient';

export async function getCategoryTree() {
  const { data } = await apiClient.get<ApiResult<CategoryTreeNode[]>>('/categories');
  return data;
}

export async function listAdminCategories() {
  const { data } = await apiClient.get<ApiResult<AdminCategory[]>>('/admin/categories');
  return data;
}

export async function getAdminCategory(id: number) {
  const { data } = await apiClient.get<ApiResult<AdminCategory>>(`/admin/categories/${id}`);
  return data;
}

export async function createAdminCategory(payload: CreateCategoryPayload) {
  const { data } = await apiClient.post<ApiResult<AdminCategory>>('/admin/categories', payload);
  return data;
}

export async function updateAdminCategory(id: number, payload: UpdateCategoryPayload) {
  const { data } = await apiClient.put<ApiResult<AdminCategory>>(`/admin/categories/${id}`, payload);
  return data;
}

export async function updateAdminCategoryStatus(id: number, isActive: boolean) {
  const { data } = await apiClient.patch<ApiResult<AdminCategory>>(`/admin/categories/${id}/status`, {
    isActive,
  });
  return data;
}

export async function deleteAdminCategory(id: number) {
  const { data } = await apiClient.delete<ApiResult<object>>(`/admin/categories/${id}`);
  return data;
}
