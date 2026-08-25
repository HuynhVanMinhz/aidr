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
