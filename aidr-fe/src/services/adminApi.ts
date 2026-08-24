import type {
  AdminSellerRegistration,
  ApproveSellerRegistrationResult,
  RejectSellerRegistrationPayload,
  SellerRegistrationStatusFilter,
} from '../types/admin';
import type { ApiResult } from '../types/catalog';
import { apiClient } from './apiClient';

export async function listSellerRegistrations(status?: SellerRegistrationStatusFilter) {
  const params = status ? { status } : undefined;
  const { data } = await apiClient.get<ApiResult<AdminSellerRegistration[]>>(
    '/admin/seller-registrations',
    { params },
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
