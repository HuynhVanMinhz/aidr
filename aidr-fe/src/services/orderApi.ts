import type {
  BuyerOrderDetail,
  BuyerOrderDetailApiResult,
  BuyerOrderListApiResult,
  BuyerOrderListQuery,
  BuyerOrderListResult,
  CancelOrderRequest,
  CreateOrderApiResult,
  CreateOrderRequest,
} from '../types/order';
import { apiClient } from './apiClient';

export async function createOrder(request: CreateOrderRequest) {
  const { data } = await apiClient.post<CreateOrderApiResult>('/orders', request);
  return data;
}

export async function listBuyerOrders(query: BuyerOrderListQuery = {}) {
  const { data } = await apiClient.get<BuyerOrderListApiResult>('/orders', {
    params: {
      status: query.status || undefined,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    },
  });
  return data;
}

export async function getBuyerOrder(orderId: string) {
  const { data } = await apiClient.get<BuyerOrderDetailApiResult>(`/orders/${orderId}`);
  return data;
}

export async function cancelBuyerOrder(orderId: string, request: CancelOrderRequest = {}) {
  const { data } = await apiClient.post<BuyerOrderDetailApiResult>(
    `/orders/${orderId}/cancel`,
    request,
  );
  return data;
}

export async function confirmBuyerOrderReceived(orderId: string) {
  const { data } = await apiClient.post<BuyerOrderDetailApiResult>(
    `/orders/${orderId}/confirm-received`,
  );
  return data;
}

export function requireBuyerOrderList(
  result: BuyerOrderListApiResult,
): BuyerOrderListResult {
  if (!result.success || !result.data) {
    throw new Error(result.message || 'Unable to load orders.');
  }
  return result.data;
}

export function requireBuyerOrderDetail(result: BuyerOrderDetailApiResult): BuyerOrderDetail {
  if (!result.success || !result.data) {
    throw new Error(result.message || 'Unable to load order.');
  }
  return result.data;
}
