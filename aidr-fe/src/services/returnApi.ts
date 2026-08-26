import type {
  AdminReturnDetail,
  AdminReturnDetailApiResult,
  AdminReturnListApiResult,
  AdminReturnListQuery,
  AdminReturnListResult,
  BuyerReturnApiResult,
  BuyerReturnRequest,
  CreateReturnPayload,
  RejectReturnPayload,
  UpdateReturnStatusPayload,
} from '../types/return';
import type { ApiResult } from '../types/auth';
import { apiClient } from './apiClient';
import axios from 'axios';

export async function createBuyerReturn(orderId: string, payload: CreateReturnPayload) {
  const { data } = await apiClient.post<BuyerReturnApiResult>(
    `/orders/${orderId}/returns`,
    payload,
  );
  return data;
}

export async function getBuyerReturn(orderId: string): Promise<BuyerReturnApiResult | null> {
  try {
    const { data } = await apiClient.get<BuyerReturnApiResult>(`/orders/${orderId}/returns`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function listBuyerReturns(query?: {
  status?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await apiClient.get<ApiResult<{
    items: BuyerReturnRequest[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  }>>('/returns', {
    params: {
      status: query?.status || undefined,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 10,
    },
  });
  return data;
}

export async function getBuyerReturnById(id: string) {
  const { data } = await apiClient.get<BuyerReturnApiResult>(`/returns/${id}`);
  return data;
}

export async function listAdminReturns(query: AdminReturnListQuery = {}) {
  const { data } = await apiClient.get<AdminReturnListApiResult>('/admin/return-requests', {
    params: {
      status: query.status ?? 'Pending',
      q: query.q || undefined,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    },
  });
  return data;
}

export async function getAdminReturn(id: string) {
  const { data } = await apiClient.get<AdminReturnDetailApiResult>(
    `/admin/return-requests/${id}`,
  );
  return data;
}

export async function approveAdminReturn(id: string) {
  const { data } = await apiClient.post<AdminReturnDetailApiResult>(
    `/admin/return-requests/${id}/approve`,
  );
  return data;
}

export async function rejectAdminReturn(id: string, payload: RejectReturnPayload) {
  const { data } = await apiClient.post<AdminReturnDetailApiResult>(
    `/admin/return-requests/${id}/reject`,
    payload,
  );
  return data;
}

export async function updateAdminReturnStatus(id: string, payload: UpdateReturnStatusPayload) {
  const { data } = await apiClient.post<AdminReturnDetailApiResult>(
    `/admin/return-requests/${id}/status`,
    payload,
  );
  return data;
}

export function requireBuyerReturn(result: BuyerReturnApiResult): BuyerReturnRequest {
  if (!result.success || !result.data) {
    throw new Error(result.message || 'Unable to load return request.');
  }
  return result.data;
}

export function requireAdminReturnList(result: AdminReturnListApiResult): AdminReturnListResult {
  if (!result.success || !result.data) {
    throw new Error(result.message || 'Unable to load return requests.');
  }
  return result.data;
}

export function requireAdminReturnDetail(result: AdminReturnDetailApiResult): AdminReturnDetail {
  if (!result.success || !result.data) {
    throw new Error(result.message || 'Unable to load return request.');
  }
  return result.data;
}
