import type { CreateOrderApiResult, CreateOrderRequest } from '../types/order';
import { apiClient } from './apiClient';

export async function createOrder(request: CreateOrderRequest) {
  const { data } = await apiClient.post<CreateOrderApiResult>('/orders', request);
  return data;
}
