import type {
  AdminSellerRegistration,
  AdminSellerRegistrationListResult,
  ApproveSellerRegistrationResult,
  RejectSellerRegistrationPayload,
  SellerRegistrationListQuery,
} from '../types/admin';
import type { ApiResult } from '../types/catalog';
import { apiClient } from './apiClient';

export async function listSellerRegistrations(query: SellerRegistrationListQuery = {}) {
  const { data } = await apiClient.get<ApiResult<AdminSellerRegistrationListResult>>(
    '/admin/seller-registrations',
    {
      params: {
        status: query.status ?? 'Pending',
        q: query.q || undefined,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 10,
      },
    },
  );
  return data;
}

export async function getSellerRegistration(id: string) {
  const { data } = await apiClient.get<ApiResult<AdminSellerRegistration>>(
    `/admin/seller-registrations/${id}`,
  );
  return data;
}

export async function approveSellerRegistration(id: string) {
  const { data } = await apiClient.post<ApiResult<ApproveSellerRegistrationResult>>(
    `/admin/seller-registrations/${id}/approve`,
  );
  return data;
}

export async function rejectSellerRegistration(id: string, payload: RejectSellerRegistrationPayload) {
  const { data } = await apiClient.post<ApiResult<AdminSellerRegistration>>(
    `/admin/seller-registrations/${id}/reject`,
    payload,
  );
  return data;
}
