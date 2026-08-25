import type { ApiResult } from '../types/auth';
import type {
  AdminSystemVoucher,
  AdminSystemVoucherListQuery,
  AdminSystemVoucherListResult,
  CreateSystemVoucherPayload,
  UpdateSystemVoucherPayload,
} from '../types/admin';
import type {
  ApplyVoucherPreviewRequest,
  VoucherListApiResult,
  VoucherListQuery,
  VoucherPreviewApiResult,
} from '../types/voucher';
import { apiClient } from './apiClient';

export async function listVouchers(query?: VoucherListQuery) {
  const { data } = await apiClient.get<VoucherListApiResult>('/vouchers', {
    params: {
      cartItemIds: query?.cartItemIds?.length ? query.cartItemIds : undefined,
      scope: query?.scope || undefined,
      shopId: query?.shopId || undefined,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
    },
    paramsSerializer: {
      indexes: null,
    },
  });
  return data;
}

export async function previewVoucher(request: ApplyVoucherPreviewRequest) {
  const { data } = await apiClient.post<VoucherPreviewApiResult>('/vouchers/preview', request);
  return data;
}

export async function listAdminSystemVouchers(query: AdminSystemVoucherListQuery = {}) {
  const { data } = await apiClient.get<ApiResult<AdminSystemVoucherListResult>>('/admin/vouchers', {
    params: {
      q: query.q || undefined,
      isActive: query.isActive === null || query.isActive === undefined ? undefined : query.isActive,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    },
  });
  return data;
}

export async function getAdminSystemVoucher(id: string) {
  const { data } = await apiClient.get<ApiResult<AdminSystemVoucher>>(`/admin/vouchers/${id}`);
  return data;
}

export async function createAdminSystemVoucher(payload: CreateSystemVoucherPayload) {
  const { data } = await apiClient.post<ApiResult<AdminSystemVoucher>>('/admin/vouchers', payload);
  return data;
}

export async function updateAdminSystemVoucher(id: string, payload: UpdateSystemVoucherPayload) {
  const { data } = await apiClient.put<ApiResult<AdminSystemVoucher>>(`/admin/vouchers/${id}`, payload);
  return data;
}

export async function updateAdminSystemVoucherStatus(id: string, isActive: boolean) {
  const { data } = await apiClient.patch<ApiResult<AdminSystemVoucher>>(
    `/admin/vouchers/${id}/status`,
    { isActive },
  );
  return data;
}

export async function deleteAdminSystemVoucher(id: string) {
  const { data } = await apiClient.delete<ApiResult<object>>(`/admin/vouchers/${id}`);
  return data;
}
