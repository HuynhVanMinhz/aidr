import type { AddCartItemRequest, CartApiResult, UpdateCartItemRequest } from '../types/cart';
import { apiClient } from './apiClient';

export async function getCart() {
  const { data } = await apiClient.get<CartApiResult>('/cart');
  return data;
}

export async function addCartItem(request: AddCartItemRequest) {
  const { data } = await apiClient.post<CartApiResult>('/cart/items', request);
  return data;
}

export async function updateCartItem(cartItemId: string, request: UpdateCartItemRequest) {
  const { data } = await apiClient.patch<CartApiResult>(`/cart/items/${cartItemId}`, request);
  return data;
}

export async function removeCartItem(cartItemId: string) {
  const { data } = await apiClient.delete<CartApiResult>(`/cart/items/${cartItemId}`);
  return data;
}
