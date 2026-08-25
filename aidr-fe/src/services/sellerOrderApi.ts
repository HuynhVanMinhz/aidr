import type {
  SellerOrderDetail,
  SellerOrderDetailApiResult,
  SellerOrderListApiResult,
  SellerOrderListQuery,
  SellerOrderListResult,
  UpdateSellerOrderRequest,
} from '../types/sellerOrder';
import { apiClient } from './apiClient';

export async function listSellerOrders(query: SellerOrderListQuery = {}) {
  const { data } = await apiClient.get<SellerOrderListApiResult>('/seller/orders', {
    params: {
      status: query.status || undefined,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    },
  });
  return data;
}

export async function getSellerOrder(orderId: string) {
  const { data } = await apiClient.get<SellerOrderDetailApiResult>(`/seller/orders/${orderId}`);
  return data;
}

export async function updateSellerOrderStatus(orderId: string, request: UpdateSellerOrderRequest) {
  const { data } = await apiClient.patch<SellerOrderDetailApiResult>(
    `/seller/orders/${orderId}`,
    request,
  );
  return data;
}

export function requireSellerOrderList(result: SellerOrderListApiResult): SellerOrderListResult {
  if (!result.success || !result.data) {
    throw new Error(result.message || 'Unable to load orders.');
  }
  return result.data;
}

export function requireSellerOrderDetail(result: SellerOrderDetailApiResult): SellerOrderDetail {
  if (!result.success || !result.data) {
    throw new Error(result.message || 'Unable to load order.');
  }
  return result.data;
}
